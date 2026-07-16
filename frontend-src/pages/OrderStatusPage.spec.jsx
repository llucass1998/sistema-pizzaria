import { describe, expect, it } from 'vitest';
import { getStatusMessage, getTrackingIndex, safeMoney } from './OrderStatusPage.jsx';

describe('OrderStatusPage helpers', () => {
  it.each([
    ['PENDING', 0],
    ['PREPARING', 1],
    ['OUT_FOR_DELIVERY', 2],
    ['READY', 2],
    ['DELIVERED', 3],
    ['CANCELED', -1],
  ])('maps %s to timeline position %s', (status, position) => {
    expect(getTrackingIndex(status)).toBe(position);
  });

  it('uses a human delivery message and never returns unsafe money', () => {
    expect(getStatusMessage({ status: 'OUT_FOR_DELIVERY', paymentStatus: 'PAID' })).toContain('entregador');
    expect(getStatusMessage({ status: 'PREPARING', paymentStatus: 'PARTIALLY_PAID' })).toContain('Entrada paga');
    expect(safeMoney(undefined)).toBe(0);
    expect(safeMoney('NaN')).toBe(0);
  });
});
