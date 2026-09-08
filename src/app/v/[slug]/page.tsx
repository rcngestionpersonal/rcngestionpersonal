import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { shouldUseMockStore, findAgentBySlug } from '@/lib/real-estate/mock-store';
import { getAgentPointsSummary } from '@/lib/real-estate/points-log';
import { resolveEffectiveSubscriptionStatus } from '@/lib/real-estate/subscription-status';
import CarnetPublico from './_components/CarnetPublico';

// Pagina publica del carnet: el destino del QR y del enlace "Ver mi carnet"
// del mini-sitio. Antes tenia su propia copia del diseño escrita a mano, que
// se fue separando del carnet real hasta mostrar otra cosa. Ahora renderiza el
// MISMO BrokerCard que ve el agente en Ranking, en su variante "publica"
// (ver src/components/dashboard/BrokerCard.tsx).
export const metadata: Metadata = {
  title: 'Carnet de Agente | Redinmo.io',
  robots: { index: false, follow: false },
};

type PublicAgent = {
  id: string;
  fullName: string;
  company: string | null;
  photoUrl: string | null;
  idNumber: string | null;
  licenseNumber: string | null;
  yearsExperience: number | null;
  phoneVerifiedAt: Date | string | null;
  specializationZones: string[];
  subscriptionStatus: string;
  trialEndsAt: Date | string | null;
  subscriptionPaidUntil: Date | string | null;
  carnetSlug: string | null;
  createdAt: Date | string;
};

async function loadAgent(slug: string): Promise<PublicAgent | null> {
  if (shouldUseMockStore()) {
    const agent = findAgentBySlug(slug);
    if (!agent) return null;
    return {
      id: agent.id,
      fullName: agent.fullName,
      company: agent.company ?? null,
      photoUrl: agent.photoUrl ?? null,
      idNumber: agent.idNumber ?? null,
      licenseNumber: agent.licenseNumber ?? null,
      yearsExperience: agent.yearsExperience ?? null,
      phoneVerifiedAt: agent.phoneVerifiedAt ?? null,
      specializationZones: agent.specializationZones ?? [],
      subscriptionStatus: agent.subscriptionStatus,
      trialEndsAt: agent.trialEndsAt ?? null,
      subscriptionPaidUntil: agent.subscriptionPaidUntil ?? null,
      carnetSlug: agent.carnetSlug ?? null,
      createdAt: agent.createdAt,
    };
  }

  const agent = await prisma.agent.findUnique({ where: { carnetSlug: slug } });
  if (!agent) return null;
  return {
    id: agent.id,
    fullName: agent.fullName,
    company: agent.company,
    photoUrl: agent.photoUrl,
    idNumber: agent.idNumber,
    licenseNumber: agent.licenseNumber,
    yearsExperience: agent.yearsExperience,
    phoneVerifiedAt: agent.phoneVerifiedAt,
    specializationZones: agent.specializationZones,
    subscriptionStatus: agent.subscriptionStatus,
    trialEndsAt: agent.trialEndsAt,
    subscriptionPaidUntil: agent.subscriptionPaidUntil,
    carnetSlug: agent.carnetSlug,
    createdAt: agent.createdAt,
  };
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
  const efectivo = resolveEffectiveSubscriptionStatus({
    subscriptionStatus: agent.subscriptionStatus as 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INACTIVE',
    trialEndsAt: agent.trialEndsAt,
    subscriptionPaidUntil: agent.subscriptionPaidUntil,
  });
  const vigente = efectivo === 'ACTIVE' || efectivo === 'TRIAL' || efectivo === 'PAST_DUE';

  // El nivel se calcula desde el historial real de puntos, pero NUNCA se
  // exponen los puntos/posicion en esta pagina publica (privacidad + anti
  // scraping): por eso la variante publica va con audience="clientes", que
  // muestra cierres / año de ingreso / inmuebles activos en vez de #N y puntos.
  const summary = await getAgentPointsSummary(agent.id).catch(() => null);

  // Los dos numeros de la franja que si son publicos. Se consultan aparte
  // porque el carnet en la app los recibe ya calculados del dashboard.
  const [cierres, listingsActive] = await Promise.all([
    prisma.closedDeal.count({ where: { createdByAgentId: agent.id } }).catch(() => 0),
    prisma.listing.count({ where: { managingAgentId: agent.id, status: 'ACTIVE' } }).catch(() => 0),
  ]);

  return (
    <CarnetPublico
      data={{
        displayName: agent.fullName,
        photoUrl: agent.photoUrl,
        verified,
        level: summary?.level ?? { key: 'BROKER_INICIAL', labelEs: 'Agente Inicial', labelEn: 'Starter Agent', min: 0 },
        // audience="clientes" no los pinta; van en cero para no filtrarlos ni
        // por el DOM (punto 2.3: se respetan las reglas de la pagina publica).
        totalPoints: 0,
        rank: 0,
        cierres,
        listingsActive,
        joinYear: new Date(agent.createdAt).getFullYear(),
        specializationZones: agent.specializationZones,
        // Sin telefono: la variante publica no lo pinta, y tampoco viaja al
        // cliente. Sin cedula ni direccion, por la misma razon.
        phone: '',
        subscriptionActive: vigente,
        carnetSlug: agent.carnetSlug,
        yearsExperience: agent.yearsExperience,
        licenseNumber: agent.licenseNumber,
        company: agent.company,
      }}
    />
  );
}
