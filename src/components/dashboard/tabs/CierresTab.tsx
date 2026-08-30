'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { ModuleHeader } from '../CardKit';
import { IconMapPin } from '../icons';
import SlideOverPanel from '../SlideOverPanel';
import CierreFormPanel, { type NewClosedDealInput, type SavedDealResult } from './CierreFormPanel';
import {
  CLOSED_DEAL_PROPERTY_TYPES,
  pinColorFor,
  pricePerM2,
} from '@/lib/real-estate/closed-deals-config';
import { MIN_SAMPLE_SIZE, QUITO_ZONES, zoneLabel } from '@/lib/real-estate/quito-zones';
import type { MapFilters } from '../CierresMapa';
import type { ClosedDealItem } from '../types';

const CierresMapa = dynamic(() => import('../CierresMapa'), { ssr: false, loading: () => <div className="h-[420px] w-full animate-pulse rounded-2xl bg-surface-2 sm:h-[560px]" /> });

export default function CierresTab({
  canAccess,
  canCreate,
  deals,
  myZones,
  onCreateDeal,
  onUpdateDeal,
  onDeleteDeal,
  creating,
}: {
  canAccess: boolean;
  canCreate: boolean;
  deals: ClosedDealItem[];
  myZones?: string[];
  onCreateDeal: (input: NewClosedDealInput) => Promise<void>;
  onUpdateDeal: (id: string, input: NewClosedDealInput) => Promise<void>;
  onDeleteDeal: (id: string) => Promise<void>;
  creating: boolean;
}) {
  const { t, tProperty, lang } = useLanguage();

  const [consultaView, setConsultaView] = useState<'mapa' | 'tabla'>('mapa');
  const [filterPropertyType, setFilterPropertyType] = useState('');
  const [filterSector, setFilterSector] = useState('');
  const [sortKey, setSortKey] = useState<'closedAt' | 'price' | 'pricePerM2'>('closedAt');
  const [sortDesc, setSortDesc] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [mapFilters, setMapFilters] = useState<MapFilters>({});
  const [mapFiltersOpen, setMapFiltersOpen] = useState(false);
  const [focusZoneKey, setFocusZoneKey] = useState<string | null>(null);
  const [mapCount, setMapCount] = useState(0);
  const [mobilePanel, setMobilePanel] = useState<'mapa' | 'resumen'>('mapa');

  const [showForm, setShowForm] = useState(false);
  const [editingDeal, setEditingDeal] = useState<ClosedDealItem | null>(null);
  const [pendingFocus, setPendingFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Resumen por zona: solo lo esencial (nombre, conteo, precio/m2 promedio) - el
  // detalle real (antiguedad, forma de pago, tiempo en mercado) vive en el popup
  // de cada pin, no duplicado aqui en una barra lateral pesada.
  const zoneStats = useMemo(() => {
    return QUITO_ZONES.map((zone) => {
      const zoneDeals = deals.filter((d) => d.zone === zone.key);
      const withPpm2 = zoneDeals
        .map((d) => pricePerM2({ propertyType: d.propertyType, price: d.price, areaM2: d.areaM2, landAreaM2: d.landAreaM2 }))
        .filter((x): x is number => typeof x === 'number' && x > 0);
      const avgPpm2 = withPpm2.length > 0 ? withPpm2.reduce((a, b) => a + b, 0) / withPpm2.length : null;
      return { zone, count: zoneDeals.length, avgPpm2 };
    }).filter((z) => z.count > 0);
  }, [deals]);

  const availableSectors = useMemo(() => {
    return [...new Set(deals.map((d) => d.sector).filter((s): s is string => Boolean(s)))].sort((a, b) => a.localeCompare(b));
  }, [deals]);

  const tableRows = useMemo(() => {
    const withPpm2 = deals.map((d) => ({
      deal: d,
      ppm2: pricePerM2({ propertyType: d.propertyType, price: d.price, areaM2: d.areaM2, landAreaM2: d.landAreaM2 }),
    }));
    const filtered = withPpm2
      .filter((r) => (filterPropertyType ? r.deal.propertyType === filterPropertyType : true))
      .filter((r) => (filterSector ? r.deal.sector === filterSector : true));

    filtered.sort((a, b) => {
      let diff = 0;
      if (sortKey === 'closedAt') diff = new Date(a.deal.closedAt).getTime() - new Date(b.deal.closedAt).getTime();
      else if (sortKey === 'price') diff = a.deal.price - b.deal.price;
      else diff = (a.ppm2 ?? 0) - (b.ppm2 ?? 0);
      return sortDesc ? -diff : diff;
    });
    return filtered;
  }, [deals, filterPropertyType, filterSector, sortKey, sortDesc]);

  function toggleSort(key: 'closedAt' | 'price' | 'pricePerM2') {
    if (sortKey === key) setSortDesc((v) => !v);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  function openCreateForm() {
    setEditingDeal(null);
    setShowForm(true);
  }

  function openEditForm(deal: ClosedDealItem) {
    setEditingDeal(deal);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingDeal(null);
  }

  function handleSaved(result: SavedDealResult) {
    setShowForm(false);
    setEditingDeal(null);
    setConsultaView('mapa');
    setPendingFocus({ lat: result.latitude, lng: result.longitude });
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await onDeleteDeal(id);
    } finally {
      setDeletingId(null);
    }
  }

  if (!canAccess) {
    return (
      <section className="glass-card rounded-[1.8rem] p-4 fade-up sm:p-6">
        <h2 className="text-xl font-bold text-text">{t('nav.cierres')}</h2>
        <p className="mt-2 text-sm text-text-2">{t('cierres.locked.detail')}</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader icon={<IconMapPin className="h-[17px] w-[17px]" strokeWidth={1.8} />} title={t('nav.cierres')} subtitle={t('cierres.moduleSubtitle')} />

      <section className="glass-card rounded-[1.8rem] p-4 fade-up sm:p-6">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[20px] font-bold tracking-[-0.01em] text-text">{t('cierres.list.title')}</h2>
            <p className="text-[13.5px] text-text-2">{t('cierres.list.subtitle')}</p>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-full border border-line bg-surface-2 p-[3px]">
            <button
              onClick={() => setConsultaView('mapa')}
              className={`rounded-full px-[18px] py-[7px] text-[13px] font-bold transition-colors duration-150 ${consultaView === 'mapa' ? 'bg-brand text-brand-contrast' : 'text-text-2 hover:text-text'}`}
            >
              {t('cierres.tabMapa')}
            </button>
            <button
              onClick={() => setConsultaView('tabla')}
              className={`rounded-full px-[18px] py-[7px] text-[13px] font-bold transition-colors duration-150 ${consultaView === 'tabla' ? 'bg-brand text-brand-contrast' : 'text-text-2 hover:text-text'}`}
            >
              {t('cierres.tabTabla')}
            </button>
          </div>
          <button
            onClick={() => (consultaView === 'mapa' ? setMapFiltersOpen((v) => !v) : setFiltersOpen((v) => !v))}
            className="rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold text-text-2 transition-colors hover:text-text"
          >
            {t('cierres.filtros')} ▾
          </button>
          {deals.length > 0 ? (
            <span className="text-xs font-semibold text-text-3">
              {t('cierres.mostrandoCierres')} {consultaView === 'mapa' ? mapCount : tableRows.length}
            </span>
          ) : null}
        </div>

        {deals.length === 0 ? (
          <EmptyMapState t={t} onRegister={canCreate ? openCreateForm : undefined} />
        ) : consultaView === 'mapa' ? (
          <div className="space-y-3">
            {/* Leyenda-filtro (seccion 2.4): chips tocables, no una caja pasiva. Finca
                comparte el color/bucket de Casa (ver paleta aprobada) y no tiene chip
                propio - sus pines quedan visibles solo en la vista "todos". */}
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('cierres.filtro.tipo')}>
              {CLOSED_DEAL_PROPERTY_TYPES.filter((pt) => pt !== 'FARM').map((pt) => {
                const active = mapFilters.propertyType === pt;
                return (
                  <button
                    key={pt}
                    onClick={() => setMapFilters((f) => ({ ...f, propertyType: active ? undefined : pt }))}
                    aria-pressed={active}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${
                      active ? 'border-transparent text-white shadow-sm' : 'border-line-strong text-text-2 hover:bg-surface-2'
                    }`}
                    style={active ? { backgroundColor: pinColorFor(pt) } : undefined}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: pinColorFor(pt) }} />
                    {tProperty(pt)}
                  </button>
                );
              })}
            </div>

            {mapFiltersOpen ? (
              <div className="flex flex-wrap gap-2 rounded-2xl border border-line bg-surface-2 p-3">
                <select
                  className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-xs text-text outline-none focus:border-brand"
                  value={mapFilters.sector ?? ''}
                  onChange={(e) => setMapFilters((f) => ({ ...f, sector: e.target.value || undefined }))}
                >
                  <option className="bg-bg" value="">{t('cierres.filtro.sector')}</option>
                  {availableSectors.map((s) => (
                    <option key={s} className="bg-bg" value={s}>{s}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {zoneStats.length > 0 ? (
              <div className="flex gap-2 rounded-full border border-line bg-surface-2 p-1 lg:hidden">
                <button onClick={() => setMobilePanel('mapa')} className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${mobilePanel === 'mapa' ? 'gradient-btn text-grad-contrast' : 'text-text-2'}`}>
                  {t('cierres.tabMapa')}
                </button>
                <button onClick={() => setMobilePanel('resumen')} className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${mobilePanel === 'resumen' ? 'gradient-btn text-grad-contrast' : 'text-text-2'}`}>
                  {t('cierres.resumenPorZona')}
                </button>
              </div>
            ) : null}

            <div className={`grid gap-4 ${zoneStats.length > 0 ? 'lg:grid-cols-[1fr,230px]' : ''}`}>
              <div className={mobilePanel === 'resumen' ? 'hidden lg:block' : ''}>
                <CierresMapa
                  filters={mapFilters}
                  focusZoneKey={focusZoneKey}
                  lang={lang}
                  tProperty={tProperty}
                  onCountChange={setMapCount}
                  myZones={myZones}
                  pendingFocus={pendingFocus}
                  onFocusHandled={() => setPendingFocus(null)}
                />
              </div>

              {zoneStats.length > 0 ? (
                <aside className={`space-y-1.5 ${mobilePanel === 'mapa' ? 'hidden lg:block' : ''}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('cierres.resumenPorZona')}</p>
                  {zoneStats.map((zs) => {
                    const smallSample = zs.count < MIN_SAMPLE_SIZE;
                    return (
                      <button
                        key={zs.zone.key}
                        onClick={() => setFocusZoneKey(zs.zone.key)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors duration-200 ${
                          focusZoneKey === zs.zone.key ? 'border-brand-line bg-brand-dim' : 'border-line bg-surface-2 hover:bg-surface'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-text">{zoneLabel(zs.zone.key, lang)}</span>
                          <span className="block text-[11px] text-text-3">{zs.count} {t('cierres.cierresRegistrados')}</span>
                          {smallSample ? <span className="block text-[10.5px] font-semibold text-amber-400">{t('cierres.muestraChica')}</span> : null}
                        </span>
                        {!smallSample && zs.avgPpm2 ? (
                          <span className="shrink-0 text-right text-xs font-bold text-text">${Math.round(zs.avgPpm2).toLocaleString('en-US')}/m²</span>
                        ) : null}
                      </button>
                    );
                  })}
                </aside>
              ) : null}
            </div>
          </div>
        ) : (
          <div>
            {filtersOpen ? (
              <div className="mb-3 flex flex-wrap gap-2">
                <select className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-xs text-text outline-none focus:border-brand" value={filterPropertyType} onChange={(e) => setFilterPropertyType(e.target.value)}>
                  <option className="bg-bg" value="">{t('cierres.filtro.tipo')}</option>
                  {CLOSED_DEAL_PROPERTY_TYPES.map((v) => (
                    <option key={v} className="bg-bg" value={v}>{tProperty(v)}</option>
                  ))}
                </select>
                <select className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-xs text-text outline-none focus:border-brand" value={filterSector} onChange={(e) => setFilterSector(e.target.value)}>
                  <option className="bg-bg" value="">{t('cierres.filtro.sector')}</option>
                  {availableSectors.map((s) => (
                    <option key={s} className="bg-bg" value={s}>{s}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {tableRows.length === 0 ? (
              <EmptyMapState t={t} onRegister={canCreate ? openCreateForm : undefined} />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-surface p-3">
                <table className="hidden w-full min-w-[680px] text-left text-xs text-text-2 sm:table">
                  <thead>
                    <tr className="border-b border-line text-text-3">
                      <th className="py-2 pr-3">{t('cierres.zonaQuito')}</th>
                      <th className="py-2 pr-3">{t('cierres.filtro.tipo')}</th>
                      <th className="cursor-pointer py-2 pr-3" onClick={() => toggleSort('price')}>{t('cierres.form.precio.placeholder')} {sortKey === 'price' ? (sortDesc ? '↓' : '↑') : ''}</th>
                      <th className="cursor-pointer py-2 pr-3" onClick={() => toggleSort('pricePerM2')}>$/m² {sortKey === 'pricePerM2' ? (sortDesc ? '↓' : '↑') : ''}</th>
                      <th className="cursor-pointer py-2 pr-3" onClick={() => toggleSort('closedAt')}>{t('cierres.cerrado')} {sortKey === 'closedAt' ? (sortDesc ? '↓' : '↑') : ''}</th>
                      <th className="py-2 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map(({ deal, ppm2 }) => (
                      <tr key={deal.id} className="border-b border-line">
                        <td className="py-2 pr-3">{zoneLabel(deal.zone ?? '', lang)}</td>
                        <td className="py-2 pr-3">{tProperty(deal.propertyType)}</td>
                        <td className="py-2 pr-3 font-semibold text-text">${deal.price.toLocaleString('en-US')}</td>
                        <td className="py-2 pr-3">{ppm2 ? `$${Math.round(ppm2).toLocaleString('en-US')}` : '—'}</td>
                        <td className="py-2 pr-3">{new Date(deal.closedAt).toLocaleDateString(lang === 'es' ? 'es-EC' : 'en-US', { month: 'short', year: 'numeric' })}</td>
                        <td className="py-2 pr-3">
                          {deal.canEdit ? (
                            <button onClick={() => openEditForm(deal)} aria-label={t('cierres.editar')} className="rounded-full border border-line-strong p-1.5 text-text-2 transition-colors hover:text-brand">
                              <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="space-y-2 sm:hidden">
                  {tableRows.map(({ deal, ppm2 }) => (
                    <div key={deal.id} className="min-w-0 rounded-xl border border-line bg-surface-2 p-3 text-xs text-text-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate font-semibold text-text">{tProperty(deal.propertyType)} · {zoneLabel(deal.zone ?? '', lang)}{deal.sector ? ` - ${deal.sector}` : ''}</p>
                        {deal.canEdit ? (
                          <button onClick={() => openEditForm(deal)} aria-label={t('cierres.editar')} className="shrink-0 rounded-full border border-line-strong p-1.5 text-text-2">
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-1">${deal.price.toLocaleString('en-US')} {ppm2 ? `· $${Math.round(ppm2).toLocaleString('en-US')}/m²` : ''}</p>
                      <p className="mt-1 text-text-3">{new Date(deal.closedAt).toLocaleDateString(lang === 'es' ? 'es-EC' : 'en-US', { month: 'short', year: 'numeric' })}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {canCreate && deals.some((d) => d.canEdit) ? (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-3 text-sm font-bold text-text">{t('cierres.misCierres')}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {deals.filter((d) => d.canEdit).map((deal) => (
                <div key={deal.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-text-2">
                  <span className="min-w-0 truncate">{tProperty(deal.propertyType)} · {zoneLabel(deal.zone ?? '', lang)}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => openEditForm(deal)}
                      aria-label={t('cierres.editar')}
                      className="rounded-full border border-line-strong px-2.5 py-1 font-semibold text-text-2 transition-colors duration-200 hover:border-brand hover:text-brand"
                    >
                      {t('cierres.editar')}
                    </button>
                    <button
                      onClick={() => handleDelete(deal.id)}
                      disabled={deletingId === deal.id}
                      className="rounded-full border border-danger bg-danger-dim px-2.5 py-1 font-semibold text-danger transition-colors duration-200 hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === deal.id ? t('cierres.eliminando') : t('cierres.eliminar')}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {canCreate ? (
        <button
          onClick={openCreateForm}
          aria-label={t('cierres.fab.ariaLabel')}
          title={t('cierres.fab.ariaLabel')}
          className="gradient-btn fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-grad-contrast shadow-xl transition-transform duration-200 hover:scale-105 sm:bottom-8 sm:right-8"
        >
          <Plus className="h-6 w-6" strokeWidth={2.2} />
        </button>
      ) : null}

      <SlideOverPanel open={showForm} onClose={closeForm} title={editingDeal ? t('cierres.editando') : t('cierres.form.title')}>
        <CierreFormPanel
          deals={deals}
          editingDeal={editingDeal}
          onCreateDeal={onCreateDeal}
          onUpdateDeal={onUpdateDeal}
          creating={creating}
          onSaved={handleSaved}
          onCancel={closeForm}
        />
      </SlideOverPanel>
    </div>
  );
}

function EmptyMapState({ t, onRegister }: { t: (k: string) => string; onRegister?: () => void }) {
  return (
    <div className="relative min-h-[280px] overflow-hidden rounded-2xl border border-line bg-bg-alt">
      <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[var(--glow-brand)] blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-16 -right-10 h-56 w-56 rounded-full bg-[var(--glow-accent)] blur-[80px]" />
      <div className="relative flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-text-3">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
          0 {t('cierres.cierresRegistrados')}
        </span>
        <h3 className="text-[16.5px] font-bold text-text">{t('cierres.estadoVacio.titulo')}</h3>
        <p className="max-w-xs text-[13.5px] text-text-2">{t('cierres.estadoVacio.texto')}</p>
        {onRegister ? (
          <button
            onClick={onRegister}
            className="mt-1 rounded-[10px] bg-grad px-5 py-3 text-sm font-bold text-grad-contrast transition-[filter] duration-150 hover:brightness-[1.08]"
          >
            {t('cierres.registrarPrimero')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
