import { describe, expect, it } from 'vitest';

import {
  calculateDepositAmounts,
  centsToMoney,
  moneyToCents,
  normalizePaymentMode,
  normalizePaymentTransactionType,
} from './orderFinancial.service.js';

describe('orderFinancial deposit helpers', () => {
  it('calculates a 50 percent deposit using cents-safe rounding', () => {
    expect(calculateDepositAmounts(101.99, 50)).toEqual({
      depositPercent: 50,
      depositAmount: 51,
      remainingAmount: 50.99,
    });
  });

  it('falls back to 50 percent for invalid percentages', () => {
    expect(calculateDepositAmounts(80, -10)).toMatchObject({
      depositPercent: 50,
      depositAmount: 40,
      remainingAmount: 40,
    });
  });

  it('normalizes payment mode and transaction type defensively', () => {
    expect(normalizePaymentMode('deposit')).toBe('DEPOSIT');
    expect(normalizePaymentMode('weird')).toBe('FULL');
    expect(normalizePaymentTransactionType('remaining_payment')).toBe('REMAINING_PAYMENT');
    expect(normalizePaymentTransactionType('bad')).toBe('FULL_PAYMENT');
  });

  it('converts money through cents without floating point leftovers', () => {
    expect(moneyToCents(10.015)).toBe(1002);
    expect(centsToMoney(1002)).toBe(10.02);
  });
});
