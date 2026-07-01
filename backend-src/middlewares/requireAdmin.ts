import type { NextFunction, Request, Response } from 'express';

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

  const admin = await prisma.admin.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true },
  });

  if (!admin || admin.email !== payload.email) {
    res.status(403).json({ message: 'Acesso de administrador invalido.' });
    return;
  }

  (req as any).adminId = admin.id;
  (req as any).admin = admin;

  rlsContext.run({ customerId: admin.id, role: 'ADMIN' }, () => {
    next();
  });
}
