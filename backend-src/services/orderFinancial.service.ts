const OFFICIAL_PAYMENT_METHODS = new Set([
  'PIX',
  'CASH',
  'DEBIT_CARD',
  'CREDIT_CARD',
  'ONLINE_CARD',
]);

const PAYMENT_MODES = new Set(['FULL', 'DEPOSIT']);
const PAYMENT_TRANSACTION_TYPES = new Set([
  'FULL_PAYMENT',
  'DEPOSIT_PAYMENT',
  'REMAINING_PAYMENT',
  'REFUND',
]);

export const FINANCIAL_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  FAILED: 'FAILED',
  CANCELED: 'CANCELED',
  REFUNDED: 'REFUNDED',
} as const;

export type FinancialStatus = (typeof FINANCIAL_STATUS)[keyof typeof FINANCIAL_STATUS];

export function normalizePaymentMethod(value: unknown, fallback = 'CASH') {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();
  return OFFICIAL_PAYMENT_METHODS.has(normalized) ? normalized : fallback;
}

export function normalizePaymentMode(value: unknown, fallback = 'FULL') {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();
  return PAYMENT_MODES.has(normalized) ? normalized : fallback;
}

export function normalizePaymentTransactionType(value: unknown, fallback = 'FULL_PAYMENT') {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();
  return PAYMENT_TRANSACTION_TYPES.has(normalized) ? normalized : fallback;
}

export function moneyToCents(value: unknown) {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.round(numberValue * 100);
}

export function centsToMoney(cents: number) {
  return Number((Math.max(0, Math.round(cents)) / 100).toFixed(2));
}

export function calculateDepositAmounts(totalAmount: unknown, depositPercent: unknown) {
  const totalCents = moneyToCents(totalAmount);
  const percent = Number(depositPercent ?? 50);
  const safePercent = Number.isFinite(percent) && percent > 0 && percent < 100 ? percent : 50;
  const depositCents = Math.round((totalCents * safePercent) / 100);
  const remainingCents = Math.max(0, totalCents - depositCents);

  return {
    depositPercent: safePercent,
    depositAmount: centsToMoney(depositCents),
    remainingAmount: centsToMoney(remainingCents),
  };
}

export function isPaidStatus(status: unknown) {
  return ['PAID', 'COMPLETED'].includes(String(status ?? '').toUpperCase());
}

export function getAmountPaidFromOrder(order: {
  amountPaid?: unknown;
  paymentStatus?: string | null;
  total?: unknown;
  invoice?: {
    status?: string | null;
    payments?: Array<{ amount: unknown; status?: string | null }> | null;
  } | null;
}) {
  const consolidated = Number(order.amountPaid ?? 0);
  if (Number.isFinite(consolidated) && consolidated > 0) return consolidated;

  const paidFromInvoice =
    order.invoice?.payments
      ?.filter((payment) => isPaidStatus(payment.status ?? 'COMPLETED'))
      .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0) ?? 0;

  if (paidFromInvoice > 0) return Number(paidFromInvoice.toFixed(2));
  return getOrderPaymentStatus(order) === FINANCIAL_STATUS.PAID ? Number(order.total ?? 0) : 0;
}

export function normalizeInvoiceStatus(status: string) {
  if (status === 'PARTIAL') return FINANCIAL_STATUS.PARTIALLY_PAID;
  if (status === 'COMPLETED') return FINANCIAL_STATUS.PAID;
  return status;
}

export function calculatePaymentState(totalAmount: number, paidAmount: number) {
  const total = Math.max(0, Number(totalAmount) || 0);
  const paid = Math.max(0, Number(paidAmount) || 0);
  const remainingAmount = Math.max(0, total - paid);

  if (total === 0 || paid >= total) {
    return {
      amountPaid: Number(total.toFixed(2)),
      remainingAmount: 0,
      invoiceStatus: FINANCIAL_STATUS.PAID,
      orderPaymentStatus: FINANCIAL_STATUS.PAID,
    };
  }

  if (paid > 0) {
    return {
      amountPaid: Number(paid.toFixed(2)),
      remainingAmount: Number(remainingAmount.toFixed(2)),
      invoiceStatus: FINANCIAL_STATUS.PARTIALLY_PAID,
      orderPaymentStatus: FINANCIAL_STATUS.PARTIALLY_PAID,
    };
  }

  return {
    amountPaid: 0,
    remainingAmount: Number(total.toFixed(2)),
    invoiceStatus: FINANCIAL_STATUS.PENDING,
    orderPaymentStatus: FINANCIAL_STATUS.PENDING,
  };
}

export function getOrderPaymentStatus(order: {
  status?: string | null;
  paymentStatus?: string | null;
  invoice?: { status?: string | null } | null;
}) {
  if (order.status === 'CANCELED') {
    return FINANCIAL_STATUS.CANCELED;
  }

  if (order.paymentStatus) {
    return normalizeInvoiceStatus(order.paymentStatus);
  }

  if (order.invoice?.status) {
    return normalizeInvoiceStatus(order.invoice.status);
  }

  return FINANCIAL_STATUS.PENDING;
}

export function getPrimaryPaymentMethod(order: {
  paymentMethod?: string | null;
  invoice?: { payments?: Array<{ method: string | null }> | null } | null;
}) {
  return order.paymentMethod ?? order.invoice?.payments?.[0]?.method ?? 'A RECEBER';
}

export async function createOrderInvoice(
  tx: any,
  input: {
    tenantId: string;
    orderId: string;
    totalAmount: number | string;
    paymentMethod: string;
    paymentStatus?: FinancialStatus;
    paidAt?: Date | null;
    createPayment?: boolean;
  },
) {
  const status = input.paymentStatus ?? FINANCIAL_STATUS.PENDING;
  const shouldCreatePayment = input.createPayment && status === FINANCIAL_STATUS.PAID;

  return tx.invoice.create({
    data: {
      tenantId: input.tenantId,
      orderId: input.orderId,
      totalAmount: Number(input.totalAmount).toFixed(2),
      status,
      payments: shouldCreatePayment
        ? {
            create: {
              amount: Number(input.totalAmount).toFixed(2),
              method: input.paymentMethod,
              status: 'COMPLETED',
              paymentDate: input.paidAt ?? new Date(),
            },
          }
        : undefined,
    },
    include: { payments: true },
  });
}
