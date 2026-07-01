import { OrderOrigin } from '../../../generated/prisma/index.js';
import type { NormalizedExternalOrder, NormalizedOrderItem } from '../core/types.js';

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function money(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(',', '.'));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

function quantity(value: unknown) {
  const parsed = Number(value ?? 1);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function mapStatus(payload: any) {
  const code = text(
    payload.status,
    payload.orderStatus,
    payload.code,
    payload.fullCode,
  ).toUpperCase();

  if (code.includes('CANCEL')) return 'CANCELED';
  if (code.includes('DISPATCH') || code.includes('DELIVERY')) return 'OUT_FOR_DELIVERY';
  if (code.includes('READY')) return 'READY';
  if (code.includes('CONFIRM') || code.includes('PREPAR') || code.includes('PLACED'))
    return 'PREPARING';

  return 'PENDING';
}

function mapFulfillmentType(payload: any): 'PICKUP' | 'DELIVERY' {
  const mode = text(
    payload.delivery?.mode,
    payload.delivery?.deliveredBy,
    payload.orderType,
    payload.takeout?.mode,
  ).toUpperCase();

  if (mode.includes('TAKEOUT') || mode.includes('PICKUP')) {
    return 'PICKUP';
  }

  return 'DELIVERY';
}

function getCustomer(payload: any) {
  const customer = payload.customer ?? {};
  const phone = customer.phone ?? {};

  return {
    externalId: text(customer.id, customer.uuid, customer.documentNumber),
    name: text(customer.name, customer.completeName, customer.firstName, 'Cliente iFood'),
    email: text(customer.email) || null,
    phone: text(phone.number, phone.localizer, customer.phoneNumber, customer.phone) || null,
  };
}

function getAddress(payload: any) {
  const address =
    payload.delivery?.deliveryAddress ?? payload.deliveryAddress ?? payload.address ?? {};

  return {
    street: text(address.streetName, address.street, address.formattedAddress) || null,
    number: text(address.streetNumber, address.number) || null,
    neighborhood: text(address.neighborhood, address.district) || null,
    complement: text(address.complement, address.reference) || null,
  };
}

function getItemOptions(item: any) {
  const options = Array.isArray(item.options) ? item.options : [];
  return options
    .map((option: any) => {
      const name = text(option.name, option.description);
      if (!name) return null;
      const price = money(option.price, option.unitPrice, option.totalPrice);
      return `${name}${price > 0 ? ` (+R$ ${price.toFixed(2)})` : ''}`;
    })
    .filter(Boolean)
    .join(', ');
}

function getItems(payload: any): NormalizedOrderItem[] {
  const rawItems = Array.isArray(payload.items) ? payload.items : [];

  return rawItems.map((item: any) => {
    const qty = quantity(item.quantity);
    const unitPrice = money(item.unitPrice, item.price, item.unitValue);
    const total = money(item.totalPrice, item.total, unitPrice * qty);
    const optionText = getItemOptions(item);
    const notes = [text(item.observations, item.notes), optionText].filter(Boolean).join(' | ');

    return {
      externalId: text(item.id, item.externalCode),
      name: text(item.name, item.description, 'Item iFood'),
      quantity: qty,
      unitPrice,
      total,
      notes: notes || null,
      imageUrl: text(item.imageUrl) || null,
    };
  });
}

export class IfoodAdapter {
  static normalizeOrder(payload: any): NormalizedExternalOrder {
    const externalId = text(payload.id, payload.orderId, payload.externalId);
    const merchantId = text(payload.merchant?.id, payload.merchantId, payload.storeId);
    const fulfillmentType = mapFulfillmentType(payload);
    const totals = payload.total ?? payload.totals ?? {};
    const delivery = payload.delivery ?? {};
    const items = getItems(payload);
    const subtotal = money(totals.subTotal, totals.itemsPrice, payload.subtotal);
    const deliveryFee = money(totals.deliveryFee, delivery.fee, payload.deliveryFee);
    const total = money(
      totals.orderAmount,
      totals.total,
      payload.totalPrice,
      subtotal + deliveryFee,
    );

    if (!externalId) {
      throw Object.assign(new Error('Pedido iFood sem ID externo.'), { statusCode: 400 });
    }

    return {
      origin: OrderOrigin.IFOOD,
      externalId,
      externalMerchantId: merchantId || null,
      customer: getCustomer(payload),
      fulfillmentType,
      status: mapStatus(payload),
      address: fulfillmentType === 'DELIVERY' ? getAddress(payload) : null,
      subtotal,
      deliveryFee,
      total,
      notes:
        [
          text(payload.displayId) ? `iFood #${text(payload.displayId)}` : '',
          text(payload.observations, payload.notes),
        ]
          .filter(Boolean)
          .join(' | ') || null,
      items,
      rawPayload: payload,
    };
  }
}
