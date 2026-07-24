import type { NextRequest } from 'next/server';

export type UserRole = 'admin' | 'agent';

export type SessionPayload = {
  role: UserRole;
  tenantId: string;
  agentId?: string;
  email?: string;
  iat: number;
  exp: number;
};

export const SESSION_COOKIE_NAME = 'brokerhub_session';

function getAuthSecret(): string {
  return process.env.AUTH_SECRET ?? 'brokerhub-dev-secret-change-in-production';
}

function toBase64Url(bytes: Uint8Array): string {
  const base64 = Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

function base64UrlEncode(input: string): string {
  return toBase64Url(new TextEncoder().encode(input));
}

function base64UrlDecode(input: string): string {
  return new TextDecoder().decode(fromBase64Url(input));
}

async function signValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

const PBKDF2_ITERATIONS = 100_000;

async function derivePasswordBits(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return new Uint8Array(derived);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePasswordBits(password, salt);
  return `${toBase64Url(salt)}.${toBase64Url(derived)}`;
}

export async function verifyPassword(password: string, storedHash?: string | null): Promise<boolean> {
  if (!storedHash) return false;
  const [saltPart, hashPart] = storedHash.split('.');
  if (!saltPart || !hashPart) return false;

  const derived = await derivePasswordBits(password, fromBase64Url(saltPart));
  return safeEquals(toBase64Url(derived), hashPart);
}

export async function signSession(payload: Omit<SessionPayload, 'iat' | 'exp'>, expiresInSeconds = 60 * 60 * 8): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = await signValue(encodedPayload, getAuthSecret());
  return `${encodedPayload}.${signature}`;
}

export async function verifySession(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, providedSignature] = parts;
  const expectedSignature = await signValue(encodedPayload, getAuthSecret());
  if (!safeEquals(providedSignature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return await verifySession(token);
}

export function normalizeTenant(value?: string | null): string {
  if (!value) return 'brokerhub';
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'brokerhub';
}
