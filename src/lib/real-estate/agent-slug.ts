import { prisma } from '@/lib/prisma';
import { findAgentById, shouldUseMockStore, updateAgent } from '@/lib/real-estate/mock-store';

// Slug publico y estable para el Carnet de Agente (redinmo.io/v/[slug]). Se
// genera una sola vez, la primera vez que se necesita (render del carnet o
// visita a la pagina publica), y se persiste - nunca cambia despues, aunque
// el agente edite su nombre, para no romper enlaces ya compartidos.
const DIACRITICS_RANGE = new RegExp('[\\u0300-\\u036f]', 'g');

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(DIACRITICS_RANGE, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function ensureAgentSlug(agentId: string, fullName: string): Promise<string> {
  if (shouldUseMockStore()) {
    const existing = findAgentById(agentId);
    if (existing?.carnetSlug) return existing.carnetSlug;
    const slug = slugify(fullName) || `agente-${agentId.slice(0, 6)}`;
    updateAgent(agentId, { carnetSlug: slug });
    return slug;
  }

  const existing = await prisma.agent.findUnique({ where: { id: agentId }, select: { carnetSlug: true } });
  if (existing?.carnetSlug) return existing.carnetSlug;

  const base = slugify(fullName) || `agente-${agentId.slice(0, 6)}`;
  let candidate = base;
  let suffix = 1;
  // Reintenta con sufijo numerico hasta encontrar un slug libre - en la
  // practica esto casi nunca itera mas de una vez.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const collision = await prisma.agent.findUnique({ where: { carnetSlug: candidate }, select: { id: true } });
    if (!collision || collision.id === agentId) break;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  await prisma.agent.update({ where: { id: agentId }, data: { carnetSlug: candidate } });
  return candidate;
}
