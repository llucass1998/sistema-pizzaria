import type { NextFunction, Request, Response } from 'express';

import { getTenantId } from '../core/context/TenantContext.js';
import { prisma, rlsContext } from '../lib/prisma.js';
import { verifyToken } from '../utils/auth.js';

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.header('authorization')?.replace('Bearer ', '');
  const payload = verifyToken(token);

  if (!payload || !payload.role) {
    console.log('requireAdmin blocked:', req.originalUrl);
    res.status(401).json({ message: 'Entre como administrador para continuar.' });
    return;
  }

  // Obtém o tenantId do contexto para garantir isolamento multi-tenant
  let tenantId: string;
  try {
    tenantId = getTenantId();
  } catch {
    res.status(400).json({ message: 'Tenant não identificado na requisição.' });
    return;
  }

  // Filtra pelo tenantId para evitar acesso cross-tenant
  const admin = await prisma.admin.findFirst({
    where: { id: payload.id, tenantId },
    select: { id: true, email: true, role: true },
  });

  if (!admin || admin.email !== payload.email) {
    res.status(403).json({ message: 'Acesso de administrador invalido.' });
    return;
  }

  (req as any).adminId = admin.id;
  (req as any).admin = admin;
  (req as any).adminRole = admin.role;

  rlsContext.run({ customerId: admin.id, role: 'ADMIN' }, () => {
    next();
  });
}
