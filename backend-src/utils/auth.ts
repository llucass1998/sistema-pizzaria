import jwt from 'jsonwebtoken';
import { Response } from 'express';

const SECRET = process.env.JWT_SECRET || 'pizzaria-senior-secret-key';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export type JwtPayload = {
  id: string;
  email: string;
  role: string;
};

export function createToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SECRET) as JwtPayload;
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
