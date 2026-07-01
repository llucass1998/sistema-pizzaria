import { describe, it, expect } from 'vitest';
import { getTenantId, tenantContext } from './TenantContext.js';

describe('TenantContext', () => {
  it('should throw an error if accessed outside of a tenant context', () => {
    expect(() => getTenantId()).toThrow(
      'Tenant context is missing! Database access denied (Architecture Violation).',
    );
  });

  it('should return the correct tenantId when inside context', () => {
    const mockTenantId = 'tenant-123';

    tenantContext.run({ tenantId: mockTenantId }, () => {
      const retrievedId = getTenantId();
      expect(retrievedId).toBe(mockTenantId);
    });
  });

  it('should isolate tenants between different asynchronous executions', async () => {
    const tenantA = 'tenant-A';
    const tenantB = 'tenant-B';

    const promiseA = new Promise<void>((resolve) => {
      tenantContext.run({ tenantId: tenantA }, () => {
        setTimeout(() => {
          expect(getTenantId()).toBe(tenantA);
          resolve();
        }, 10);
      });
    });

    const promiseB = new Promise<void>((resolve) => {
      tenantContext.run({ tenantId: tenantB }, () => {
        setTimeout(() => {
          expect(getTenantId()).toBe(tenantB);
          resolve();
        }, 5);
      });
    });

    await Promise.all([promiseA, promiseB]);
  });
});
