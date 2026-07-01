import { describe, expect, it } from 'vitest';
import {
  calculateCheckoutSummary,
  cleanPhone,
  formatCurrencySafe,
  formatPhoneBR,
  isValidPhoneBR,
} from '../../frontend-src/utils/checkout.js';

describe('checkout UI rules', () => {
  it('formats and validates Brazilian WhatsApp numbers', () => {
    expect(cleanPhone('+55 (11) 99999-8888')).toBe('11999998888');
    expect(formatPhoneBR('11999998888')).toBe('(11) 99999-8888');
    expect(isValidPhoneBR('(11) 99999-8888')).toBe(true);
    expect(isValidPhoneBR('11999')).toBe(false);
  });

  it('formats invalid currency inputs without NaN', () => {
    expect(formatCurrencySafe(undefined).replace(/\s/g, ' ')).toBe('R$ 0,00');
    expect(formatCurrencySafe(Number.NaN).replace(/\s/g, ' ')).toBe('R$ 0,00');
  });

  it('caps coupon and loyalty discounts so total never becomes negative', () => {
    const summary = calculateCheckoutSummary({
      subtotal: 20,
      serviceFee: 2,
      deliveryFee: 5,
      coupon: { type: 'FIXED', value: 100 },
      loyaltyBalance: 50,
      useLoyaltyBalance: true,
    });

    expect(summary.couponDiscountAmount).toBe(27);
    expect(summary.loyaltyDiscountAmount).toBe(0);
    expect(summary.checkoutTotal).toBe(0);
  });

  it('removes delivery fee for pickup/free-delivery style totals', () => {
    const summary = calculateCheckoutSummary({
      subtotal: 40,
      serviceFee: 2,
      deliveryFee: 8,
      coupon: { type: 'FREE_DELIVERY', value: 0 },
      loyaltyBalance: 0,
      useLoyaltyBalance: false,
    });

    expect(summary.deliveryFeeAmount).toBe(0);
    expect(summary.checkoutTotal).toBe(42);
  });
});
