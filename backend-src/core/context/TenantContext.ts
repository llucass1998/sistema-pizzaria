import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextData {
  tenantId: string;
}

export const tenantContext = new AsyncLocalStorage<TenantContextData>();

export function getTenantId(): string {
  const store = tenantContext.getStore();
  if (!store || !store.tenantId) {
    throw new Error('Tenant context is missing! Database access denied (Architecture Violation).');
  }
  return store.tenantId;
}
