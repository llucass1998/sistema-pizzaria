import { createHmac, timingSafeEqual } from 'node:crypto';

type AdminTokenPayload = {
  id: string;
  email: string;
  exp: number;
};

const tokenTtlMs = 1000 * 60 * 60 * 24 * 7;

function getSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET || process.env.DATABASE_URL || 'pizzaria-admin-dev-secret'
  );
}

function toBase64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload: string) {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAdminToken(admin: { id: string; email: string }) {
  const payload = toBase64Url(
    JSON.stringify({
      id: admin.id,
      email: admin.email,
      exp: Date.now() + tokenTtlMs,
    } satisfies AdminTokenPayload),
  );
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

export function verifyAdminToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split('.');

  if (!payload || !signature || !safeCompare(signature, signPayload(payload))) {
    return null;
  }

  try {
    const data = JSON.parse(fromBase64Url(payload)) as AdminTokenPayload;

    if (!data.id || !data.email || Date.now() > data.exp) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}
