import { prisma } from '@/lib/prisma';
import {
  createMockEmailChangeToken,
  findAgentByEmail,
  findMockEmailChangeTokenByHash,
  invalidateOtherMockEmailChangeTokens,
  markMockEmailChangeTokenUsed,
  shouldUseMockStore,
  updateAgent,
} from '@/lib/real-estate/mock-store';

// Cambio de correo con verificacion (seccion 3.4 de editar perfil): el correo
// actual sigue vigente hasta que se confirme el nuevo. Mismo patron que
// password-reset.ts (token de un solo uso, hash, vencimiento) pero sin el
// rate-limit por IP: esta accion requiere sesion activa, a diferencia de la
// recuperacion de contrasena que es publica.
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutos, un solo uso

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomTokenHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function isEmailTaken(email: string, excludeAgentId: string): Promise<boolean> {
  if (shouldUseMockStore()) {
    const existing = findAgentByEmail(email);
    return Boolean(existing && existing.id !== excludeAgentId);
  }
  const existing = await prisma.agent.findUnique({ where: { email } });
  return Boolean(existing && existing.id !== excludeAgentId);
}

// Crea el token, marca pendingEmail en el agente (para que la UI muestre "en
// verificacion") y devuelve el token crudo para el enlace del correo.
export async function requestEmailChange(agentId: string, newEmail: string): Promise<string> {
  const rawToken = randomTokenHex();
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  if (shouldUseMockStore()) {
    createMockEmailChangeToken({ agentId, newEmail, tokenHash, expiresAt: expiresAt.toISOString() });
    updateAgent(agentId, { pendingEmail: newEmail });
    return rawToken;
  }

  await prisma.$transaction([
    prisma.emailChangeToken.create({ data: { agentId, newEmail, tokenHash, expiresAt } }),
    prisma.agent.update({ where: { id: agentId }, data: { pendingEmail: newEmail } }),
  ]);
  return rawToken;
}

export type EmailChangeValidation = { valid: true; agentId: string; newEmail: string } | { valid: false };

export async function validateEmailChangeToken(rawToken: string): Promise<EmailChangeValidation> {
  const tokenHash = await sha256Hex(rawToken);

  if (shouldUseMockStore()) {
    const record = findMockEmailChangeTokenByHash(tokenHash);
    if (!record || record.usedAt || new Date(record.expiresAt).getTime() < Date.now()) return { valid: false };
    return { valid: true, agentId: record.agentId, newEmail: record.newEmail };
  }

  const record = await prisma.emailChangeToken.findFirst({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) return { valid: false };
  return { valid: true, agentId: record.agentId, newEmail: record.newEmail };
}

// Confirma el cambio: aplica newEmail a Agent.email, limpia pendingEmail,
// marca el token (y cualquier otro token sin usar del agente) como usado.
export async function confirmEmailChange(rawToken: string): Promise<EmailChangeValidation> {
  const validation = await validateEmailChangeToken(rawToken);
  if (!validation.valid) return validation;

  const tokenHash = await sha256Hex(rawToken);

  if (shouldUseMockStore()) {
    updateAgent(validation.agentId, { email: validation.newEmail, pendingEmail: undefined });
    markMockEmailChangeTokenUsed(tokenHash);
    invalidateOtherMockEmailChangeTokens(validation.agentId, tokenHash);
    return validation;
  }

  await prisma.$transaction([
    prisma.agent.update({ where: { id: validation.agentId }, data: { email: validation.newEmail, pendingEmail: null } }),
    prisma.emailChangeToken.updateMany({ where: { tokenHash }, data: { usedAt: new Date() } }),
    prisma.emailChangeToken.updateMany({
      where: { agentId: validation.agentId, tokenHash: { not: tokenHash }, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
  return validation;
}
