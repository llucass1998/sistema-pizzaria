import { describe, expect, it } from 'vitest';

import {
  calculatePaymentState,
  FINANCIAL_STATUS,
  getOrderPaymentStatus,
  getPrimaryPaymentMethod,
  normalizePaymentMethod,
} from './orderFinancial.service.js';

describe('order financial rules', () => {
  it('normalizes official payment methods and falls back safely', () => {
    expect(normalizePaymentMethod('pix')).toBe('PIX');
    expect(normalizePaymentMethod(' debit_card ')).toBe('DEBIT_CARD');
    expect(normalizePaymentMethod('invalid', 'CASH')).toBe('CASH');
  });

  it('calculates pending, partial and paid payment states', () => {
    expect(calculatePaymentState(100, 0)).toMatchObject({
      orderPaymentStatus: FINANCIAL_STATUS.PENDING,
      remainingAmount: 100,
    });

    expect(calculatePaymentState(100, 40)).toMatchObject({
      orderPaymentStatus: FINANCIAL_STATUS.PARTIALLY_PAID,
      amountPaid: 40,
      remainingAmount: 60,
    });

    expect(calculatePaymentState(100, 100)).toMatchObject({
      orderPaymentStatus: FINANCIAL_STATUS.PAID,
      amountPaid: 100,
      remainingAmount: 0,
    });
  });

  it('prioritizes canceled orders and resolves payment method fallback', () => {
    expect(getOrderPaymentStatus({ status: 'CANCELED', paymentStatus: 'PAID' })).toBe(
      FINANCIAL_STATUS.CANCELED,
    );
    expect(getOrderPaymentStatus({ status: 'PENDING', invoice: { status: 'PARTIAL' } })).toBe(
      FINANCIAL_STATUS.PARTIALLY_PAID,
    );
    expect(
      getPrimaryPaymentMethod({
        invoice: { payments: [{ method: 'PIX' }] },
      }),
    ).toBe('PIX');
  });
});
