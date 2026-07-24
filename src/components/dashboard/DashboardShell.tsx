'use client';

import { useState, type ReactNode, type SVGProps } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { AvatarInitials } from './CardKit';
import { IconClipboard, IconGrid, IconHouse, IconInvite, IconPodium, IconStar, IconSubscription, IconTarget } from './icons';
import type { DashboardTab } from './types';

// Invitar (agora "Invita a un Colega") va primero para agentes: es la accion
// que hace crecer la Red, y el pedido explicito fue darle prioridad visual.
const AGENT_TABS: DashboardTab[] = ['invitar', 'resumen', 'ranking', 'suscripcion', 'inmuebles', 'pedidos', 'matches', 'cierres'];
const ADMIN_TABS: DashboardTab[] = ['resumen', 'ranking', 'suscripcion', 'inmuebles', 'pedidos', 'matches', 'cierres', 'metricas'];

function IconMetricas(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 20V10M11 20V4M18 20v-6" />
      <path d="M3 20h18" />
    </svg>
  );
}

function IconMenu(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

const TAB_ICONS: Record<DashboardTab, (props: SVGProps<SVGSVGElement>) => ReactNode> = {
  resumen: IconGrid,
  ranking: IconPodium,
  suscripcion: IconSubscription,
  inmuebles: IconHouse,
  pedidos: IconClipboard,
  matches: IconStar,
  cierres: IconTarget,
  invitar: IconInvite,
  metricas: IconMetricas,
};

function tabLabelKey(tab: DashboardTab, isAdmin: boolean): string {
  if (tab === 'inmuebles') return isAdmin ? 'nav.inmuebles.admin' : 'nav.inmuebles.agent';
  if (tab === 'pedidos') return isAdmin ? 'nav.pedidos.admin' : 'nav.pedidos.agent';
  return `nav.${tab}`;
}

function LanguageSwitch() {
  const { lang, setLang, t } = useLanguage();
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1 text-xs font-semibold">
      <button
        onClick={() => setLang('es')}
        className={`rounded-full px-2.5 py-1 transition-all duration-200 ${
          lang === 'es' ? 'gradient-btn text-white shadow-sm' : 'text-white/60 hover:text-white'
        }`}
        aria-label={t('lang.es')}
      >
        ES
      </button>
      <button
        onClick={() => setLang('en')}
        className={`rounded-full px-2.5 py-1 transition-all duration-200 ${
          lang === 'en' ? 'gradient-btn text-white shadow-sm' : 'text-white/60 hover:text-white'
        }`}
        aria-label={t('lang.en')}
      >
        EN
      </button>
    </div>
  );
}

export default function DashboardShell({
  activeTab,
  onTabChange,
  isAdmin,
  displayName,
  isVerified,
  photoUrl,
  onLogout,
  children,
}: {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  isAdmin: boolean;
  displayName: string;
  isVerified?: boolean;
  photoUrl?: string | null;
  onLogout: () => void;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  const tabs = isAdmin ? ADMIN_TABS : AGENT_TABS;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function selectTab(tab: DashboardTab) {
    onTabChange(tab);
    setMobileMenuOpen(false);
  }

  return (
    <main className="violet-ambient-bg min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto flex max-w-7xl gap-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-8 space-y-1 rounded-3xl border border-white/10 bg-[#0d0b18] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
            <p className="gradient-text px-3 py-2 text-xs font-bold uppercase tracking-[0.2em]">{t('brand.name')}</p>
            {tabs.map((tab) => {
              const Icon = TAB_ICONS[tab];
              const isActive = activeTab === tab;
              const isInvitar = tab === 'invitar';
              return (
                <button
                  key={tab}
                  onClick={() => onTabChange(tab)}
                  className={`group flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-all duration-200 ease-out ${
                    isActive
                      ? 'gradient-btn translate-x-0.5 shadow-[0_6px_18px_rgba(139,92,246,0.35)]'
                      : isInvitar
                        ? 'border border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.08)] text-teal-200 hover:translate-x-0.5 hover:bg-[rgba(45,212,191,0.14)]'
                        : 'text-white/60 hover:translate-x-0.5 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 ${
                      isActive ? 'scale-110' : 'group-hover:scale-110'
                    }`}
                  />
                  <span className="truncate">{t(tabLabelKey(tab, isAdmin))}</span>
                  {isInvitar && !isActive ? <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#2dd4bf]" /> : null}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          <section className="fade-up sticky top-2 z-30 rounded-2xl border border-white/10 bg-[#0d0b18]/95 px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:rounded-3xl sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-white sm:gap-3">
              <div className="flex min-w-0 items-center gap-2 min-[360px]:gap-3">
                {!isAdmin && photoUrl ? (
                  <AvatarInitials name={displayName} size={28} colorHex="#2dd4bf" photoUrl={photoUrl} ring />
                ) : (
                  <span className="gradient-btn rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                    {isAdmin ? t('shell.role.admin') : t('shell.role.agent')}
                  </span>
                )}
                <span className="truncate font-semibold text-white/85">
                  {displayName}
                  {isVerified ? (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 align-middle text-[10px] font-semibold text-emerald-300">
                      ✓ {t('shell.verificado')}
                    </span>
                  ) : null}
                </span>
              </div>

              <div className="hidden items-center gap-2 lg:flex">
                <LanguageSwitch />
                <button
                  onClick={onLogout}
                  className="inline-flex h-10 items-center rounded-full border border-white/15 bg-white/5 px-4 text-xs font-semibold text-white/80 transition-all duration-200 hover:scale-[1.03] hover:bg-white/10"
                >
                  {t('shell.logout')}
                </button>
              </div>

              <button
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-expanded={mobileMenuOpen}
                aria-label={t('shell.menu')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition-colors duration-200 hover:bg-white/10 lg:hidden"
              >
                {mobileMenuOpen ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
              </button>
            </div>

            {mobileMenuOpen ? (
              <div className="fade-up mt-3 space-y-1 border-t border-white/10 pt-3 lg:hidden">
                {tabs.map((tab) => {
                  const Icon = TAB_ICONS[tab];
                  const isActive = activeTab === tab;
                  const isInvitar = tab === 'invitar';
                  return (
                    <button
                      key={tab}
                      onClick={() => selectTab(tab)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors duration-150 ${
                        isActive
                          ? 'bg-violet-400/15 text-violet-300'
                          : isInvitar
                            ? 'border border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.08)] text-teal-200'
                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="truncate">{t(tabLabelKey(tab, isAdmin))}</span>
                      {isInvitar && !isActive ? <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#2dd4bf]" /> : null}
                    </button>
                  );
                })}
                <div className="flex items-center justify-between gap-2 pt-2">
                  <LanguageSwitch />
                  <button
                    onClick={onLogout}
                    className="inline-flex h-10 items-center rounded-full border border-white/15 bg-white/5 px-4 text-xs font-semibold text-white/80 transition-all duration-200 hover:bg-white/10"
                  >
                    {t('shell.logout')}
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          {children}
        </div>
      </div>
    </main>
  );
}
