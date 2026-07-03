import { OrderOrigin } from '../../../generated/prisma/index.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../utils/logger.js';
import { resolveKdsStation, resolvePrepTimeMinutes } from '../../utils/kdsHelpers.js';
import type { NormalizedExternalOrder, NormalizedOrderItem } from './types.js';

function cleanNumber(value: unknown, fallback = 0) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? number : fallback;
}

function getExternalCustomerEmail(order: NormalizedExternalOrder) {
  if (order.customer.email) {
    return order.customer.email.toLowerCase();
  }

  const safeId = order.customer.externalId || order.externalId;
  return `${order.origin.toLowerCase()}-${safeId}@external.local`;
}

async function ensureExternalCustomer(order: NormalizedExternalOrder) {
  const email = getExternalCustomerEmail(order);
  const existing = await prisma.customer.findFirst({ where: { email } });

  if (existing) {
    return existing;
  }

  return prisma.customer.create({
    data: {
      name: order.customer.name || 'Cliente externo',
      email,
      phone: order.customer.phone ?? null,
      street: order.address?.street ?? null,
      neighborhood: order.address?.neighborhood ?? null,
    } as any,
  });
}

async function ensureExternalProduct(item: NormalizedOrderItem, origin: OrderOrigin) {
  const name = item.name || 'Item externo';
  const existing = await prisma.product.findFirst({
    where: {
      name,
      category: 'integracoes',
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.product.create({
    data: {
      name,
      description: `Produto importado automaticamente de ${origin}.`,
      category: 'integracoes',
      price: cleanNumber(item.unitPrice).toFixed(2),
      imageUrl: item.imageUrl ?? null,
      isAvailable: false,
    } as any,
  });
}

function getDisplayName(item: NormalizedOrderItem) {
  const notes = item.notes ? ` | ${item.notes}` : '';
  return `${item.name}${notes}`;
}

export class ExternalOrderIngestionService {
  static async upsertExternalOrder(order: NormalizedExternalOrder) {
    const existing = await prisma.order.findFirst({
      where: {
        origin: order.origin,
        externalId: order.externalId,
      },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    if (existing) {
      const updated = await prisma.order.update({
        where: { id: existing.id },
        data: {
          status: order.status,
          subtotal: cleanNumber(order.subtotal).toFixed(2),
          deliveryFee: cleanNumber(order.deliveryFee).toFixed(2),
          total: cleanNumber(order.total).toFixed(2),
          notes: order.notes ?? existing.notes,
        },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
      });

      return { order: updated, created: false };
    }

    const customer = await ensureExternalCustomer(order);
    const items = [];

    for (const item of order.items) {
      const product = await ensureExternalProduct(item, order.origin);
      const quantity = Math.max(1, Math.round(cleanNumber(item.quantity, 1)));
      const unitPrice = cleanNumber(item.unitPrice);
      const total = cleanNumber(item.total, unitPrice * quantity);
      const station = resolveKdsStation(product as any, null, item.name);
      const prepTime = resolvePrepTimeMinutes(station, (product as any).prepTimeMinutes, null);

      items.push({
        productId: product.id,
        displayName: getDisplayName(item),
        customizations: item.notes ?? null,
        imageUrl: item.imageUrl ?? null,
        quantity,
        basePrice: unitPrice.toFixed(2),
        optionsTotal: '0.00',
        unitPrice: unitPrice.toFixed(2),
        total: total.toFixed(2),
        kdsStation: station,
        prepTimeMinutes: prepTime,
      });
    }

    if (items.length === 0) {
      logger.warn(
        '[Integrations] Pedido externo sem itens ignorado:',
        order.origin,
        order.externalId,
      );
      throw Object.assign(new Error('Pedido externo sem itens.'), { statusCode: 400 });
    }

    const created = await prisma.order.create({
      data: {
        customerId: customer.id,
        fulfillmentType: order.fulfillmentType,
        origin: order.origin,
        externalId: order.externalId,
        externalMerchantId: order.externalMerchantId ?? null,
        status: order.status,
        street: order.fulfillmentType === 'DELIVERY' ? (order.address?.street ?? null) : null,
        number: order.fulfillmentType === 'DELIVERY' ? (order.address?.number ?? null) : null,
        neighborhood:
          order.fulfillmentType === 'DELIVERY' ? (order.address?.neighborhood ?? null) : null,
        complement:
          order.fulfillmentType === 'DELIVERY' ? (order.address?.complement ?? null) : null,
        subtotal: cleanNumber(order.subtotal).toFixed(2),
        deliveryFee: cleanNumber(order.deliveryFee).toFixed(2),
        total: cleanNumber(order.total).toFixed(2),
        notes: order.notes ?? null,
        items: { create: items },
      } as any,
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    return { order: created, created: true };
  }
}
