import type { NextFunction, Request, Response } from 'express';

import { getTenantId } from '../core/context/TenantContext.js';
import { prisma, rlsContext } from '../lib/prisma.js';
import { verifyToken } from '../utils/auth.js';

export async function requireCustomer(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.header('authorization')?.replace('Bearer ', '');
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ message: 'Entre como cliente para continuar.' });
    return;
  }

  if (
    payload.type !== 'CUSTOMER' ||
    payload.role !== 'CUSTOMER' ||
    !payload.customerId ||
    payload.userId
  ) {
    res.status(403).json({ message: 'Esta sessao nao pertence a um cliente.' });
    return;
  }

  const tenantId = getTenantId();
  if (
    payload.tenantId !== tenantId ||
    payload.id !== payload.customerId ||
    payload.sub !== payload.id
  ) {
    res.status(403).json({ message: 'Sessao de cliente invalida para esta loja.' });
    return;
  }
  const customer = await prisma.customer.findFirst({
    where: { id: payload.id, tenantId, ...(payload.email ? { email: payload.email } : {}) },
    select: { id: true },
  });

  if (!customer) {
    res.status(401).json({ message: 'Sessao de cliente invalida para esta loja.' });
    return;
  }

  (req as any).customerId = customer.id;

  rlsContext.run({ customerId: customer.id, role: 'CUSTOMER' }, () => {
    next();
  });
}
