import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { shouldUseMockStore, findAgentBySlug } from '@/lib/real-estate/mock-store';
import { getAgentPointsSummary } from '@/lib/real-estate/points-log';
import { levelColorFor } from '@/lib/real-estate/points';
import { zoneLabel } from '@/lib/real-estate/quito-zones';

export const metadata: Metadata = {
  title: 'Carnet de Agente | Redinmo.io',
  robots: { index: false, follow: false },
};

type PublicAgent = {
  fullName: string;
  photoUrl: string | null;
  idNumber: string | null;
  phoneVerifiedAt: Date | string | null;
  specializationZones: string[];
  subscriptionStatus: string;
  createdAt: Date | string;
  id: string;
};

async function loadAgent(slug: string): Promise<PublicAgent | null> {
  if (shouldUseMockStore()) {
    const agent = findAgentBySlug(slug);
    if (!agent) return null;
    return {
      fullName: agent.fullName,
      photoUrl: agent.photoUrl ?? null,
      idNumber: agent.idNumber ?? null,
      phoneVerifiedAt: agent.phoneVerifiedAt ?? null,
      specializationZones: agent.specializationZones ?? [],
      subscriptionStatus: agent.subscriptionStatus,
      createdAt: agent.createdAt,
      id: agent.id,
    };
  }

  const agent = await prisma.agent.findUnique({ where: { carnetSlug: slug } });
  if (!agent) return null;
  return {
    fullName: agent.fullName,
    photoUrl: agent.photoUrl,
    idNumber: agent.idNumber,
    phoneVerifiedAt: agent.phoneVerifiedAt,
    specializationZones: agent.specializationZones,
    subscriptionStatus: agent.subscriptionStatus,
    createdAt: agent.createdAt,
    id: agent.id,
  };
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export default async function PublicCarnetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agent = await loadAgent(slug);

  if (!agent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4 text-center text-text">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo.io</p>
          <h1 className="mt-3 text-xl font-bold">Carnet no encontrado</h1>
          <p className="mt-2 text-sm text-text-2">Este enlace de verificación no corresponde a ningún agente activo.</p>
        </div>
      </main>
    );
  }

  const verified = Boolean(agent.idNumber) && Boolean(agent.phoneVerifiedAt);
  const vigente = agent.subscriptionStatus === 'ACTIVE' || agent.subscriptionStatus === 'TRIAL';
  const joinYear = new Date(agent.createdAt).getFullYear();

  // El nivel se calcula desde el historial real de puntos, pero NUNCA se
  // exponen los puntos/posicion en esta pagina publica (privacidad + anti
  // scraping) - solo el nombre del nivel.
  const summary = await getAgentPointsSummary(agent.id).catch(() => null);
  const levelLabel = summary?.level.labelEs ?? 'Agente Inicial';
  const levelColor = levelColorFor(summary?.level.key ?? 'BROKER_INICIAL');

  const zones = agent.specializationZones.map((key) => zoneLabel(key, 'es')).filter(Boolean);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12 text-text">
      {/* Pagina publica (sin sesion, cualquiera que escanee el QR la ve) - sigue
          el tema del visitante igual que el carnet compartible en pantalla
          (BrokerCard.tsx): claro por defecto, oscuro si su sistema lo pide,
          via los mismos tokens de globals.css (el ThemeProvider del layout
          raiz ya cubre esta ruta, con defaultTheme="light" y enableSystem). */}
      <div
        className="relative w-full max-w-[340px] overflow-hidden rounded-[20px] border border-accent-line p-6 text-center"
        style={{ background: 'linear-gradient(165deg, var(--surface) 0%, var(--surface-2) 100%)' }}
      >
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full border border-accent-line" />
        <div className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 rounded-full border border-accent-line" />

        <p className="relative text-[10px] font-extrabold uppercase tracking-[0.18em] text-text-3">
          <span className="text-accent">✦ REDINMO.IO</span> · CARNET DE AGENTE
        </p>

        <div className="relative mt-5 flex justify-center">
          {agent.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={agent.photoUrl}
              alt={`Foto de ${agent.fullName}`}
              className="h-[88px] w-[88px] rounded-full object-cover outline outline-[2.5px] outline-offset-[3px] outline-accent"
            />
          ) : (
            <div
              className="flex h-[88px] w-[88px] items-center justify-center rounded-full text-2xl font-extrabold text-[#1c1330] outline outline-[2.5px] outline-offset-[3px] outline-accent"
              style={{ background: 'linear-gradient(160deg, #efeaff, #e0f5f2)' }}
            >
              {initialsOf(agent.fullName)}
            </div>
          )}
        </div>

        <p className="relative mt-3 text-[21px] font-extrabold text-text">{agent.fullName}</p>

        <div className="relative mt-2 flex flex-wrap items-center justify-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${
              verified ? 'border-accent-line bg-accent-dim text-accent' : 'border-line bg-surface-2 text-text-3'
            }`}
          >
            {verified ? '✓ Agente Verificado en Redinmo.io' : 'No verificado'}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full border border-brand-line bg-brand-dim px-2.5 py-1 text-[10px] font-bold"
            style={{ color: levelColor }}
          >
            ● {levelLabel}
          </span>
        </div>

        {zones.length > 0 ? <p className="relative mt-3 text-[11.5px] text-text-2">{zones.join(' · ')}</p> : null}

        <p className="relative mt-4 text-[10.5px] font-semibold text-accent">
          {vigente ? `● Vigente · ${new Date().toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })}` : null}
        </p>
        {!vigente ? <p className="relative mt-4 text-[11px] font-semibold text-text-3">Este carnet no está vigente actualmente.</p> : null}

        <p className="relative mt-3 text-[10.5px] text-text-3">Agente en Redinmo.io desde {joinYear}</p>
      </div>

      <p className="mt-6 text-[10px] text-text-3">
        <span className="font-bold text-accent">redinmo.io</span> · el hub que conecta colegas
      </p>
    </main>
  );
}
