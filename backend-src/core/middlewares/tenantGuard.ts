import { Request, Response, NextFunction } from 'express';
import { tenantContext } from '../context/TenantContext.js';
import { basePrisma } from '../../lib/prisma.js';

export async function tenantGuard(req: Request, res: Response, next: NextFunction) {
  let tenantId = req.headers['x-tenant-id'] as string;

  // FALLBACK TEMPORARIO DE TRANSICAO (ate refatorar o front)
  if (!tenantId) {
    const defaultTenant = await basePrisma.tenant.findFirst();
    if (defaultTenant) {
      tenantId = defaultTenant.id;
    }
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
