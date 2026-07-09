import jwt from 'jsonwebtoken';
import { Response } from 'express';

const DEFAULT_DEV_SECRET = 'pizzaria-senior-secret-key';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.ADMIN_SESSION_SECRET) {
    return process.env.ADMIN_SESSION_SECRET;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET ou ADMIN_SESSION_SECRET obrigatorio em producao.');
  }

  return DEFAULT_DEV_SECRET;
}

export type JwtPayload = {
  id: string;
  email: string;
  role: string;
};

export function createToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Use lax or strict based on frontend-backend domain sharing
    maxAge: TOKEN_TTL_MS,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie('token');
}
