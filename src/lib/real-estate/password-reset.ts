import { prisma } from '@/lib/prisma';
import {
  countMockResetTokensForAgentSince,
  createMockResetToken,
  findAgentByEmail,
  findAgentById,
  findAgentByPhone,
  findMockResetTokenByHash,
  invalidateOtherMockResetTokens,
  markMockResetTokenUsed,
  shouldUseMockStore,
  updateAgent,
} from '@/lib/real-estate/mock-store';

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutos, un solo uso
const MAX_PER_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_ACCOUNT = 3;
const MAX_PER_IP_WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_IP = 10;

// El limite por IP debe aplicar incluso cuando el identificador no corresponde a
// ninguna cuenta (si no, un atacante podria martillar identificadores inventados
// sin limite) - por eso vive en EventLog (entityId = IP), separado del limite por
// cuenta que solo tiene sentido cuando SI hay un agente encontrado.
const IP_ENTITY_TYPE = 'password_reset_ip';

export async function logIpAttempt(requestIp: string): Promise<void> {
  if (shouldUseMockStore()) return; // en mock no hay EventLog persistente; el limite por cuenta ya cubre el flujo de prueba
  try {
    await prisma.eventLog.create({ data: { entityType: IP_ENTITY_TYPE, entityId: requestIp, eventType: 'ATTEMPT' } });
  } catch {
    // no critico: nunca debe bloquear la respuesta neutra
  }
}

export async function checkIpRateLimit(requestIp: string): Promise<boolean> {
  if (shouldUseMockStore()) return true;
  try {
    const since = new Date(Date.now() - MAX_PER_IP_WINDOW_MS);
    const count = await prisma.eventLog.count({ where: { entityType: IP_ENTITY_TYPE, entityId: requestIp, createdAt: { gte: since } } });
    return count < MAX_PER_IP;
  } catch {
    return true;
  }
}

export type AgentIdentity = { id: string; fullName: string; email: string | null; phone: string; company: string | null };

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

// El identificador acepta correo o telefono, detectado por la presencia de "@" -
// nunca revela por la respuesta cual de los dos formatos coincidio (ni si coincidio).
export async function findAgentByIdentifier(identifier: string): Promise<AgentIdentity | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  const isEmail = trimmed.includes('@');

  if (shouldUseMockStore()) {
    const agent = isEmail ? findAgentByEmail(trimmed) : findAgentByPhone(trimmed);
    if (!agent) return null;
    return { id: agent.id, fullName: agent.fullName, email: agent.email ?? null, phone: agent.phone, company: agent.company ?? null };
  }

  const agent = isEmail
    ? await prisma.agent.findUnique({ where: { email: trimmed } })
    : await prisma.agent.findUnique({ where: { phone: trimmed } });
  if (!agent) return null;
  return { id: agent.id, fullName: agent.fullName, email: agent.email, phone: agent.phone, company: agent.company };
}

// Cuenta intentos recientes usando la propia tabla PasswordResetToken como fuente
// de verdad para el limite POR CUENTA (no hace falta una tabla de rate-limit
// aparte) - solo aplica cuando ya se encontro un agente. Nunca debe filtrarse en
// la respuesta al cliente, solo decide si se genera/envia el correo o no.
export async function checkAccountRateLimit(agentId: string): Promise<boolean> {
  const accountSince = new Date(Date.now() - MAX_PER_ACCOUNT_WINDOW_MS);

  if (shouldUseMockStore()) {
    return countMockResetTokensForAgentSince(agentId, accountSince) < MAX_PER_ACCOUNT;
  }

  const accountCount = await prisma.passwordResetToken.count({ where: { agentId, createdAt: { gte: accountSince } } });
  return accountCount < MAX_PER_ACCOUNT;
}

export async function createResetToken(agentId: string, requestIp?: string): Promise<string> {
  const rawToken = randomTokenHex();
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  if (shouldUseMockStore()) {
    createMockResetToken({ agentId, tokenHash, expiresAt: expiresAt.toISOString(), requestIp });
    return rawToken;
  }

  await prisma.passwordResetToken.create({ data: { agentId, tokenHash, expiresAt, requestIp } });
  return rawToken;
}

// El caso invalido conserva el agentId cuando se pudo identificar (token existente
// pero vencido/usado) - solo para fines de log de seguridad server-side, nunca se
// devuelve al cliente.
export type TokenValidation = { valid: true; agentId: string } | { valid: false; agentId?: string };

// Lectura de solo consulta ("peek"): no marca nada como usado. La usan tanto la
// pagina de /restablecer (para decidir que mostrar) como el endpoint de submit
// (que re-valida antes de consumir, por si el token vencio entre medio).
export async function validateResetToken(rawToken: string): Promise<TokenValidation> {
  const tokenHash = await sha256Hex(rawToken);

  if (shouldUseMockStore()) {
    const record = findMockResetTokenByHash(tokenHash);
    if (!record) return { valid: false };
    if (record.usedAt || new Date(record.expiresAt).getTime() < Date.now()) return { valid: false, agentId: record.agentId };
    return { valid: true, agentId: record.agentId };
  }

  const record = await prisma.passwordResetToken.findFirst({ where: { tokenHash } });
  if (!record) return { valid: false };
  if (record.usedAt || record.expiresAt.getTime() < Date.now()) return { valid: false, agentId: record.agentId };
  return { valid: true, agentId: record.agentId };
}

// Marca el token consumido como usado e invalida (marca usados) todos los demas
// tokens sin usar de ese agente - nunca deben quedar dos enlaces vigentes a la vez.
export async function consumeResetToken(rawToken: string): Promise<TokenValidation> {
  const validation = await validateResetToken(rawToken);
  if (!validation.valid) return validation;

  const tokenHash = await sha256Hex(rawToken);

  if (shouldUseMockStore()) {
    markMockResetTokenUsed(tokenHash);
    invalidateOtherMockResetTokens(validation.agentId, tokenHash);
    return validation;
  }

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({ where: { tokenHash }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.updateMany({
      where: { agentId: validation.agentId, tokenHash: { not: tokenHash }, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
  return validation;
}

export async function updateAgentPassword(agentId: string, passwordHash: string): Promise<AgentIdentity | null> {
  if (shouldUseMockStore()) {
    const agent = updateAgent(agentId, { passwordHash });
    if (!agent) return null;
    return { id: agent.id, fullName: agent.fullName, email: agent.email ?? null, phone: agent.phone, company: agent.company ?? null };
  }

  const agent = await prisma.agent.update({ where: { id: agentId }, data: { passwordHash } });
  return { id: agent.id, fullName: agent.fullName, email: agent.email, phone: agent.phone, company: agent.company };
}

export async function getAgentIdentity(agentId: string): Promise<AgentIdentity | null> {
  if (shouldUseMockStore()) {
    const agent = findAgentById(agentId);
    if (!agent) return null;
    return { id: agent.id, fullName: agent.fullName, email: agent.email ?? null, phone: agent.phone, company: agent.company ?? null };
  }
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return null;
  return { id: agent.id, fullName: agent.fullName, email: agent.email, phone: agent.phone, company: agent.company };
}
