export const ADMIN_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN', 'DRIVER', 'INTEGRATION_MANAGER'] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export function normalizeAdminRole(value: unknown): AdminRole | null {
  const role = String(value ?? '')
    .trim()
    .toUpperCase();
  return ADMIN_ROLES.includes(role as AdminRole) ? (role as AdminRole) : null;
}
