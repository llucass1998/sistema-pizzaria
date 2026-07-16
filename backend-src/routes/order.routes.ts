/**
 * Rotas de pedidos — regras ERP profissional.
 *
 * Implementa:
 *  - Maquina de estados com transicoes validas por tipo de entrega
 *  - Validacao de campos (limites, tipos, obrigatoriedade)
 *  - Taxa de entrega e servico sempre do banco (ignorar o que o front manda)
 *  - Protecao contra auto-criacao silenciosa de produtos invalidos
 *  - Limite de itens por pedido
 *  - Resposta padronizada com allowedNext para o frontend
 */

import { Router } from 'express';

import { basePrisma, prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { requireCustomer } from '../middlewares/requireCustomer.js';
import { requireRole } from '../middlewares/requireRole.js';
import { sendWhatsAppMessage } from '../utils/waha.js';
import { getStoreSettings } from '../services/storeSettings.service.js';
import type { OrderItemInput } from '../types/order.js';
import { normalizeText } from '../utils/normalize.js';
import { getAllowedNextStatuses, validateStatusTransition } from '../utils/orderStateMachine.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { getIdParam } from '../utils/request.js';
import { resolveKdsStation, resolvePrepTimeMinutes } from '../utils/kdsHelpers.js';
import { IfoodService } from '../integrations/ifood/ifood.service.js';
import { calculateCheckoutTotals } from '../utils/checkoutTotals.js';
import {
  FIELD_LIMITS,
  ORDER_LIMITS,
  validateDeliveryAddress,
  validateLength,
  validateQuantity,
} from '../utils/validate.js';
import { FulfillmentType, OrderStatus } from '../../generated/prisma/index.js';
import { InventoryService } from '../services/inventory.service.js';
import { PaymentGatewayService } from '../services/PaymentGatewayService.js';
import { ProductAvailabilityService } from '../services/ProductAvailabilityService.js';
import {
  calculateDepositAmounts,
  createOrderInvoice,
  centsToMoney,
  FINANCIAL_STATUS,
  moneyToCents,
  normalizePaymentMethod,
  normalizePaymentMode,
} from '../services/orderFinancial.service.js';
import { emitOrderEvent } from '../services/orderEvents.service.js';

export const orderRoutes = Router();

function getItemOptionIds(item: OrderItemInput) {
  const ids = new Set<string>();

  const addId = (value: unknown) => {
    const id = normalizeText(value);
    if (id) ids.add(id);
  };

  if (Array.isArray(item.optionIds)) {
    item.optionIds.forEach(addId);
  }

  if (Array.isArray(item.addonIds)) {
    item.addonIds.forEach(addId);
  }

  if (Array.isArray(item.addons)) {
    item.addons.forEach((addon) => addId(addon?.id));
  }

  addId(item.crustId);
  addId(item.crust?.id);

  return [...ids];
}

function getHalfAndHalfInput(item: OrderItemInput) {
  const secondProductId = normalizeText(item.halfAndHalf?.secondProductId);
  const secondVariantId = normalizeText(item.halfAndHalf?.secondVariantId);

  if (!secondProductId && !secondVariantId) {
    return null;
  }

  return {
    secondProductId,
    secondVariantId,
  };
}

function getAvailabilitySelections(rawItems: OrderItemInput[]) {
  return rawItems.map((item) => ({
    productId: normalizeText(item.productId),
    quantity: Number(item.quantity) || 1,
    optionIds: getItemOptionIds(item),
    halfAndHalf: getHalfAndHalfInput(item),
  }));
}

function optionStockSnapshot(option: any) {
  return {
    id: option.id,
    type: 'type' in option ? option.type : 'ITEM',
    name: option.name,
    price: Number(option.price),
    stockImpactType: option.stockImpactType ?? 'NO_STOCK_IMPACT',
    ingredientId: option.ingredientId ?? null,
    ingredientQuantity:
      option.ingredientQuantity === null || option.ingredientQuantity === undefined
        ? null
        : Number(option.ingredientQuantity),
    replacementIngredientId: option.replacementIngredientId ?? null,
  };
}

function getHalfAndHalfGroup(product: { category: string; menuCategory?: any }) {
  return product.menuCategory?.halfAndHalfGroup || product.menuCategory?.slug || product.category;
}

function getDashboardDateRange(rawDate: unknown) {
  const requestedDate = normalizeText(rawDate);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : new Date().toISOString().slice(0, 10);

  const start = new Date(`${date}T00:00:00.000-03:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { date, start, end };
}

function enrichOrderWithPix(order: any) {
  if (!order) return order;
  const txs = order.paymentTransactions || [];
  const lastTx = txs[txs.length - 1];
  const meta = (lastTx?.metadata as any) ?? {};
  return {
    ...order,
    pixQrCode: meta.pixQrCode || order.pixQrCode,
    pixQrCodeBase64: meta.pixQrCodeBase64 || order.pixQrCodeBase64,
  };
}

function getDepositRequiredMethods(settings: any) {
  return String(settings.depositRequiredMethods ?? 'PIX_ONLINE,CARD_ONLINE,MERCADOPAGO')
    .split(',')
    .map((method) => method.trim().toUpperCase())
    .filter(Boolean);
}

function canUseDepositForPayment(settings: any, paymentMethod: string, cardPaymentMode: string) {
  if (settings.depositEnabled !== true) return false;
  const methods = getDepositRequiredMethods(settings);
  if (paymentMethod === 'PIX') {
    return process.env.ENABLE_ONLINE_PIX === 'true' && methods.includes('PIX_ONLINE');
  }
  if (['CREDIT_CARD', 'DEBIT_CARD', 'ONLINE_CARD'].includes(paymentMethod)) {
    return (
      cardPaymentMode === 'ONLINE' &&
      (methods.includes('CARD_ONLINE') || methods.includes('MERCADOPAGO'))
    );
  }
  return false;
}

function buildPaymentIdempotencyKey(orderId: string, type: string) {
  return `${orderId}:${type}`;
}

async function calculateDeliveryFeeForOrder({
  tenantId,
  settings,
  fulfillmentType,
  address,
  subtotal,
}: {
  tenantId: string;
  settings: any;
  fulfillmentType: FulfillmentType;
  address: Record<string, unknown>;
  subtotal: number;
}) {
  if (fulfillmentType !== FulfillmentType.DELIVERY) {
    return { deliveryFee: 0 };
  }

  const mode = normalizeText(settings.deliveryFeeMode || 'FIXED').toUpperCase();

  if (mode === 'NEIGHBORHOOD') {
    const neighborhood = normalizeText(address.neighborhood);
    if (!neighborhood) {
      return { deliveryFee: 0, message: 'Bairro é obrigatório para cálculo da taxa.' };
    }

    const zone = await prisma.deliveryZone.findFirst({
      where: { tenantId, name: { equals: neighborhood, mode: 'insensitive' }, isActive: true },
    });

    if (!zone) {
      return { deliveryFee: 0, message: 'Ainda não entregamos neste bairro.' };
    }

    if (zone.minOrderValue && subtotal < Number(zone.minOrderValue)) {
      return {
        deliveryFee: Number(zone.fee),
        message: `O pedido mínimo para este bairro é R$ ${Number(zone.minOrderValue).toFixed(2)}`,
      };
    }

    return { deliveryFee: Number(zone.fee) };
  }

  if (mode === 'DISTANCE') {
    return {
      deliveryFee: 0,
      message: 'Entrega por distância exige geolocalização ativa antes de finalizar o pedido.',
    };
  }

  return { deliveryFee: Number(settings.deliveryFee) };
}

// ─── POST /pedidos ─────────────────────────────────────────────────────────────
// Cria um pedido para retirada em loja ou entrega.
orderRoutes.post(
  '/pedidos',
  requireCustomer,
  asyncHandler(async (req, res) => {
    // 1. Tipo de entrega.
    const fulfillmentType = req.body.fulfillmentType as FulfillmentType;

    if (!Object.values(FulfillmentType).includes(fulfillmentType)) {
      res.status(400).json({ message: 'Tipo do pedido deve ser PICKUP ou DELIVERY.' });
      return;
    }

    // 2. Lista de itens.
    const rawItems = Array.isArray(req.body.items) ? (req.body.items as OrderItemInput[]) : [];

    if (rawItems.length === 0) {
      res.status(400).json({ message: 'Adicione pelo menos um item ao pedido.' });
      return;
    }

    if (rawItems.length > ORDER_LIMITS.MAX_ITEMS) {
      res.status(400).json({
        message: `Pedido pode ter no maximo ${ORDER_LIMITS.MAX_ITEMS} itens distintos.`,
      });
      return;
    }

    // 3. Identificacao do cliente a partir da sessao e do tenant.
    const tenantId = getTenantId();
    const customerId = (req as any).customerId;
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });

    if (!customer || customer.tenantId !== tenantId) {
      res.status(401).json({ message: 'Sessao de cliente invalida.' });
      return;
    }

    const settings = await getStoreSettings();
    if (settings.isOpen === false) {
      res.status(423).json({
        message:
          'A loja esta fechada no momento. Volte durante o horario de atendimento para fazer seu pedido.',
      });
      return;
    }

    // 4. Validacao do endereco de entrega.
    if (fulfillmentType === FulfillmentType.DELIVERY) {
      const address = (req.body.address ?? {}) as Record<string, unknown>;
      const addressErrors = validateDeliveryAddress(address);

      if (addressErrors.length > 0) {
        res.status(400).json({
          message: addressErrors[0].message,
          errors: addressErrors,
        });
        return;
      }
    }

    // 5. Validacao e resolucao dos itens.
    const halfAndHalfInputs = rawItems.map(getHalfAndHalfInput);
    const productIds = [
      ...new Set([
        ...rawItems.map((item) => normalizeText(item.productId)),
        ...halfAndHalfInputs.map((item) => item?.secondProductId ?? ''),
      ]),
    ].filter((id): id is string => Boolean(id));
    const variantIds = [
      ...new Set([
        ...rawItems.map((item) => normalizeText(item.variantId)),
        ...halfAndHalfInputs.map((item) => item?.secondVariantId ?? ''),
      ]),
    ].filter((id): id is string => Boolean(id));
    const optionIds = [...new Set(rawItems.flatMap((item) => getItemOptionIds(item)))];

    const [foundProducts, foundVariants, globalOptions, productOptions] = await Promise.all([
      prisma.product.findMany({
        where: { tenantId, id: { in: productIds }, isAvailable: true },
        include: {
          menuCategory: true,
          variants: { where: { isAvailable: true }, select: { id: true } },
        },
      }),
      variantIds.length > 0
        ? prisma.productVariant.findMany({
            where: { product: { tenantId }, id: { in: variantIds }, isAvailable: true },
          })
        : Promise.resolve([]),
      optionIds.length > 0
        ? prisma.productOption.findMany({
            where: { tenantId, id: { in: optionIds }, isAvailable: true },
          })
        : Promise.resolve([]),
      optionIds.length > 0
        ? prisma.productOptionItem.findMany({
            where: { group: { tenantId }, id: { in: optionIds }, isAvailable: true },
          })
        : Promise.resolve([]),
    ]);

    // Mesclar globais e do produto
    const foundOptions = [...globalOptions, ...productOptions];

    const productsById = new Map(foundProducts.map((p) => [p.id, p]));
    const variantsById = new Map(foundVariants.map((variant) => [variant.id, variant]));
    const optionsById = new Map(foundOptions.map((option) => [option.id, option]));

    const orderItems: Array<{
      productId: string;
      variantId: string | null;
      displayName: string | null;
      customizations: string | null;
      variantName: string | null;
      halfAndHalfData: any;
      optionsSnapshot: string | null;
      imageUrl: string | null;
      quantity: number;
      basePrice: string;
      optionsTotal: string;
      unitPrice: string;
      total: string;
      kdsStation?: any;
      prepTimeMinutes?: number;
    }> = [];

    let subtotal = 0;

    for (const item of rawItems) {
      const productId = normalizeText(item.productId);
      const itemName = normalizeText(item.name);
      const itemDisplayName = normalizeText(item.displayName) || itemName || null;
      const itemCustomizations = normalizeText(item.customizations) || null;
      const itemImageUrl = normalizeText(item.imageUrl) || null;
      const itemVariantId = normalizeText(item.variantId);
      const itemOptionIds = getItemOptionIds(item);
      const halfAndHalfInput = getHalfAndHalfInput(item);
      const quantity = Number(item.quantity);

      // Validar quantidade.
      const qtyError = validateQuantity(quantity);
      if (qtyError) {
        res.status(400).json({ message: qtyError.message });
        return;
      }

      // Validar comprimento de customizacoes.
      if (itemCustomizations) {
        const custError = validateLength(
          itemCustomizations,
          'customizations',
          FIELD_LIMITS.CUSTOMIZATIONS,
        );
        if (custError) {
          res.status(400).json({ message: custError.message });
          return;
        }
      }

      // Buscar produto no banco. NAO cria produto automaticamente (seguranca ERP).
      let product = productId ? productsById.get(productId) : undefined;

      if (!product && itemName) {
        // Permitir busca por nome exato como fallback, mas produto deve existir.
        product =
          (await prisma.product.findFirst({
            where: { tenantId, name: itemName, isAvailable: true },
            include: {
              menuCategory: true,
              variants: { where: { isAvailable: true }, select: { id: true } },
            },
          })) ?? undefined;
      }

      if (!product) {
        res.status(400).json({
          message: `Item "${itemName || productId || 'desconhecido'}" nao encontrado ou indisponivel no cardapio.`,
        });
        return;
      }

      const variant = itemVariantId ? variantsById.get(itemVariantId) : undefined;
      if (itemVariantId && (!variant || variant.productId !== product.id)) {
        res.status(400).json({
          message: `Variacao do item "${product.name}" nao encontrada ou indisponivel.`,
        });
        return;
      }

      if (product.menuCategory?.allowSizes && product.variants.length > 0 && !variant) {
        res.status(400).json({ message: `Escolha um tamanho para "${product.name}".` });
        return;
      }

      let halfAndHalfData: any = null;
      let secondProduct: typeof product | undefined;
      let secondVariant: typeof variant | undefined;

      if (halfAndHalfInput) {
        if (!product.menuCategory?.allowHalfAndHalf) {
          res.status(400).json({ message: `O item "${product.name}" nao permite meia-meia.` });
          return;
        }

        secondProduct = productsById.get(halfAndHalfInput.secondProductId);
        if (!secondProduct) {
          res.status(400).json({ message: 'A segunda metade da pizza nao foi encontrada.' });
          return;
        }

        if (!secondProduct.menuCategory?.allowHalfAndHalf) {
          res.status(400).json({
            message: `O item "${secondProduct.name}" nao permite meia-meia.`,
          });
          return;
        }

        const group = getHalfAndHalfGroup(product);
        const secondGroup = getHalfAndHalfGroup(secondProduct);
        if (group !== secondGroup) {
          res.status(400).json({
            message: 'Meia-meia so e permitida entre produtos do mesmo grupo.',
          });
          return;
        }

        if (product.id === secondProduct.id) {
          res.status(400).json({ message: 'Escolha dois sabores diferentes para meia-meia.' });
          return;
        }

        secondVariant = halfAndHalfInput.secondVariantId
          ? variantsById.get(halfAndHalfInput.secondVariantId)
          : undefined;

        if (
          (variant ||
            (secondProduct.menuCategory?.allowSizes && secondProduct.variants.length > 0)) &&
          (!secondVariant || secondVariant.productId !== secondProduct.id)
        ) {
          res.status(400).json({
            message: `Selecione o tamanho de "${secondProduct.name}" para meia-meia.`,
          });
          return;
        }

        if (variant && secondVariant && variant.code !== secondVariant.code) {
          res.status(400).json({
            message: 'As duas metades precisam usar o mesmo tamanho.',
          });
          return;
        }

        halfAndHalfData = {
          firstProductId: product.id,
          firstProductName: product.name,
          firstVariantId: variant?.id ?? null,
          firstVariantName: variant?.name ?? null,
          secondProductId: secondProduct.id,
          secondProductName: secondProduct.name,
          secondVariantId: secondVariant?.id ?? null,
          secondVariantName: secondVariant?.name ?? null,
          priceRule: 'HIGHER_HALF_PRICE',
        };
      }

      const selectedOptions = itemOptionIds
        .map((id) => optionsById.get(id))
        .filter((option): option is NonNullable<typeof option> => Boolean(option));

      if (selectedOptions.length !== itemOptionIds.length) {
        res.status(400).json({
          message: `Um adicional ou borda do item "${product.name}" nao esta disponivel.`,
        });
        return;
      }

      // Preco calculado no backend: produto/tamanho + adicionais + borda.
      const baseUnitPrice = halfAndHalfData
        ? Math.max(
            Number(variant?.price ?? product.price),
            Number(secondVariant?.price ?? secondProduct?.price ?? product.price),
          )
        : Number(variant?.price ?? product.price);
      const optionsTotal = selectedOptions.reduce((sum, option) => sum + Number(option.price), 0);
      const unitPrice = baseUnitPrice + optionsTotal;

      const itemTotal = unitPrice * quantity;
      subtotal += itemTotal;

      const computedCustomizations = [
        halfAndHalfData
          ? `Meia-meia: ${halfAndHalfData.firstProductName} / ${halfAndHalfData.secondProductName}`
          : '',
        variant ? `Tamanho: ${variant.name}` : '',
        ...selectedOptions.map(
          (option) => `${option.name} (+R$ ${Number(option.price).toFixed(2)})`,
        ),
      ]
        .filter(Boolean)
        .join(', ');

      const station = resolveKdsStation(
        product as any,
        (product as any).menuCategory,
        itemDisplayName,
      );
      const prepTime = resolvePrepTimeMinutes(
        station,
        (product as any).prepTimeMinutes,
        (product as any).menuCategory?.prepTimeMinutes,
      );

      orderItems.push({
        productId: product.id,
        variantId: variant?.id ?? null,
        displayName: halfAndHalfData
          ? `Meia-meia: ${halfAndHalfData.firstProductName} / ${halfAndHalfData.secondProductName}`
          : itemDisplayName,
        customizations: itemCustomizations || computedCustomizations || null,
        variantName: variant?.name ?? null,
        halfAndHalfData,
        optionsSnapshot:
          selectedOptions.length > 0 || halfAndHalfData
            ? JSON.stringify({
                halfAndHalf: halfAndHalfData,
                options: selectedOptions.map(optionStockSnapshot),
              })
            : null,
        imageUrl: itemImageUrl,
        quantity,
        basePrice: baseUnitPrice.toFixed(2),
        optionsTotal: optionsTotal.toFixed(2),
        unitPrice: unitPrice.toFixed(2),
        total: itemTotal.toFixed(2),
        kdsStation: station,
        prepTimeMinutes: prepTime,
      });
    }

    // 6. Taxas — sempre do banco, frontend e so referencia.
    try {
      await ProductAvailabilityService.assertSelectionsAvailable(
        tenantId,
        getAvailabilitySelections(rawItems),
      );
    } catch (availabilityError: any) {
      res.status(availabilityError.statusCode ?? 409).json({
        message: availabilityError.message,
        availability: availabilityError.availability,
      });
      return;
    }

    const address = (req.body.address ?? {}) as Record<string, unknown>;
    const deliveryFeeResult = await calculateDeliveryFeeForOrder({
      tenantId,
      settings,
      fulfillmentType,
      address,
      subtotal,
    });

    if (deliveryFeeResult.message) {
      res.status(400).json({ message: deliveryFeeResult.message });
      return;
    }

    const deliveryFeeBase = deliveryFeeResult.deliveryFee;
    let chargedDeliveryFee = deliveryFeeBase;
    const serviceFeeValue = Number(settings.serviceFee);
    let totalFees = chargedDeliveryFee + serviceFeeValue;

    // 6.1 Processar Cupons (CRM)
    let discount = 0;
    let appliedCoupon: any = null;

    if (req.body.couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { tenantId_code: { tenantId, code: String(req.body.couponCode).toUpperCase() } },
      });

      if (coupon && coupon.isActive) {
        if (!coupon.expirationDate || coupon.expirationDate > new Date()) {
          if (!coupon.maxUses || coupon.currentUses < coupon.maxUses) {
            if (!coupon.minOrderValue || subtotal >= Number(coupon.minOrderValue)) {
              appliedCoupon = coupon;
              if (coupon.type === 'PERCENTAGE') {
                discount = subtotal * (Number(coupon.value) / 100);
              } else if (coupon.type === 'FIXED') {
                discount = Number(coupon.value);
              } else if (coupon.type === 'FREE_DELIVERY') {
                chargedDeliveryFee = 0;
                totalFees = serviceFeeValue;
              }
            } else {
              res.status(400).json({
                message: `O cupom exige um subtotal mínimo de R$ ${Number(coupon.minOrderValue).toFixed(2)}.`,
              });
              return;
            }
          } else {
            res.status(400).json({ message: 'O cupom atingiu o limite máximo de usos.' });
            return;
          }
        } else {
          res.status(400).json({ message: 'O cupom está expirado.' });
          return;
        }
      } else {
        res.status(400).json({ message: 'O cupom é inválido ou está inativo.' });
        return;
      }
    }

    // 6.2 Matematica corrigida do checkout: cupom/cashback nunca negativam total.
    const { loyaltyDiscount, total } = calculateCheckoutTotals({
      subtotal,
      discount,
      fees: totalFees,
      loyaltyBalance: Number(customer.loyaltyBalance ?? 0),
      useLoyaltyBalance: Boolean(req.body.useLoyaltyBalance),
    });

    // 7. Observacoes com limite de caracteres.
    const notes = normalizeText(req.body.notes) || null;
    if (notes && notes.length > FIELD_LIMITS.NOTES) {
      res.status(400).json({
        message: `Observacoes podem ter no maximo ${FIELD_LIMITS.NOTES} caracteres.`,
      });
      return;
    }

    // 8. Criar o pedido, itens, abater cupom e fidelidade em transação atômica.
    const paymentMethod = normalizePaymentMethod(req.body.paymentMethod, 'PIX');
    const cardPaymentMode = normalizeText(req.body.cardPaymentMode).toUpperCase();
    if (paymentMethod === 'ONLINE_CARD' && cardPaymentMode !== 'ONLINE') {
      res.status(400).json({ message: 'Pagamento online exige confirmacao pelo gateway.' });
      return;
    }
    const requestedPaymentMode = normalizePaymentMode(req.body.paymentMode, 'FULL');
    const paymentMode =
      requestedPaymentMode === 'DEPOSIT' &&
      canUseDepositForPayment(settings, paymentMethod, cardPaymentMode)
        ? 'DEPOSIT'
        : 'FULL';
    if (requestedPaymentMode === 'DEPOSIT' && paymentMode !== 'DEPOSIT') {
      res.status(400).json({
        message:
          'Pagamento com entrada indisponivel para a forma escolhida. Use PIX online ou cartao online configurado.',
      });
      return;
    }
    const depositData =
      paymentMode === 'DEPOSIT'
        ? calculateDepositAmounts(total, settings.depositPercent ?? 50)
        : { depositPercent: null, depositAmount: 0, remainingAmount: 0 };
    const initialAmountDue = paymentMode === 'DEPOSIT' ? total : total;
    const initialRemainingStatus = paymentMode === 'DEPOSIT' ? 'PENDING' : 'NOT_APPLICABLE';

    try {
      const order = await prisma.$transaction(async (tx) => {
        const createdOrder = await tx.order.create({
          data: {
            tenantId,
            customerId: customer.id,
            fulfillmentType: fulfillmentType as any,
            street:
              fulfillmentType === FulfillmentType.DELIVERY ? normalizeText(address.street) : null,
            number:
              fulfillmentType === FulfillmentType.DELIVERY ? normalizeText(address.number) : null,
            neighborhood:
              fulfillmentType === FulfillmentType.DELIVERY
                ? normalizeText(address.neighborhood)
                : null,
            complement:
              fulfillmentType === FulfillmentType.DELIVERY
                ? normalizeText(address.complement) || null
                : null,
            deliveryFee: chargedDeliveryFee.toFixed(2),
            subtotal: subtotal.toFixed(2),
            total: total.toFixed(2),
            paymentMethod,
            paymentStatus: FINANCIAL_STATUS.PENDING,
            paymentMode,
            depositPercent: depositData.depositPercent,
            depositAmount: depositData.depositAmount.toFixed(2),
            remainingAmount: depositData.remainingAmount.toFixed(2),
            amountPaid: '0.00',
            amountDue: initialAmountDue.toFixed(2),
            remainingPaymentStatus: initialRemainingStatus,
            paidAt: null,
            notes,
            items: { create: orderItems },
          } as any,
          include: {
            customer: true,
            items: { include: { product: true } },
            invoice: { include: { payments: true } },
          },
        });

        await createOrderInvoice(tx, {
          tenantId,
          orderId: createdOrder.id,
          totalAmount: total,
          paymentMethod,
          paymentStatus: FINANCIAL_STATUS.PENDING,
        });

        if (appliedCoupon) {
          await tx.coupon.update({
            where: { id: appliedCoupon.id },
            data: { currentUses: { increment: 1 } },
          });
        }

        if (loyaltyDiscount > 0) {
          await tx.customer.update({
            where: { id: customer.id },
            data: { loyaltyBalance: { decrement: loyaltyDiscount } },
          });
        }

        return createdOrder;
      });

      // Se for pagamento online (ex: PIX ou Cartão ONLINE), geramos o link de pagamento
      if (
        paymentMode === 'DEPOSIT' ||
        cardPaymentMode === 'ONLINE' ||
        (paymentMethod === 'PIX' && process.env.ENABLE_ONLINE_PIX === 'true')
      ) {
        const transactionType = paymentMode === 'DEPOSIT' ? 'DEPOSIT_PAYMENT' : 'FULL_PAYMENT';
        const chargeAmount = paymentMode === 'DEPOSIT' ? depositData.depositAmount : total;
        const intent = await PaymentGatewayService.createPaymentLink(
          order.id,
          chargeAmount,
          tenantId,
          customer.name,
          customer.email,
          paymentMethod,
          {
            paymentMode,
            transactionType,
            metadata: {
              depositPercent: depositData.depositPercent,
              depositAmount: depositData.depositAmount,
              remainingAmount: depositData.remainingAmount,
              totalAmount: total,
            },
          },
        );

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentProvider: intent.provider,
            paymentExternalId: intent.externalId,
            paymentUrl: intent.paymentUrl,
          },
        });

        await prisma.paymentTransaction.upsert({
          where: {
            tenantId_provider_externalId: {
              tenantId,
              provider: intent.provider,
              externalId: intent.externalId,
            },
          },
          update: {
            type: transactionType,
            amount: chargeAmount.toFixed(2),
            status: FINANCIAL_STATUS.PENDING,
            rawStatus: intent.rawStatus ?? 'PENDING',
            paymentUrl: intent.paymentUrl,
            idempotencyKey: buildPaymentIdempotencyKey(order.id, transactionType),
            metadata: {
              ...(intent.metadata ?? {}),
              pixQrCode: intent.pixQrCode,
              pixQrCodeBase64: intent.pixQrCodeBase64,
            } as any,
          },
          create: {
            tenantId,
            orderId: order.id,
            provider: intent.provider,
            externalId: intent.externalId,
            type: transactionType,
            amount: chargeAmount.toFixed(2),
            status: FINANCIAL_STATUS.PENDING,
            rawStatus: intent.rawStatus ?? 'PENDING',
            paymentUrl: intent.paymentUrl,
            idempotencyKey: buildPaymentIdempotencyKey(order.id, transactionType),
            metadata: {
              ...(intent.metadata ?? {}),
              pixQrCode: intent.pixQrCode,
              pixQrCodeBase64: intent.pixQrCodeBase64,
            } as any,
          },
        });

        order.paymentUrl = intent.paymentUrl;
        (order as any).pixQrCode = intent.pixQrCode;
        (order as any).pixQrCodeBase64 = intent.pixQrCodeBase64;
      }

      emitOrderEvent(tenantId, 'order-created', order as any);

      res.status(201).json(order);

      // Enviar notificacao WhatsApp via WAHA
      if (customer.phone) {
        const msg = `🍕 Olá ${customer.name}, seu pedido #${order.id.slice(0, 6)} foi recebido!\nValor Total: R$ ${order.total}\nAcompanhe o status pelo site!`;
        sendWhatsAppMessage(customer.phone, msg);
      }
    } catch (err) {
      console.error('[Order] Erro ao finalizar pedido:', err);
      res.status(500).json({ message: 'Erro ao processar pagamento e pedido.' });
    }
  }),
);

// ─── GET /pedidos ──────────────────────────────────────────────────────────────
// Lista todos os pedidos (admin). Ordenado por data desc, com paginacao basica.
orderRoutes.get(
  ['/pedidos', '/admin/orders'],
  requireAdmin,
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
    const skip = (page - 1) * limit;

    // Filtro opcional por status.
    const statusFilter = req.query.status as OrderStatus | undefined;
    const whereClause = {
      tenantId,
      ...(statusFilter && Object.values(OrderStatus).includes(statusFilter)
        ? { status: statusFilter }
        : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          customer: true,
          items: { include: { product: true } },
          paymentTransactions: true,
          invoice: { include: { payments: true } },
        },
      }),
      prisma.order.count({ where: whereClause }),
    ]);

    res.json({
      data: orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }),
);

// ─── GET /pedidos/:id ──────────────────────────────────────────────────────────
// Busca um pedido especifico pelo id.
orderRoutes.get(
  '/pedidos/resumo',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const { date, start, end } = getDashboardDateRange(req.query.date);

    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: start,
          lt: end,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    const billableOrders = orders.filter((order) => order.status !== OrderStatus.CANCELED);
    const revenue = billableOrders.reduce((sum, order) => sum + Number(order.total), 0);
    const statusCounts = orders.reduce<Record<string, number>>((acc, order) => {
      acc[order.status] = (acc[order.status] ?? 0) + 1;
      return acc;
    }, {});

    res.json({
      date,
      orderCount: orders.length,
      billableOrderCount: billableOrders.length,
      revenue,
      averageTicket: billableOrders.length > 0 ? revenue / billableOrders.length : 0,
      statusCounts,
      orders,
    });
  }),
);

orderRoutes.post(
  '/admin/orders/:orderId/pay-remaining',
  requireAdmin,
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'CASHIER']),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const orderId = normalizeText(req.params.orderId);
    const method = normalizePaymentMethod(req.body.method, 'CASH');
    const note = normalizeText(req.body.note) || null;
    const requestedAmountCents =
      req.body.amount === undefined || req.body.amount === null
        ? null
        : moneyToCents(req.body.amount);

    if (!orderId) {
      res.status(400).json({ message: 'Pedido invalido.' });
      return;
    }

    const updatedOrder = await basePrisma
      .$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} AND "tenantId" = ${tenantId} FOR UPDATE`;

        const order = await tx.order.findFirst({
          where: { id: orderId, tenantId },
          include: { invoice: { include: { payments: true } } },
        });

        if (!order) {
          throw Object.assign(new Error('Pedido nao encontrado.'), { statusCode: 404 });
        }

        const amountDueCents = moneyToCents((order as any).amountDue ?? order.total);
        if (amountDueCents <= 0 || order.paymentStatus === FINANCIAL_STATUS.PAID) {
          throw Object.assign(new Error('Este pedido nao possui saldo pendente.'), {
            statusCode: 409,
          });
        }

        const paymentAmountCents = requestedAmountCents ?? amountDueCents;
        if (paymentAmountCents <= 0) {
          throw Object.assign(new Error('Valor do pagamento deve ser maior que zero.'), {
            statusCode: 400,
          });
        }
        if (paymentAmountCents > amountDueCents) {
          throw Object.assign(new Error('Valor informado nao pode ultrapassar o saldo pendente.'), {
            statusCode: 400,
          });
        }

        const paidAt = new Date();
        const idempotencyKey = `${buildPaymentIdempotencyKey(order.id, 'REMAINING_PAYMENT')}:${paidAt.getTime()}`;
        const amountPaidCents = moneyToCents((order as any).amountPaid ?? 0) + paymentAmountCents;
        const nextDueCents = Math.max(0, amountDueCents - paymentAmountCents);
        const nextPaymentStatus =
          nextDueCents === 0 ? FINANCIAL_STATUS.PAID : FINANCIAL_STATUS.PARTIALLY_PAID;

        await tx.paymentTransaction.create({
          data: {
            tenantId,
            orderId: order.id,
            provider: 'MANUAL',
            externalId: idempotencyKey,
            type: 'REMAINING_PAYMENT',
            amount: centsToMoney(paymentAmountCents).toFixed(2),
            status: FINANCIAL_STATUS.PAID,
            rawStatus: 'MANUAL_CONFIRMED',
            idempotencyKey,
            paidAt,
            metadata: {
              method,
              note,
              adminId: (req as any).adminId ?? null,
            },
          },
        });

        const invoice =
          order.invoice ??
          (await tx.invoice.create({
            data: {
              tenantId,
              orderId: order.id,
              totalAmount: order.total,
              status: nextPaymentStatus,
            },
          }));

        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: centsToMoney(paymentAmountCents).toFixed(2),
            method,
            status: 'COMPLETED',
            paymentDate: paidAt,
          },
        });

        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: nextPaymentStatus },
        });

        const activeShift = await tx.shift.findFirst({
          where: { tenantId, status: 'OPEN' },
        });
        if (activeShift) {
          await tx.cashTransaction.create({
            data: {
              tenantId,
              shiftId: activeShift.id,
              type: 'SALE',
              amount: centsToMoney(paymentAmountCents).toFixed(2),
              description: `Pagamento restante Pedido #${order.id.slice(0, 8)}`,
              paymentMethodId: method,
            },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: nextPaymentStatus,
            amountPaid: centsToMoney(amountPaidCents).toFixed(2),
            amountDue: centsToMoney(nextDueCents).toFixed(2),
            remainingPaymentStatus: nextDueCents === 0 ? FINANCIAL_STATUS.PAID : 'PARTIAL',
            remainingPaidAt: nextDueCents === 0 ? paidAt : null,
            paidAt: nextPaymentStatus === FINANCIAL_STATUS.PAID ? paidAt : order.paidAt,
          },
        });

        return tx.order.findFirst({
          where: { id: order.id, tenantId },
          include: {
            customer: true,
            items: { include: { product: true } },
            paymentTransactions: true,
            invoice: { include: { payments: true } },
          },
        });
      })
      .catch((error: any) => {
        throw Object.assign(error, { statusCode: error.statusCode ?? 500 });
      });

    emitOrderEvent(tenantId, 'order-updated', updatedOrder as any);
    res.json(updatedOrder);
  }),
);

orderRoutes.get(
  '/pedidos/:id',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const customerId = (req as any).customerId as string;
    const id = getIdParam(req, res);
    if (!id) return;

    const order = await prisma.order.findFirst({
      where: { id, tenantId, customerId },
      include: {
        customer: true,
        items: { include: { product: true } },
        paymentTransactions: true,
      },
    });

    if (!order) {
      res.status(404).json({ message: 'Pedido nao encontrado.' });
      return;
    }

    res.json(enrichOrderWithPix(order));
  }),
);

// ─── PATCH /pedidos/:id/status ─────────────────────────────────────────────────
// Atualiza o status de um pedido com validacao de maquina de estados.
orderRoutes.patch(
  '/pedidos/:id/status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const id = getIdParam(req, res);
    if (!id) return;

    const newStatus = req.body.status as OrderStatus;

    if (!Object.values(OrderStatus).includes(newStatus)) {
      res.status(400).json({ message: 'Status do pedido invalido.' });
      return;
    }

    // Busca o pedido atual para validar a transicao.
    const existingOrder = await prisma.order.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true, fulfillmentType: true },
    });

    if (!existingOrder) {
      res.status(404).json({ message: 'Pedido nao encontrado.' });
      return;
    }

    // Valida a transicao via maquina de estados.
    const transition = validateStatusTransition(
      existingOrder.fulfillmentType as any,
      existingOrder.status as any,
      newStatus as any,
    );

    if (!transition.ok) {
      const allowedNext = getAllowedNextStatuses(
        existingOrder.fulfillmentType as any,
        existingOrder.status as any,
      );
      res.status(422).json({
        message: transition.message,
        currentStatus: existingOrder.status,
        requestedStatus: newStatus,
        allowedNext,
      });
      return;
    }

    let order;
    try {
      order = await basePrisma.$transaction(async (tx) => {
        if (
          newStatus === OrderStatus.PREPARING ||
          newStatus === OrderStatus.READY ||
          newStatus === OrderStatus.DELIVERED
        ) {
          await InventoryService.deductStockForOrderOrThrow(id, tenantId, tx);
        }

        const orderUpdateData: Record<string, unknown> = { status: newStatus };
        if (newStatus === OrderStatus.CANCELED) {
          orderUpdateData.paymentStatus = FINANCIAL_STATUS.CANCELED;
          orderUpdateData.paidAt = null;
          await tx.invoice.updateMany({
            where: { tenantId, orderId: id },
            data: { status: FINANCIAL_STATUS.CANCELED },
          });
        }

        const updatedOrder = await tx.order.updateMany({
          where: { id, tenantId, status: existingOrder.status },
          data: orderUpdateData,
        });
        if (updatedOrder.count !== 1) {
          throw Object.assign(
            new Error('Pedido foi alterado por outra operacao. Atualize e tente novamente.'),
            { statusCode: 409 },
          );
        }

        if (newStatus === OrderStatus.PREPARING) {
          await tx.orderItem.updateMany({
            where: { orderId: id, order: { tenantId } },
            data: { kdsStatus: 'PREPARING', kdsStartedAt: new Date() },
          });
        }

        if (newStatus === OrderStatus.READY) {
          await tx.orderItem.updateMany({
            where: { orderId: id, order: { tenantId } },
            data: { kdsStatus: 'READY', kdsReadyAt: new Date() },
          });
        }

        await tx.orderStatusEvent.create({
          data: {
            tenantId,
            orderId: id,
            actorId: (req as any).adminId ?? null,
            source: 'ADMIN_ORDER_STATUS',
            previousStatus: existingOrder.status,
            newStatus,
            note: normalizeText(req.body.note) || null,
          },
        });

        return tx.order.findFirst({
          where: { id, tenantId },
          include: {
            customer: true,
            items: { include: { product: true } },
          },
        });
      });
    } catch (transitionError: any) {
      res.status(transitionError.statusCode ?? 409).json({
        message: transitionError.message || 'Nao foi possivel alterar o status do pedido.',
        availability: transitionError.availability,
      });
      return;
    }

    if (!order) {
      res.status(404).json({ message: 'Pedido nao encontrado.' });
      return;
    }

    emitOrderEvent(tenantId, 'order-status-changed', {
      id: order.id,
      status: order.status,
      previousStatus: existingOrder.status,
      updatedAt: order.updatedAt,
    });
    emitOrderEvent(tenantId, 'order-updated', order as any);

    IfoodService.syncOrderStatus(order.id, newStatus).catch((error) => {
      console.error('[iFood] Falha ao sincronizar status externo:', error);
    });

    // Se o pedido for finalizado com sucesso, registra as estatisticas (Loyalty & CRM)
    if (newStatus === OrderStatus.DELIVERED || newStatus === OrderStatus.READY) {
      if (order.customer) {
        import('../services/crm.service.js')
          .then(({ CRMService }) =>
            CRMService.recordOrderStats(order.tenantId, order.customer!.id, Number(order.total)),
          )
          .catch((err) => console.error('[CRM] Erro ao registrar estatisticas:', err));
      }
    }

    // Notificacao via WhatsApp assincrona (nao trava a request)
    if (order.customer?.phone) {
      import('../services/whatsapp.service.js')
        .then(({ WhatsAppService }) => {
          WhatsAppService.notifyOrderStatus(
            order.customer.phone!,
            order.customer.name,
            newStatus,
            order.id,
          );
        })
        .catch((err) => console.error('[WhatsAppService] Falha ao importar servico:', err));
    }

    res.json(order);
  }),
);

// ─── GET /pedidos/rastrear/:identifier ──────────────────────────────────────────
// Retorna um pedido específico por ID ou telefone do cliente (para o OrderStatus.jsx).
orderRoutes.get(
  '/pedidos/rastrear/:identifier',
  asyncHandler(async (req, res) => {
    const identifier = String(req.params.identifier);
    const tenantId = getTenantId();

    // Tenta primeiro buscar por ID do pedido
    let order = await prisma.order.findFirst({
      where: {
        id: identifier,
        tenantId,
      },
      include: {
        customer: true,
        items: true,
        paymentTransactions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Se não encontrou por ID, tenta buscar pelo telefone do cliente (o último pedido dele)
    if (!order) {
      const phoneDigits = identifier.replace(/\D/g, '');
      if (phoneDigits.length >= 8) {
        order = await prisma.order.findFirst({
          where: {
            tenantId,
            customer: {
              phone: {
                contains: phoneDigits,
              },
            },
          },
          include: {
            customer: true,
            items: true,
            paymentTransactions: true,
          },
          orderBy: { createdAt: 'desc' },
        });
      }
    }

    if (!order) {
      res.status(404).json({ message: 'Pedido não encontrado para este ID ou Telefone.' });
      return;
    }

    res.json(enrichOrderWithPix(order));
  }),
);

// ─── POST /admin/pos/checkout ──────────────────────────────────────────────────
// Cria um pedido diretamente pelo PDV (Frente de Caixa), sem exigir login do cliente.
orderRoutes.post(
  '/admin/pos/checkout',
  requireAdmin,
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'CASHIER']),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();

    // Para pedidos de balcão, usaremos PICKUP por padrão (ou o front pode mandar DELIVERY se preencher endereço)
    const fulfillmentType = req.body.fulfillmentType || FulfillmentType.PICKUP;
    const paymentMethod = normalizePaymentMethod(req.body.paymentMethod, 'CASH');
    const paidAt = new Date();

    const rawItems = Array.isArray(req.body.items) ? (req.body.items as OrderItemInput[]) : [];
    if (rawItems.length === 0) {
      res.status(400).json({ message: 'Adicione pelo menos um item ao pedido.' });
      return;
    }

    // 1. Cliente Genérico (Balcão)
    let customer = await prisma.customer.findFirst({
      where: { tenantId, email: 'balcao@pizzaria.local' },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          tenantId,
          name: 'Cliente Balcão',
          email: 'balcao@pizzaria.local',
          phone: '00000000000',
        },
      });
    }

    // 2. Resolver Itens
    const halfAndHalfInputs = rawItems.map(getHalfAndHalfInput);
    const productIds = [
      ...new Set([
        ...rawItems.map((item) => normalizeText(item.productId)),
        ...halfAndHalfInputs.map((item) => item?.secondProductId ?? ''),
      ]),
    ].filter(Boolean) as string[];
    const variantIds = [
      ...new Set([
        ...rawItems.map((item) => normalizeText(item.variantId)),
        ...halfAndHalfInputs.map((item) => item?.secondVariantId ?? ''),
      ]),
    ].filter(Boolean) as string[];
    const optionIds = [...new Set(rawItems.flatMap((item) => getItemOptionIds(item)))];

    const [foundProducts, foundVariants, globalOptions, productOptions] = await Promise.all([
      prisma.product.findMany({
        where: { tenantId, id: { in: productIds }, isAvailable: true },
        include: { menuCategory: true },
      }),
      variantIds.length > 0
        ? prisma.productVariant.findMany({
            where: { product: { tenantId }, id: { in: variantIds }, isAvailable: true },
          })
        : Promise.resolve([]),
      optionIds.length > 0
        ? prisma.productOption.findMany({
            where: { tenantId, id: { in: optionIds }, isAvailable: true },
          })
        : Promise.resolve([]),
      optionIds.length > 0
        ? prisma.productOptionItem.findMany({
            where: { group: { tenantId }, id: { in: optionIds }, isAvailable: true },
          })
        : Promise.resolve([]),
    ]);
    const foundOptions = [...globalOptions, ...productOptions];

    const productsById = new Map(foundProducts.map((p) => [p.id, p]));
    const variantsById = new Map(foundVariants.map((v) => [v.id, v]));
    const optionsById = new Map(foundOptions.map((o) => [o.id, o]));

    const orderItems: any[] = [];
    let subtotal = 0;

    for (const item of rawItems) {
      const productId = normalizeText(item.productId);
      const product = productId ? productsById.get(productId) : undefined;
      if (!product) {
        res.status(400).json({ message: `Produto inválido: ${productId}` });
        return;
      }

      const variantId = normalizeText(item.variantId);
      const variant = variantId ? variantsById.get(variantId) : undefined;
      const itemOptionIds = getItemOptionIds(item);
      const selectedOptions = itemOptionIds
        .map((id) => optionsById.get(id))
        .filter(Boolean) as typeof foundOptions;
      if (selectedOptions.length !== itemOptionIds.length) {
        res
          .status(400)
          .json({ message: `Um adicional do item "${product.name}" nao esta disponivel.` });
        return;
      }

      const halfAndHalfInput = getHalfAndHalfInput(item);
      let halfAndHalfData: any = null;
      let secondProduct: any = undefined;
      let secondVariant: any = undefined;

      if (halfAndHalfInput) {
        if (!halfAndHalfInput.secondProductId) {
          res
            .status(400)
            .json({ message: `Selecione o segundo sabor da meia-meia de "${product.name}".` });
          return;
        }
        secondProduct = productsById.get(halfAndHalfInput.secondProductId);
        if (!secondProduct || !secondProduct.isAvailable || !secondProduct.allowHalfAndHalf) {
          res.status(400).json({ message: `O sabor compatível selecionado não está disponível.` });
          return;
        }
        secondVariant = halfAndHalfInput.secondVariantId
          ? variantsById.get(halfAndHalfInput.secondVariantId)
          : undefined;
        if (halfAndHalfInput.secondVariantId && (!secondVariant || !secondVariant.isAvailable)) {
          res
            .status(400)
            .json({ message: `O tamanho selecionado para a metade não está disponível.` });
          return;
        }
        halfAndHalfData = {
          firstProductId: product.id,
          firstProductName: product.name,
          firstVariantId: variant?.id ?? null,
          firstVariantName: variant?.name ?? null,
          secondProductId: secondProduct.id,
          secondProductName: secondProduct.name,
          secondVariantId: secondVariant?.id ?? null,
          secondVariantName: secondVariant?.name ?? null,
          priceRule: 'HIGHER_HALF_PRICE',
        };
      }

      const quantity = Number(item.quantity) || 1;
      const baseUnitPrice = halfAndHalfData
        ? Math.max(
            Number(variant?.price ?? product.price),
            Number(secondVariant?.price ?? secondProduct?.price ?? 0),
          )
        : Number(variant?.price ?? product.price);
      const optionsTotal = selectedOptions.reduce((sum, opt) => sum + Number(opt.price), 0);
      const unitPrice = baseUnitPrice + optionsTotal;
      const itemTotal = unitPrice * quantity;

      subtotal += itemTotal;

      const computedCustomizations = [
        halfAndHalfData
          ? `Meia-meia: ${halfAndHalfData.firstProductName} / ${halfAndHalfData.secondProductName}`
          : '',
        variant ? `Tamanho: ${variant.name}` : '',
        ...selectedOptions.map((opt) => `${opt.name} (+R$ ${Number(opt.price).toFixed(2)})`),
      ]
        .filter(Boolean)
        .join(', ');

      const station = resolveKdsStation(
        product as any,
        (product as any).menuCategory,
        product.name,
      );
      const prepTime = resolvePrepTimeMinutes(
        station,
        (product as any).prepTimeMinutes,
        (product as any).menuCategory?.prepTimeMinutes,
      );

      orderItems.push({
        productId: product.id,
        variantId: variant?.id ?? null,
        displayName: halfAndHalfData
          ? `Meia-meia: ${halfAndHalfData.firstProductName} / ${halfAndHalfData.secondProductName}`
          : product.name,
        customizations: computedCustomizations || null,
        variantName: variant?.name ?? null,
        optionsSnapshot:
          selectedOptions.length > 0 || halfAndHalfData
            ? JSON.stringify({
                halfAndHalf: halfAndHalfData,
                options: selectedOptions.map(optionStockSnapshot),
              })
            : null,
        quantity,
        basePrice: baseUnitPrice.toFixed(2),
        optionsTotal: optionsTotal.toFixed(2),
        unitPrice: unitPrice.toFixed(2),
        total: itemTotal.toFixed(2),
        kdsStation: station,
        prepTimeMinutes: prepTime,
      });
    }

    try {
      await ProductAvailabilityService.assertSelectionsAvailable(
        tenantId,
        getAvailabilitySelections(rawItems),
      );
    } catch (availabilityError: any) {
      res.status(availabilityError.statusCode ?? 409).json({
        message: availabilityError.message,
        availability: availabilityError.availability,
      });
      return;
    }

    // 3. Taxas e Totais
    const settings = await getStoreSettings();
    const deliveryFee =
      fulfillmentType === FulfillmentType.DELIVERY ? Number(settings.deliveryFee) : 0;
    const totalFees = deliveryFee + Number(settings.serviceFee);
    const total = subtotal + totalFees;

    // 4. Salvar Pedido
    try {
      const order = await basePrisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            tenantId,
            customerId: customer!.id,
            fulfillmentType,
            status: 'PREPARING', // O caixa já confirma o pedido direto para a cozinha
            origin: 'SITE_PROPRIO',
            deliveryFee: totalFees.toFixed(2),
            subtotal: subtotal.toFixed(2),
            total: total.toFixed(2),
            paymentMethod,
            paymentStatus: FINANCIAL_STATUS.PAID,
            paidAt,
            notes: req.body.notes || null,
            items: { create: orderItems },
          },
          include: { customer: true, items: { include: { product: true } } },
        });

        await createOrderInvoice(tx, {
          tenantId,
          orderId: created.id,
          totalAmount: total,
          paymentMethod,
          paymentStatus: FINANCIAL_STATUS.PAID,
          paidAt,
          createPayment: true,
        });

        await tx.orderItem.updateMany({
          where: { orderId: created.id, order: { tenantId } },
          data: { kdsStatus: 'PREPARING', kdsStartedAt: new Date() },
        });

        await InventoryService.deductStockForOrderOrThrow(created.id, tenantId, tx);

        await tx.orderStatusEvent.create({
          data: {
            tenantId,
            orderId: created.id,
            actorId: (req as any).adminId ?? null,
            source: 'POS_CHECKOUT',
            previousStatus: null,
            newStatus: OrderStatus.PREPARING,
            note: 'Pedido criado no PDV e enviado para preparo.',
          },
        });

        const activeShift = await tx.shift.findFirst({
          where: { tenantId, status: 'OPEN' },
        });

        if (activeShift) {
          await tx.cashTransaction.create({
            data: {
              tenantId,
              shiftId: activeShift.id,
              type: 'SALE',
              amount: total.toFixed(2),
              description: `Venda PDV Pedido #${created.id.slice(0, 8)}`,
              paymentMethodId: paymentMethod,
            },
          });
        }

        return tx.order.findFirst({
          where: { id: created.id, tenantId },
          include: { customer: true, items: { include: { product: true } } },
        });
      });

      emitOrderEvent(tenantId, 'order-created', order as any);

      res.status(201).json(order);
    } catch (err: any) {
      console.error('[POS] Erro ao criar pedido:', err);
      res.status(err.statusCode ?? 500).json({
        message: err.message || 'Erro ao processar o pedido no caixa.',
        availability: err.availability,
      });
    }
  }),
);
