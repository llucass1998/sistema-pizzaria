import type { OrderOrigin } from '../../../generated/prisma/index.js';

export type NormalizedOrderItem = {
  externalId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string | null;
  imageUrl?: string | null;
};

export type NormalizedExternalOrder = {
  origin: OrderOrigin;
  externalId: string;
  externalMerchantId?: string | null;
  customer: {
    externalId?: string | null;
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  fulfillmentType: 'PICKUP' | 'DELIVERY';
  status: string;
  address?: {
    street?: string | null;
    number?: string | null;
    neighborhood?: string | null;
    complement?: string | null;
  } | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  notes?: string | null;
  items: NormalizedOrderItem[];
  rawPayload: unknown;
};
