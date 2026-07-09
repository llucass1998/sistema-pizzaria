import { describe, expect, it, vi } from 'vitest';

import {
  addOrderEventClient,
  emitOrderEvent,
  getOrderEventClientCount,
} from './orderEvents.service.js';

function createResponseMock() {
  return {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
  } as any;
}

describe('order events service', () => {
  it('emits events only to clients from the target tenant', () => {
    const tenantAResponse = createResponseMock();
    const tenantBResponse = createResponseMock();
    const removeTenantA = addOrderEventClient('tenant-a', tenantAResponse);
    const removeTenantB = addOrderEventClient('tenant-b', tenantBResponse);

    const delivered = emitOrderEvent('tenant-a', 'order-created', { id: 'order-1' });

    expect(delivered).toBe(1);
    expect(tenantAResponse.write).toHaveBeenCalledWith('event: order-created\n');
    expect(tenantAResponse.write).toHaveBeenCalledWith('data: {"id":"order-1"}\n\n');
    expect(tenantBResponse.write).not.toHaveBeenCalledWith('event: order-created\n');

    removeTenantA();
    removeTenantB();
  });

  it('removes clients when the cleanup callback is called', () => {
    const response = createResponseMock();
    const remove = addOrderEventClient('tenant-cleanup', response);

    expect(getOrderEventClientCount('tenant-cleanup')).toBe(1);
    remove();
    expect(getOrderEventClientCount('tenant-cleanup')).toBe(0);
  });
});
