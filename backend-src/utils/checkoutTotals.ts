function finiteMoney(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function calculateCheckoutTotals(input: {
  subtotal: number;
  discount?: number;
  fees?: number;
  loyaltyBalance?: number;
  useLoyaltyBalance?: boolean;
}) {
  const subtotal = Math.max(0, finiteMoney(input.subtotal));
  const discount = Math.max(0, finiteMoney(input.discount));
  const fees = Math.max(0, finiteMoney(input.fees));
  const subtotalWithDiscount = Math.max(0, subtotal - discount);
  const totalBeforeLoyalty = subtotalWithDiscount + fees;
  const loyaltyDiscount = input.useLoyaltyBalance
    ? Math.min(Math.max(0, finiteMoney(input.loyaltyBalance)), totalBeforeLoyalty)
    : 0;
  const total = Math.max(0, totalBeforeLoyalty - loyaltyDiscount);

  return {
    subtotalWithDiscount,
    totalBeforeLoyalty,
    loyaltyDiscount,
    total,
  };
}
