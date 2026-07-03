import { Request, Response, NextFunction } from 'express';
import { tenantContext } from '../context/TenantContext.js';
import { basePrisma } from '../../lib/prisma.js';

type TenantColumns = {
  customDomain: boolean;
  subdomain: boolean;
  isActive: boolean;
};

function normalizeHost(value: string | undefined) {
  if (!value) {
    return '';
  }

  return value.replace(/^https?:\/\//, '').split('/')[0]?.split(':')[0]?.toLowerCase() ?? '';
}

function getRequestHosts(req: Request) {
  const forwardedHost = String(req.headers['x-forwarded-host'] ?? '');
  const host = String(req.headers.host ?? '');
  const origin = normalizeHost(String(req.headers.origin ?? ''));
  const referer = normalizeHost(String(req.headers.referer ?? ''));

  return [normalizeHost(forwardedHost), normalizeHost(host), origin, referer].filter(Boolean);
}

async function resolveTenantIdFromRequest(req: Request) {
  const hosts = getRequestHosts(req);
  const columns = await getTenantColumns();

  if (columns.customDomain || columns.subdomain) {
    for (const host of hosts) {
      const tenant = await findTenantByHost(host, columns);

      if (tenant) {
        return tenant;
      }
    }
  }

  if (columns.customDomain) {
    const domainTenant = await findDomainTenant(columns);
    if (domainTenant) {
      return domainTenant;
    }
  }

  return findDefaultTenant(columns);
}

async function getTenantColumns(): Promise<TenantColumns> {
  const rows = await basePrisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_name = 'Tenant'
        AND column_name IN ('customDomain', 'subdomain', 'isActive')`,
  );

  const names = new Set(rows.map((row) => row.column_name));

  return {
    customDomain: names.has('customDomain'),
    subdomain: names.has('subdomain'),
    isActive: names.has('isActive'),
  };
}

async function findTenantByHost(host: string, columns: TenantColumns) {
  const activeFilter = columns.isActive ? 'AND "isActive" = true' : '';
  const conditions: string[] = [];
  const params: string[] = [];

  if (columns.customDomain) {
    params.push(host);
    conditions.push(`"customDomain" = $${params.length}`);
  }

  if (columns.subdomain) {
    params.push(host.split('.')[0] ?? '');
    conditions.push(`"subdomain" = $${params.length}`);
  }

  if (!conditions.length) {
    return '';
  }

  const rows = await basePrisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id
       FROM "Tenant"
      WHERE (${conditions.join(' OR ')})
        ${activeFilter}
      ORDER BY "createdAt" ASC
      LIMIT 1`,
    ...params,
  );

  return rows[0]?.id ?? '';
}

async function findDomainTenant(columns: TenantColumns) {
  const activeFilter = columns.isActive ? 'AND "isActive" = true' : '';
  const rows = await basePrisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id
       FROM "Tenant"
      WHERE "customDomain" IS NOT NULL
        ${activeFilter}
      ORDER BY "createdAt" ASC
      LIMIT 1`,
  );

  return rows[0]?.id ?? '';
}

async function findDefaultTenant(columns: TenantColumns) {
  const activeFilter = columns.isActive ? 'WHERE "isActive" = true' : '';
  const rows = await basePrisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id
       FROM "Tenant"
        ${activeFilter}
      ORDER BY "createdAt" ASC
      LIMIT 1`,
  );

  return rows[0]?.id ?? '';
}

export async function tenantGuard(req: Request, res: Response, next: NextFunction) {
  let tenantId = req.headers['x-tenant-id'] as string;

  if (!tenantId) {
    tenantId = await resolveTenantIdFromRequest(req);
  }

  if (!tenantId) {
    return res
      .status(401)
      .json({ message: 'Acesso negado: ID do Tenant ausente (Broken Authorization).' });
  }

  // Envelopa toda a vida util da requisicao no contexto do tenant
  tenantContext.run({ tenantId }, () => {
    next();
  });
}
