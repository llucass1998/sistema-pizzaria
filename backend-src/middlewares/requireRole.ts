import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth.js';

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const token = req.cookies?.token || authHeader?.replace('Bearer ', '');

      if (!token) {
        res.status(401).json({ message: 'Token nao fornecido.' });
        return;
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        res.status(401).json({ message: 'Token expirado ou invalido.' });
        return;
      }

      if (decoded.type !== 'STAFF' || !(req as any).adminId || !(req as any).adminRole) {
        res.status(403).json({ message: 'Acesso restrito a administradores e funcionarios.' });
        return;
      }

      const role = (req as any).adminRole;

      if (decoded.userId !== (req as any).adminId || decoded.role !== role) {
        res.status(403).json({ message: 'Perfil administrativo inconsistente.' });
        return;
      }

      if (role !== 'SUPER_ADMIN' && !allowedRoles.includes(role)) {
        res.status(403).json({ message: 'Acesso negado para o seu perfil.' });
        return;
      }

      next();
    } catch {
      res.status(401).json({ message: 'Token expirado ou invalido.' });
    }
  };
}
