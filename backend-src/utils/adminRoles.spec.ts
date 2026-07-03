import { describe, expect, it } from 'vitest';

import { ADMIN_ROLES, normalizeAdminRole } from './adminRoles.js';

describe('admin roles', () => {
  it('exposes DRIVER as an official administrable role', () => {
    expect(ADMIN_ROLES).toContain('DRIVER');
    expect(normalizeAdminRole('driver')).toBe('DRIVER');
  });

  it('rejects unknown roles', () => {
    expect(normalizeAdminRole('FINANCE')).toBeNull();
    expect(normalizeAdminRole('')).toBeNull();
  });
});
