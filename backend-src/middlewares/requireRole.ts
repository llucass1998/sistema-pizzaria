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

      (req as any).adminId = decoded.id;
      (req as any).adminRole = decoded.role;

      if (!allowedRoles.includes(decoded.role)) {
        res.status(403).json({ message: 'Acesso negado para o seu perfil.' });
        return;
      }

      next();
    } catch {
      res.status(401).json({ message: 'Token expirado ou invalido.' });
    }
  };
}
