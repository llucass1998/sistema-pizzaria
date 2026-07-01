import { describe, expect, it } from 'vitest';

import { calculateCheckoutTotals } from './checkoutTotals.js';

describe('calculateCheckoutTotals', () => {
  it('never returns a negative total when discounts exceed subtotal', () => {
    const result = calculateCheckoutTotals({
      subtotal: 40,
      discount: 100,
      fees: 0,
    });

    expect(result.total).toBe(0);
    expect(result.subtotalWithDiscount).toBe(0);
  });

  it('limits loyalty discount to the amount still payable', () => {
    const result = calculateCheckoutTotals({
      subtotal: 50,
      discount: 10,
      fees: 5,
      loyaltyBalance: 100,
      useLoyaltyBalance: true,
    });

    expect(result.loyaltyDiscount).toBe(45);
    expect(result.total).toBe(0);
  });
});
