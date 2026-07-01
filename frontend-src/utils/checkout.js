export function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatCurrencySafe(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(safeNumber(value));
}

export function cleanPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
}

export function formatPhoneBR(phone) {
  const digits = cleanPhone(phone).slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function isValidPhoneBR(phone) {
  const digits = cleanPhone(phone);
  return digits.length === 10 || digits.length === 11;
}

export function calculateCheckoutSummary({
  subtotal,
  serviceFee,
  deliveryFee,
  coupon,
  loyaltyBalance,
  useLoyaltyBalance,
}) {
  const safeSubtotal = Math.max(0, safeNumber(subtotal));
  const safeServiceFee = Math.max(0, safeNumber(serviceFee));
  let safeDeliveryFee = Math.max(0, safeNumber(deliveryFee));
  let couponDiscountAmount = 0;

  if (coupon) {
    const couponValue = Math.max(0, safeNumber(coupon.value));

    if (coupon.type === 'PERCENTAGE') {
      couponDiscountAmount = safeSubtotal * (couponValue / 100);
    } else if (coupon.type === 'FIXED') {
      couponDiscountAmount = couponValue;
    } else if (coupon.type === 'FREE_DELIVERY') {
      safeDeliveryFee = 0;
    }
  }

  const subtotalWithFees = safeSubtotal + safeServiceFee + safeDeliveryFee;
  couponDiscountAmount = Math.min(couponDiscountAmount, subtotalWithFees);

  const totalAfterCoupon = Math.max(0, subtotalWithFees - couponDiscountAmount);
  const loyaltyDiscountAmount = useLoyaltyBalance
    ? Math.min(Math.max(0, safeNumber(loyaltyBalance)), totalAfterCoupon)
    : 0;

  return {
    checkoutTotal: Math.max(0, totalAfterCoupon - loyaltyDiscountAmount),
    couponDiscountAmount,
    loyaltyDiscountAmount,
    deliveryFeeAmount: safeDeliveryFee,
    serviceFeeAmount: safeServiceFee,
    subtotalAmount: safeSubtotal,
  };
}
