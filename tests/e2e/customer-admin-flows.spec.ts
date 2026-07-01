import { describe, expect, it } from 'vitest';

import { calculateCheckoutTotals } from '../../backend-src/utils/checkoutTotals.js';
import { getAllowedNextStatuses, validateStatusTransition } from '../../backend-src/utils/orderStateMachine.js';

describe('critical customer and admin flows', () => {
  it('keeps checkout totals finite and never negative', () => {
    const result = calculateCheckoutTotals({
      subtotal: 89.8,
      discount: 10,
      fees: 7,
      loyaltyBalance: 500,
      useLoyaltyBalance: true,
    });

    expect(Number.isFinite(result.total)).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBe(0);
  });

  it('does not allow delivery orders to jump from preparing directly to delivered', () => {
    const transition = validateStatusTransition('DELIVERY', 'PREPARING', 'DELIVERED');

    expect(transition.ok).toBe(false);
    expect(getAllowedNextStatuses('DELIVERY', 'PREPARING')).toContain('OUT_FOR_DELIVERY');
    expect(getAllowedNextStatuses('DELIVERY', 'PREPARING')).not.toContain('DELIVERED');
  });

  it('allows the full pickup order path used by PDV and live orders', () => {
    expect(validateStatusTransition('PICKUP', 'PENDING', 'PREPARING').ok).toBe(true);
    expect(validateStatusTransition('PICKUP', 'PREPARING', 'READY').ok).toBe(true);
    expect(validateStatusTransition('PICKUP', 'READY', 'DELIVERED').ok).toBe(true);
  });

  it('allows the full delivery order path used by customer checkout', () => {
    expect(validateStatusTransition('DELIVERY', 'PENDING', 'PREPARING').ok).toBe(true);
    expect(validateStatusTransition('DELIVERY', 'PREPARING', 'OUT_FOR_DELIVERY').ok).toBe(true);
    expect(validateStatusTransition('DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED').ok).toBe(true);
  });
});
