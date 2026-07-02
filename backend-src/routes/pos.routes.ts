import { Router } from 'express';

import { basePrisma, prisma } from '../lib/prisma.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { normalizeText, parseMoney } from '../utils/normalize.js';
import { FINANCIAL_STATUS, normalizePaymentMethod } from '../services/orderFinancial.service.js';
import { emitOrderEvent } from '../services/orderEvents.service.js';

const posRouter = Router();

posRouter.use(requireAdmin);

function parseCurrency(value: unknown, fallback = 0) {
  const parsed = parseMoney(value);
  return parsed === null ? fallback : Number(parsed);
}

function parseQuantity(value: unknown) {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 && quantity <= 99 ? quantity : null;
}

function getItemOptionIds(item: any) {
  const ids = new Set<string>();
  const addId = (value: unknown) => {
    const id = normalizeText(value);
    if (id) ids.add(id);
  };

  if (Array.isArray(item.optionIds)) item.optionIds.forEach(addId);
  if (Array.isArray(item.addonIds)) item.addonIds.forEach(addId);
  if (Array.isArray(item.addons)) item.addons.forEach((addon: any) => addId(addon?.id));
  addId(item.crustId);
  addId(item.crust?.id);

  return [...ids];
}

type PosOrderItemInput = {
  productId: string;
  variantId: string | null;
  optionIds: string[];
  quantity: number | null;
  customizations: string | null;
};

type ValidPosOrderItemInput = {
  productId: string;
  variantId: string | null;
  optionIds: string[];
  quantity: number;
  customizations: string | null;
};

function buildShiftSummary(shift: any) {
  const transactions = Array.isArray(shift?.transactions) ? shift.transactions : [];
  const openingCash = Number(shift?.openingCash ?? 0);
  const salesByMethod: Record<string, number> = transactions
    .filter((transaction: any) => transaction.type === 'SALE')
    .reduce((summary: Record<string, number>, transaction: any) => {
      const method = transaction.paymentMethodId || 'UNKNOWN';
      summary[method] = (summary[method] ?? 0) + Number(transaction.amount ?? 0);
      return summary;
    }, {} as Record<string, number>);
  const sangria = transactions
    .filter((transaction: any) => transaction.type === 'SANGRIA')
    .reduce((total: number, transaction: any) => total + Number(transaction.amount ?? 0), 0);
  const suprimento = transactions
    .filter((transaction: any) => transaction.type === 'SUPRIMENTO')
    .reduce((total: number, transaction: any) => total + Number(transaction.amount ?? 0), 0);
  const cashSales = Number(salesByMethod.CASH ?? 0);
  const expectedClosingCash = openingCash + cashSales + suprimento - sangria;
  const actualClosingCash =
    shift?.actualClosingCash === null || shift?.actualClosingCash === undefined
      ? null
      : Number(shift.actualClosingCash);

  return {
    openingCash,
    salesByMethod,
    totalSales: Object.values(salesByMethod).reduce(
      (total: number, value: number) => total + value,
      0,
    ),
    sangria,
    suprimento,
    expectedClosingCash,
    actualClosingCash,
    difference:
      actualClosingCash === null ? null : Number((actualClosingCash - expectedClosingCash).toFixed(2)),
    transactions: transactions.map((transaction: any) => ({
      id: transaction.id,
      type: transaction.type,
      amount: Number(transaction.amount ?? 0),
      description: transaction.description,
      paymentMethodId: transaction.paymentMethodId,
      createdAt: transaction.createdAt,
    })),
  };
}

async function findShiftWithSummary(tenantId: string, shiftId?: string) {
  const shift = shiftId
    ? await prisma.shift.findFirst({
        where: { id: shiftId, tenantId },
        include: {
          admin: true,
          cashRegister: true,
          transactions: { orderBy: { createdAt: 'desc' } },
        },
      })
    : await prisma.shift.findFirst({
        where: { tenantId, status: 'OPEN' },
        orderBy: { startTime: 'desc' },
        include: {
          admin: true,
          cashRegister: true,
          transactions: { orderBy: { createdAt: 'desc' } },
        },
      });

  return shift ? { ...shift, summary: buildShiftSummary(shift) } : null;
}

posRouter.get(
  '/shift/registers',
  asyncHandler(async (_req, res) => {
    const tenantId = getTenantId();
    let registers = await prisma.cashRegister.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });

    if (registers.length === 0) {
      const defaultRegister = await prisma.cashRegister.create({
        data: { tenantId, name: 'Caixa Principal' },
      });
      registers = [defaultRegister];
    }

    res.json(registers);
  }),
);

posRouter.post(
  '/shift/registers',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const name = normalizeText(req.body.name);
    if (!name) {
      res.status(400).json({ message: 'O nome do caixa e obrigatorio.' });
      return;
    }
    const register = await prisma.cashRegister.create({
      data: { tenantId, name },
    });
    res.status(201).json(register);
  }),
);

posRouter.get(
  '/shift/current',
  asyncHandler(async (_req, res) => {
    const tenantId = getTenantId();
    const shift = await findShiftWithSummary(tenantId);
    res.json(shift);
  }),
);

posRouter.get(
  '/shift/:shiftId/summary',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const shiftId = normalizeText(req.params.shiftId);
    const shift = await findShiftWithSummary(tenantId, shiftId);
    if (!shift) {
      res.status(404).json({ message: 'Caixa nao encontrado.' });
      return;
    }
    res.json(shift.summary);
  }),
);

posRouter.post(
  '/shift/open',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const adminId = (req as any).adminId;
    const openingCash = parseCurrency(req.body.openingCash, 0);

    const cashRegisterId = normalizeText(req.body.cashRegisterId);

    if (!cashRegisterId) {
      res.status(400).json({ message: 'Caixa (cashRegisterId) e obrigatorio.' });
      return;
    }

    const activeShift = await prisma.shift.findFirst({
      where: { tenantId, cashRegisterId, status: 'OPEN' },
    });

    if (activeShift) {
      res.status(400).json({ message: 'Este caixa ja esta aberto.' });
      return;
    }

    const shift = await prisma.shift.create({
      data: {
        tenantId,
        cashRegisterId,
        adminId,
        openingCash: openingCash.toFixed(2),
        status: 'OPEN',
      },
    });

    res.status(201).json(shift);
  }),
);

posRouter.post(
  '/shift/close',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const shiftId = normalizeText(req.body.shiftId);
    const closingCash = parseCurrency(req.body.closingCash, 0);

    if (!shiftId) {
      res.status(400).json({ message: 'Informe o caixa.' });
      return;
    }

    const shift = await prisma.shift.findFirst({ where: { id: shiftId, tenantId } });
    if (!shift || shift.status === 'CLOSED') {
      res.status(400).json({ message: 'Caixa nao encontrado ou ja fechado.' });
      return;
    }

    const shiftWithTransactions = await findShiftWithSummary(tenantId, shiftId);
    const expectedClosingCash = Number(shiftWithTransactions?.summary.expectedClosingCash ?? 0);
    const difference = closingCash - expectedClosingCash;

    const updatedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        expectedClosingCash: expectedClosingCash.toFixed(2),
        actualClosingCash: closingCash.toFixed(2),
        difference: difference.toFixed(2),
        status: 'CLOSED',
        endTime: new Date(),
        closedById: (req as any).adminId,
      },
      include: {
        admin: true,
        cashRegister: true,
        transactions: { orderBy: { createdAt: 'desc' } },
      },
    });

    res.json({ ...updatedShift, summary: buildShiftSummary(updatedShift) });
  }),
);

posRouter.post(
  '/shift/transaction',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const shiftId = normalizeText(req.body.shiftId);
    const type = normalizeText(req.body.type); // SANGRIA, SUPRIMENTO
    const amount = parseCurrency(req.body.amount, 0);
    const description = normalizeText(req.body.description);

    if (!shiftId || !type || amount <= 0) {
      res.status(400).json({ message: 'Dados invalidos para transacao.' });
      return;
    }

    if (!['SANGRIA', 'SUPRIMENTO'].includes(type.toUpperCase())) {
      res.status(400).json({ message: 'Tipo de transacao invalido.' });
      return;
    }

    const shift = await prisma.shift.findFirst({ where: { id: shiftId, tenantId, status: 'OPEN' } });
    if (!shift) {
      res.status(400).json({ message: 'Caixa nao encontrado ou fechado.' });
      return;
    }

    const transaction = await prisma.cashTransaction.create({
      data: {
        tenantId,
        shiftId,
        type: type.toUpperCase(),
        amount: amount.toFixed(2),
        description,
      },
    });

    res.status(201).json(transaction);
  }),
);

posRouter.post(
  '/orders',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    const tableName = normalizeText(req.body.tableName) || 'Balcao';
    const attendant = normalizeText(req.body.attendant) || 'PDV';
    const paymentMethod = normalizePaymentMethod(req.body.paymentMethod, 'CASH');
    const notes = normalizeText(req.body.notes) || null;
    const paidAt = new Date();

    if (rawItems.length === 0) {
      res.status(400).json({ message: 'Adicione pelo menos um item ao pedido.' });
      return;
    }

    const normalizedItems: PosOrderItemInput[] = rawItems.map((item: any) => ({
      productId: normalizeText(item.productId ?? item.id),
      variantId: normalizeText(item.variantId) || null,
      optionIds: getItemOptionIds(item),
      quantity: parseQuantity(item.quantity ?? item.qty),
      customizations: normalizeText(item.customizations) || null,
    }));

    if (normalizedItems.some((item) => !item.productId || item.quantity === null)) {
      res.status(400).json({ message: 'Itens do pedido invalidos.' });
      return;
    }

    const validItems = normalizedItems as ValidPosOrderItemInput[];

    const result = await basePrisma.$transaction(async (tx) => {
      const productIds = [...new Set(validItems.map((item) => item.productId))];
      const variantIds = [
        ...new Set(validItems.map((item) => item.variantId).filter(Boolean)),
      ] as string[];
      const optionIds = [...new Set(validItems.flatMap((item) => item.optionIds))];
      const [products, variants, options] = await Promise.all([
        tx.product.findMany({
          where: { tenantId, id: { in: productIds }, isAvailable: true },
        }),
        variantIds.length > 0
          ? tx.productVariant.findMany({
              where: { tenantId, id: { in: variantIds }, isAvailable: true },
            })
          : Promise.resolve([]),
        optionIds.length > 0
          ? tx.productOption.findMany({
              where: { tenantId, id: { in: optionIds }, isAvailable: true },
            })
          : Promise.resolve([]),
      ]);
      const productsById = new Map(products.map((product) => [product.id, product]));
      const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
      const optionsById = new Map(options.map((option) => [option.id, option]));

      if (products.length !== productIds.length) {
        throw Object.assign(new Error('Produto indisponivel ou nao encontrado.'), {
          statusCode: 400,
        });
      }

      const customer = await tx.customer.upsert({
        where: {
          tenantId_email: {
            tenantId,
            email: 'balcao@pos.local',
          },
        },
        update: { name: 'Cliente Balcao' },
        create: {
          tenantId,
          name: 'Cliente Balcao',
          email: 'balcao@pos.local',
        },
      });

      let subtotal = 0;
      const orderItems = validItems.map((item) => {
        const product = productsById.get(item.productId)!;
        const variant = item.variantId ? variantsById.get(item.variantId) : undefined;
        if (item.variantId && (!variant || variant.productId !== product.id)) {
          throw Object.assign(new Error('Variacao indisponivel ou nao encontrada.'), {
            statusCode: 400,
          });
        }

        const selectedOptions = item.optionIds.map((id) => optionsById.get(id)).filter(Boolean);
        if (selectedOptions.length !== item.optionIds.length) {
          throw Object.assign(new Error('Adicional ou borda indisponivel.'), {
            statusCode: 400,
          });
        }

        const basePrice = Number(variant?.price ?? product.price);
        const optionsTotal = selectedOptions.reduce(
          (sum, option) => sum + Number(option?.price ?? 0),
          0,
        );
        const unitPrice = basePrice + optionsTotal;
        const quantity = item.quantity;
        const total = unitPrice * quantity;
        subtotal += total;
        const computedCustomizations = [
          variant ? `Tamanho: ${variant.name}` : '',
          ...selectedOptions.map(
            (option) => `${option?.name} (+R$ ${Number(option?.price ?? 0).toFixed(2)})`,
          ),
        ]
          .filter(Boolean)
          .join(', ');

        return {
          productId: product.id,
          variantId: variant?.id ?? null,
          displayName: product.name,
          customizations: item.customizations || computedCustomizations || null,
          variantName: variant?.name ?? null,
          optionsSnapshot:
            selectedOptions.length > 0
              ? JSON.stringify(
                  selectedOptions.map((option) => ({
                    id: option?.id,
                    type: option?.type,
                    name: option?.name,
                    price: Number(option?.price ?? 0),
                  })),
                )
              : null,
          imageUrl: product.imageUrl,
          quantity,
          basePrice: basePrice.toFixed(2),
          optionsTotal: optionsTotal.toFixed(2),
          unitPrice: unitPrice.toFixed(2),
          total: total.toFixed(2),
        };
      });

      const order = await tx.order.create({
        data: {
          tenantId,
          customerId: customer.id,
          fulfillmentType: 'PICKUP',
          status: 'PENDING',
          paymentMethod,
          paymentStatus: FINANCIAL_STATUS.PAID,
          paidAt,
          subtotal: subtotal.toFixed(2),
          deliveryFee: '0.00',
          total: subtotal.toFixed(2),
          notes: [tableName, attendant, notes].filter(Boolean).join(' | '),
          items: { create: orderItems },
        },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
      });

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          orderId: order.id,
          totalAmount: subtotal.toFixed(2),
          status: 'PAID',
          payments: {
            create: {
              amount: subtotal.toFixed(2),
              method: paymentMethod,
              status: 'COMPLETED',
            },
          },
        },
        include: { payments: true },
      });

      // Se for pagamento em CASH e existir um Shift aberto, devemos registrar a venda no caixa!
      if (paymentMethod === 'CASH') {
        const activeShift = await tx.shift.findFirst({
          where: { tenantId, status: 'OPEN' },
        });

        if (activeShift) {
          await tx.cashTransaction.create({
            data: {
              tenantId,
              shiftId: activeShift.id,
              type: 'SALE',
              amount: subtotal.toFixed(2),
              description: `Venda do Pedido #${order.id.slice(0, 8)}`,
              paymentMethodId: paymentMethod,
            },
          });
        }
      }

      return { order, invoice };
    });

    emitOrderEvent(tenantId, 'order-created', result.order as any);
    res.status(201).json(result);
  }),
);

export { posRouter };
