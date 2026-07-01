import type { NextFunction, Request, Response } from 'express';

import { verifyToken } from '../utils/auth.js';
import { rlsContext } from '../lib/prisma.js';

export async function requireCustomer(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.header('authorization')?.replace('Bearer ', '');
  const payload = verifyToken(token);

  if (!payload || payload.role !== 'CUSTOMER') {
    res.status(401).json({ message: 'Entre como cliente para continuar.' });
    return;
  }

  if (!payload.id) {
    res.status(401).json({ message: 'Sessao invalida.' });
    return;
  }

  // Injetar informacoes do cliente no request para uso posterior (ex: aplicacao de RLS).
  (req as any).customerId = payload.id;

  rlsContext.run({ customerId: payload.id, role: 'CUSTOMER' }, () => {
    next();
  });
}
