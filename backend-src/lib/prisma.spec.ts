import { describe, expect, it } from 'vitest';

import { MODELS_WITHOUT_DIRECT_TENANT_ID } from './prisma.js';

describe('Prisma tenant interceptor metadata', () => {
  it('does not inject a nonexistent tenantId into ProductOptionItem', () => {
    expect(MODELS_WITHOUT_DIRECT_TENANT_ID.has('ProductOptionItem')).toBe(true);
  });
});
