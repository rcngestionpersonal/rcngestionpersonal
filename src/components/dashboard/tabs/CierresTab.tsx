'use client';

import dynamic from 'next/dynamic';
import { useMemo, useRef, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { Card, ModuleHeader, RegisterAccordion } from '../CardKit';
import { IconTarget } from '../icons';
import { POINT_ACTIONS } from '@/lib/real-estate/points';
import { PriceInput } from '../PriceInput';
import {
  ANTIGUEDAD_OPTIONS,
  CLOSED_DEAL_PROPERTY_TYPES,
  ENTIDAD_FINANCIERA_OPTIONS,
  ESTADO_OPTIONS,
  FORMA_PAGO_OPTIONS,
  PROPERTY_PIN_COLORS,
  TIEMPO_MERCADO_OPTIONS,
  UBICACION_COMERCIAL_OPTIONS,
  USO_SUELO_OPTIONS,
  pinColorFor,
  pricePerM2,
  requiresAntiguedadYEstado,
  roundCoord,
  validateClosedDeal,
  type ClosedDealDetails,
} from '@/lib/real-estate/closed-deals-config';
import { MIN_SAMPLE_SIZE, QUITO_ZONES, sectorsForZone, zoneForCoordinates, zoneLabel } from '@/lib/real-estate/quito-zones';
import type { MapFilters } from '../CierresMapa';
import type { ClosedDealItem } from '../types';

const ClosedDealsMap = dynamic(() => import('../ClosedDealsMap'), { ssr: false, loading: () => <div className="h-64 w-full animate-pulse rounded-2xl bg-surface-2 sm:h-80" /> });
const CierresMapa = dynamic(() => import('../CierresMapa'), { ssr: false, loading: () => <div className="h-[420px] w-full animate-pulse rounded-2xl bg-surface-2 sm:h-[560px]" /> });

export type NewClosedDealInput = {
  operationType: 'SALE' | 'RENT' | 'BOTH';
  propertyType: string;
  zone: string;
  sector: string;
  microzona?: string;
  antiguedad?: string;
  estadoInmueble?: string;
  details?: ClosedDealDetails;
  latitude?: number;
  longitude?: number;
  price: number;
  publicationPrice?: number;
  areaM2?: number;
  landAreaM2?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  timeOnMarket: string;
  paymentMethod: string;
  financialEntity?: string;
  approvalDelayed?: boolean;
  closedAt: string;
  declaredAccurate: true;
};

function pillClasses(active: boolean): string {
  return active ? 'gradient-btn border-transparent text-grad-contrast' : 'border-line-strong text-text-2 hover:bg-surface-2';
}

function sectionBKind(propertyType: string): 'CASA' | 'DEPTO_SUITE' | 'TERRENO' | 'LOCAL' {
  if (propertyType === 'HOUSE' || propertyType === 'FARM') return 'CASA';
  if (propertyType === 'APARTMENT' || propertyType === 'SUITE') return 'DEPTO_SUITE';
  if (propertyType === 'LAND') return 'TERRENO';
  return 'LOCAL';
}

function monthYearToIso(value: string): string {
  // value viene de <input type="month"> como "2026-07"
  if (!value) return new Date().toISOString();
  return new Date(`${value}-01T12:00:00Z`).toISOString();
}

function isoToMonthYear(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function CierresTab({
  canAccess,
  canCreate,
  deals,
  onCreateDeal,
  onUpdateDeal,
  onDeleteDeal,
  creating,
}: {
  canAccess: boolean;
  canCreate: boolean;
  deals: ClosedDealItem[];
  onCreateDeal: (input: NewClosedDealInput) => Promise<void>;
  onUpdateDeal: (id: string, input: NewClosedDealInput) => Promise<void>;
  onDeleteDeal: (id: string) => Promise<void>;
  creating: boolean;
}) {
  const { t, tProperty, tOperation, lang } = useLanguage();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [operationType, setOperationType] = useState<'SALE' | 'RENT' | 'BOTH'>('SALE');
  const [propertyType, setPropertyType] = useState('HOUSE');
  const [zoneKey, setZoneKey] = useState('');
  const [sector, setSector] = useState('');
  const [sectorOtro, setSectorOtro] = useState('');
  const [microzona, setMicrozona] = useState('');
  const [antiguedad, setAntiguedad] = useState('');
  const [estadoInmueble, setEstadoInmueble] = useState('');
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);

  // Seccion B (condicional)
  const [esIndependiente, setEsIndependiente] = useState<boolean | null>(null);
  const [plantas, setPlantas] = useState('');
  const [terrenoM2, setTerrenoM2] = useState('');
  const [areaM2, setAreaM2] = useState('');
  const [alicuotaMensual, setAlicuotaMensual] = useState('');
  const [piso, setPiso] = useState('');
  const [tieneAscensor, setTieneAscensor] = useState<boolean | null>(null);
  const [tieneBodega, setTieneBodega] = useState<boolean | null>(null);
  const [urbanizadoConServicios, setUrbanizadoConServicios] = useState<boolean | null>(null);
  const [usoSuelo, setUsoSuelo] = useState('');
  const [frenteM, setFrenteM] = useState('');
  const [esEsquinero, setEsEsquinero] = useState<boolean | null>(null);
  const [ubicacionComercial, setUbicacionComercial] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [parkingSpaces, setParkingSpaces] = useState('');

  // Seccion C
  const [publicationPrice, setPublicationPrice] = useState('');
  const [price, setPrice] = useState('');
  const [closedMonth, setClosedMonth] = useState('');
  const [timeOnMarket, setTimeOnMarket] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [financialEntity, setFinancialEntity] = useState('');
  const [approvalDelayed, setApprovalDelayed] = useState(false);

  // Seccion D
  const [declaredAccurate, setDeclaredAccurate] = useState(false);
  const [formError, setFormError] = useState('');
  const [warning, setWarning] = useState('');

  const kind = sectionBKind(propertyType);
  const sectorOptions = zoneKey ? sectorsForZone(zoneKey) : [];

  // --- Consulta (mapa/tabla) ---
  const accordionRef = useRef<HTMLDivElement | null>(null);
  const [consultaView, setConsultaView] = useState<'mapa' | 'tabla'>('mapa');
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [filterPropertyType, setFilterPropertyType] = useState('');
  const [filterSector, setFilterSector] = useState('');
  const [sortKey, setSortKey] = useState<'closedAt' | 'price' | 'pricePerM2'>('closedAt');
  const [sortDesc, setSortDesc] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  function openRegisterAccordion() {
    setFormOpen(true);
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    accordionRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  }

  // --- Mapa geografico: filtros propios (independientes de la Tabla), zona enfocada,
  // contador reactivo y panel "Resumen por zona" (tab en movil) ---
  const [mapFilters, setMapFilters] = useState<MapFilters>({});
  const [mapFiltersOpen, setMapFiltersOpen] = useState(false);
  const [focusZoneKey, setFocusZoneKey] = useState<string | null>(null);
  const [mapCount, setMapCount] = useState(0);
  const [mobilePanel, setMobilePanel] = useState<'mapa' | 'resumen'>('mapa');

  function resetForm() {
    setEditingId(null);
    setOperationType('SALE');
    setPropertyType('HOUSE');
    setZoneKey('');
    setSector('');
    setSectorOtro('');
    setMicrozona('');
    setAntiguedad('');
    setEstadoInmueble('');
    setPickedLat(null);
    setPickedLng(null);
    setEsIndependiente(null);
    setPlantas('');
    setTerrenoM2('');
    setAreaM2('');
    setAlicuotaMensual('');
    setPiso('');
    setTieneAscensor(null);
    setTieneBodega(null);
    setUrbanizadoConServicios(null);
    setUsoSuelo('');
    setFrenteM('');
    setEsEsquinero(null);
    setUbicacionComercial('');
    setBedrooms('');
    setBathrooms('');
    setParkingSpaces('');
    setPublicationPrice('');
    setPrice('');
    setClosedMonth('');
    setTimeOnMarket('');
    setPaymentMethod('');
    setFinancialEntity('');
    setApprovalDelayed(false);
    setDeclaredAccurate(false);
    setFormError('');
    setWarning('');
  }

  function cancelEdit() {
    resetForm();
    setFormOpen(false);
  }

  function buildDetails(): ClosedDealDetails {
    const details: ClosedDealDetails = {};
    if (kind === 'CASA') {
      if (esIndependiente !== null) details.esIndependiente = esIndependiente;
      if (plantas.trim()) details.plantas = Number(plantas);
      if (alicuotaMensual.trim() && esIndependiente === false) details.alicuotaMensual = Number(alicuotaMensual);
    }
    if (kind === 'DEPTO_SUITE') {
      if (piso.trim()) details.piso = Number(piso);
      if (tieneAscensor !== null) details.tieneAscensor = tieneAscensor;
      if (tieneBodega !== null) details.tieneBodega = tieneBodega;
      if (alicuotaMensual.trim()) details.alicuotaMensual = Number(alicuotaMensual);
    }
    if (kind === 'TERRENO') {
      if (urbanizadoConServicios !== null) details.urbanizadoConServicios = urbanizadoConServicios;
      if (usoSuelo) details.usoSuelo = usoSuelo;
      if (frenteM.trim()) details.frenteM = Number(frenteM);
      if (esEsquinero !== null) details.esEsquinero = esEsquinero;
    }
    if (kind === 'LOCAL') {
      if (ubicacionComercial) details.ubicacionComercial = ubicacionComercial;
    }
    return details;
  }

  async function submit() {
    setFormError('');
    setWarning('');

    const finalSector = sector === '__otro__' ? sectorOtro.trim() : sector;
    const closedAtIso = monthYearToIso(closedMonth);
    const priceNum = Number(price || '0');
    const publicationPriceNum = publicationPrice.trim() ? Number(publicationPrice) : undefined;
    const areaM2Num = areaM2.trim() ? Number(areaM2) : undefined;
    const landAreaNum = terrenoM2.trim() ? Number(terrenoM2) : undefined;

    const needsAntiguedadEstado = requiresAntiguedadYEstado(propertyType);
    if (!zoneKey || !finalSector || (needsAntiguedadEstado && (!antiguedad || !estadoInmueble)) || !timeOnMarket || !paymentMethod) {
      setFormError(t('cierres.form.errorCampos'));
      return;
    }
    if (!declaredAccurate) {
      setFormError(t('cierres.form.errorDeclaracion'));
      return;
    }

    const { errors, warnings } = validateClosedDeal({
      propertyType,
      price: priceNum,
      publicationPrice: publicationPriceNum,
      areaM2: kind === 'TERRENO' ? undefined : areaM2Num,
      landAreaM2: kind === 'TERRENO' ? landAreaNum : kind === 'CASA' && esIndependiente ? landAreaNum : undefined,
      closedAt: closedAtIso,
      details: buildDetails(),
    });
    if (Object.keys(errors).length > 0) {
      setFormError(Object.values(errors)[0]);
      return;
    }
    if (warnings.length > 0) {
      setWarning(warnings[0]);
    }

    const input: NewClosedDealInput = {
      operationType,
      propertyType,
      zone: zoneKey,
      sector: finalSector,
      microzona: microzona.trim() || undefined,
      antiguedad: needsAntiguedadEstado ? antiguedad : undefined,
      estadoInmueble: needsAntiguedadEstado ? estadoInmueble : undefined,
      details: buildDetails(),
      latitude: pickedLat !== null ? roundCoord(pickedLat) : undefined,
      longitude: pickedLng !== null ? roundCoord(pickedLng) : undefined,
      price: priceNum,
      publicationPrice: publicationPriceNum,
      areaM2: kind === 'TERRENO' ? undefined : areaM2Num,
      landAreaM2: kind === 'TERRENO' ? landAreaNum : kind === 'CASA' && esIndependiente ? landAreaNum : undefined,
      bedrooms: bedrooms.trim() ? Number(bedrooms) : undefined,
      bathrooms: bathrooms.trim() ? Number(bathrooms) : undefined,
      parkingSpaces: parkingSpaces.trim() ? Number(parkingSpaces) : undefined,
      timeOnMarket,
      paymentMethod,
      financialEntity: paymentMethod === 'CONTADO' || paymentMethod === 'OTRO' ? undefined : financialEntity || undefined,
      approvalDelayed: paymentMethod === 'CREDITO' ? approvalDelayed : undefined,
      closedAt: closedAtIso,
      declaredAccurate: true,
    };

    if (editingId) {
      await onUpdateDeal(editingId, input);
    } else {
      await onCreateDeal(input);
    }
    resetForm();
    setFormOpen(false);
    setSuccessMsg(t('cierres.form.exito'));
    setTimeout(() => setSuccessMsg(''), 6000);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await onDeleteDeal(id);
    } finally {
      setDeletingId(null);
    }
  }

  // --- Agregados por zona para la vista de Mapa ---
  const zoneStats = useMemo(() => {
    return QUITO_ZONES.map((zone) => {
      const zoneDeals = deals.filter((d) => d.zone === zone.key);
      const withPpm2 = zoneDeals
        .map((d) => ({ deal: d, ppm2: pricePerM2({ propertyType: d.propertyType, price: d.price, areaM2: d.areaM2, landAreaM2: d.landAreaM2 }) }))
        .filter((x): x is { deal: ClosedDealItem; ppm2: number } => typeof x.ppm2 === 'number' && x.ppm2 > 0);

      const ppm2Values = withPpm2.map((x) => x.ppm2);
      const avgPpm2 = ppm2Values.length > 0 ? ppm2Values.reduce((a, b) => a + b, 0) / ppm2Values.length : null;
      const minPpm2 = ppm2Values.length > 0 ? Math.min(...ppm2Values) : null;
      const maxPpm2 = ppm2Values.length > 0 ? Math.max(...ppm2Values) : null;

      const withGap = zoneDeals.filter((d) => d.publicationPrice && d.publicationPrice > 0);
      const avgGapPct =
        withGap.length > 0
          ? (withGap.reduce((acc, d) => acc + (d.price - (d.publicationPrice as number)) / (d.publicationPrice as number), 0) / withGap.length) * 100
          : null;

      const paymentCounts = new Map<string, number>();
      for (const d of zoneDeals) {
        if (!d.paymentMethod) continue;
        paymentCounts.set(d.paymentMethod, (paymentCounts.get(d.paymentMethod) ?? 0) + 1);
      }

      const sectorCounts = new Map<string, number>();
      for (const d of zoneDeals) {
        if (!d.sector) continue;
        sectorCounts.set(d.sector, (sectorCounts.get(d.sector) ?? 0) + 1);
      }

      return {
        zone,
        count: zoneDeals.length,
        avgPpm2,
        minPpm2,
        maxPpm2,
        avgGapPct,
        paymentCounts: [...paymentCounts.entries()].sort((a, b) => b[1] - a[1]),
        sectorCounts: [...sectorCounts.entries()].sort((a, b) => b[1] - a[1]),
      };
    });
  }, [deals]);

  function maxIntensity(): number {
    return Math.max(1, ...zoneStats.map((z) => (z.avgPpm2 ?? 0)));
  }

  function zoneColor(avgPpm2: number | null, count: number): string {
    if (count < MIN_SAMPLE_SIZE || avgPpm2 === null) return 'rgba(255,255,255,0.05)';
    const intensity = Math.min(1, avgPpm2 / maxIntensity());
    const alpha = 0.15 + intensity * 0.55;
    return `rgba(139, 92, 246, ${alpha.toFixed(2)})`;
  }

  // Sectores presentes en los datos ya cargados: mientras mas se alimente el mapa,
  // mas sectores apareceran en este filtro (no una lista fija de las 9 zonas).
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

  if (!canAccess) {
    return (
      <section className="glass-card rounded-[1.8rem] p-4 fade-up sm:p-6">
        <h2 className="text-xl font-bold text-text">{t('nav.cierres')}</h2>
        <p className="mt-2 text-sm text-text-2">{t('cierres.locked.detail')}</p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      {/* PARTE 1: encabezado */}
      <ModuleHeader icon={<IconTarget className="h-[17px] w-[17px]" strokeWidth={1.8} />} title={t('nav.cierres')} subtitle={t('cierres.moduleSubtitle')} />

      {/* Tarjeta intro */}
      <Card>
        <h3 className="text-[18px] font-bold tracking-[-0.01em] text-text">{t('cierres.introTitulo1')}</h3>
        <p className="mb-2 text-[15px] font-bold text-brand">{t('cierres.introTitulo2')}</p>
        <p className="mb-[13px] text-sm leading-[1.65] text-text-2">
          {t('cierres.intro.p1')}
          <span className="font-semibold text-text">{t('cierres.intro.bold')}</span>
          {t('cierres.intro.p2')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.07)] px-[11px] py-[5px] text-[11.5px] font-semibold text-text-2">
            <Lock className="h-[11px] w-[11px] shrink-0 text-brand" strokeWidth={2.2} />
            {t('cierres.chip.anonimo')}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.07)] px-[11px] py-[5px] text-[11.5px] font-semibold text-text-2">
            <Check className="h-[11px] w-[11px] shrink-0 text-brand" strokeWidth={2.2} />
            {t('cierres.chip.datosAgregados')}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.07)] px-[11px] py-[5px] text-[11.5px] font-semibold text-text-2">
            <span className="shrink-0 text-brand">&#10022;</span>
            {t('cierres.chip.sumaRanking')}
          </span>
        </div>
      </Card>

      {successMsg ? (
        <div className="fade-up rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
          🏆 {successMsg}
        </div>
      ) : null}

      {/* PARTE 2: formulario */}
      {canCreate ? (
        <div ref={accordionRef}>
        <RegisterAccordion
          title={editingId ? t('cierres.editando') : t('cierres.form.title')}
          points={POINT_ACTIONS.CLOSING_REGISTERED.points}
          subtitle={t('cierres.form.subtitle')}
          open={formOpen}
          onToggle={() => (formOpen ? cancelEdit() : setFormOpen(true))}
        >
            <div className="space-y-6">
              {/* Seccion A */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-violet-300">{t('cierres.seccionA')}</p>
                <div className="flex flex-wrap gap-2">
                  {CLOSED_DEAL_PROPERTY_TYPES.map((value) => (
                    <button key={value} onClick={() => setPropertyType(value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(propertyType === value)}`}>
                      {tProperty(value)}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['SALE', 'RENT'] as const).map((value) => (
                    <button key={value} onClick={() => setOperationType(value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(operationType === value)}`}>
                      {tOperation(value)}
                    </button>
                  ))}
                </div>

                <p className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('cierres.zonaQuito')}</p>
                <div className="flex flex-wrap gap-2">
                  {QUITO_ZONES.map((zone) => (
                    <button
                      key={zone.key}
                      onClick={() => {
                        setZoneKey(zone.key);
                        setSector('');
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(zoneKey === zone.key)}`}
                    >
                      {zoneLabel(zone.key, lang)}
                    </button>
                  ))}
                </div>

                {zoneKey ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <select
                      className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none focus:border-violet-400"
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                    >
                      <option className="bg-bg" value="">{t('cierres.seleccionaSector')}</option>
                      {sectorOptions.map((s) => (
                        <option key={s} className="bg-bg" value={s}>{s}</option>
                      ))}
                      <option className="bg-bg" value="__otro__">{t('cierres.otroSector')}</option>
                    </select>
                    {sector === '__otro__' ? (
                      <input
                        className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400"
                        value={sectorOtro}
                        onChange={(e) => setSectorOtro(e.target.value)}
                        placeholder={t('cierres.otroSector.placeholder')}
                      />
                    ) : null}
                  </div>
                ) : null}

                <input
                  className="mt-3 w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400"
                  value={microzona}
                  onChange={(e) => setMicrozona(e.target.value)}
                  placeholder={t('cierres.microzona.placeholder')}
                />

                <p className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
                  {t('cierres.antiguedad.label')}
                  {kind === 'TERRENO' ? <span className="ml-1 normal-case text-text-3">({t('cierres.campoOpcional')})</span> : null}
                </p>
                <div className="flex flex-wrap gap-2">
                  {ANTIGUEDAD_OPTIONS.map((o) => (
                    <button key={o.value} onClick={() => setAntiguedad(o.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(antiguedad === o.value)}`}>
                      {lang === 'es' ? o.labelEs : o.labelEn}
                    </button>
                  ))}
                </div>

                <p className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
                  {t('cierres.estado.label')}
                  {kind === 'TERRENO' ? <span className="ml-1 normal-case text-text-3">({t('cierres.campoOpcional')})</span> : null}
                </p>
                <div className="flex flex-wrap gap-2">
                  {ESTADO_OPTIONS.map((o) => (
                    <button key={o.value} onClick={() => setEstadoInmueble(o.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(estadoInmueble === o.value)}`}>
                      {lang === 'es' ? o.labelEs : o.labelEn}
                    </button>
                  ))}
                </div>

                <p className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('cierres.ubicacionMapa.label')}</p>
                <ClosedDealsMap
                  points={[]}
                  pickable
                  pickedPosition={pickedLat !== null && pickedLng !== null ? { lat: pickedLat, lng: pickedLng } : null}
                  onPick={(lat, lng) => {
                    setPickedLat(lat);
                    setPickedLng(lng);
                    if (!zoneKey) {
                      const suggested = zoneForCoordinates(lat, lng);
                      if (suggested) setZoneKey(suggested);
                    }
                  }}
                />
                <p className="mt-1.5 text-[11px] text-text-3">{t('cierres.ubicacionMapa.privacidad')}</p>
              </div>

              {/* Seccion B (condicional) */}
              <div className="border-t border-line pt-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-violet-300">{t('cierres.seccionB')}</p>

                {kind === 'CASA' ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setEsIndependiente(true)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(esIndependiente === true)}`}>
                        {t('cierres.independiente')}
                      </button>
                      <button onClick={() => setEsIndependiente(false)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(esIndependiente === false)}`}>
                        {t('cierres.enConjunto')}
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {esIndependiente ? (
                        <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400" value={terrenoM2} type="number" min={0} onChange={(e) => setTerrenoM2(e.target.value)} placeholder={t('cierres.terrenoM2.placeholder')} />
                      ) : null}
                      <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400" value={areaM2} type="number" min={0} onChange={(e) => setAreaM2(e.target.value)} placeholder={esIndependiente ? t('cierres.construccionM2.placeholder') : t('cierres.metrajeHabitable.placeholder')} />
                      {esIndependiente === false ? (
                        <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400" value={alicuotaMensual} type="number" min={0} onChange={(e) => setAlicuotaMensual(e.target.value)} placeholder={t('cierres.alicuota.placeholder')} />
                      ) : null}
                      <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400" value={plantas} type="number" min={0} onChange={(e) => setPlantas(e.target.value)} placeholder={t('cierres.plantas.placeholder')} />
                      <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400" value={bedrooms} type="number" min={0} onChange={(e) => setBedrooms(e.target.value)} placeholder={t('cierres.form.habitaciones.placeholder')} />
                      <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400" value={bathrooms} type="number" min={0} onChange={(e) => setBathrooms(e.target.value)} placeholder={t('cierres.form.banos.placeholder')} />
                      <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400" value={parkingSpaces} type="number" min={0} onChange={(e) => setParkingSpaces(e.target.value)} placeholder={t('cierres.form.parqueaderos.placeholder')} />
                    </div>
                  </div>
                ) : null}

                {kind === 'DEPTO_SUITE' ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400" value={areaM2} type="number" min={0} onChange={(e) => setAreaM2(e.target.value)} placeholder={t('cierres.metrajeHabitable.placeholder')} />
                    <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400" value={piso} type="number" min={0} onChange={(e) => setPiso(e.target.value)} placeholder={t('cierres.piso.placeholder')} />
                    <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400" value={bedrooms} type="number" min={0} onChange={(e) => setBedrooms(e.target.value)} placeholder={t('cierres.form.habitaciones.placeholder')} />
                    <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400" value={bathrooms} type="number" min={0} onChange={(e) => setBathrooms(e.target.value)} placeholder={t('cierres.form.banos.placeholder')} />
                    <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400" value={parkingSpaces} type="number" min={0} onChange={(e) => setParkingSpaces(e.target.value)} placeholder={t('cierres.form.parqueaderos.placeholder')} />
                    <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400" value={alicuotaMensual} type="number" min={0} onChange={(e) => setAlicuotaMensual(e.target.value)} placeholder={t('cierres.alicuota.placeholder')} />
                    <label className="flex items-center gap-2 text-sm text-text-2">
                      <input type="checkbox" checked={tieneAscensor === true} onChange={(e) => setTieneAscensor(e.target.checked)} className="h-4 w-4 rounded" />
                      {t('cierres.tieneAscensor')}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-text-2">
                      <input type="checkbox" checked={tieneBodega === true} onChange={(e) => setTieneBodega(e.target.checked)} className="h-4 w-4 rounded" />
                      {t('cierres.tieneBodega')}
                    </label>
                  </div>
                ) : null}

                {kind === 'TERRENO' ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400" value={terrenoM2} type="number" min={0} onChange={(e) => setTerrenoM2(e.target.value)} placeholder={t('cierres.superficie.placeholder')} />
                      <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400" value={frenteM} type="number" min={0} onChange={(e) => setFrenteM(e.target.value)} placeholder={t('cierres.frente.placeholder')} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {USO_SUELO_OPTIONS.map((o) => (
                        <button key={o.value} onClick={() => setUsoSuelo(o.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(usoSuelo === o.value)}`}>
                          {lang === 'es' ? o.labelEs : o.labelEn}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm text-text-2">
                        <input type="checkbox" checked={urbanizadoConServicios === true} onChange={(e) => setUrbanizadoConServicios(e.target.checked)} className="h-4 w-4 rounded" />
                        {t('cierres.urbanizado')}
                      </label>
                      <label className="flex items-center gap-2 text-sm text-text-2">
                        <input type="checkbox" checked={esEsquinero === true} onChange={(e) => setEsEsquinero(e.target.checked)} className="h-4 w-4 rounded" />
                        {t('cierres.esquinero')}
                      </label>
                    </div>
                  </div>
                ) : null}

                {kind === 'LOCAL' ? (
                  <div className="space-y-3">
                    <input className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400 md:w-1/2" value={areaM2} type="number" min={0} onChange={(e) => setAreaM2(e.target.value)} placeholder={t('cierres.form.metraje.placeholder')} />
                    <div className="flex flex-wrap gap-2">
                      {UBICACION_COMERCIAL_OPTIONS.map((o) => (
                        <button key={o.value} onClick={() => setUbicacionComercial(o.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(ubicacionComercial === o.value)}`}>
                          {lang === 'es' ? o.labelEs : o.labelEn}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Seccion C */}
              <div className="border-t border-line pt-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-violet-300">{t('cierres.seccionC')}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <PriceInput value={publicationPrice} onChange={setPublicationPrice} placeholder={t('cierres.precioPublicacion.placeholder')} />
                  <PriceInput value={price} onChange={setPrice} placeholder={t('cierres.form.precio.placeholder')} helperText={t('common.precioAyuda')} />
                  <div>
                    <label className="mb-1 block text-[11px] text-text-3">{t('cierres.fechaCierre.label')}</label>
                    <input
                      type="month"
                      className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none focus:border-violet-400"
                      value={closedMonth}
                      max={isoToMonthYear(new Date().toISOString())}
                      onChange={(e) => setClosedMonth(e.target.value)}
                    />
                  </div>
                </div>

                <p className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('cierres.tiempoMercado.label')}</p>
                <div className="flex flex-wrap gap-2">
                  {TIEMPO_MERCADO_OPTIONS.map((o) => (
                    <button key={o.value} onClick={() => setTimeOnMarket(o.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(timeOnMarket === o.value)}`}>
                      {lang === 'es' ? o.labelEs : o.labelEn}
                    </button>
                  ))}
                </div>

                <p className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('cierres.formaPago.label')}</p>
                <div className="flex flex-wrap gap-2">
                  {FORMA_PAGO_OPTIONS.map((o) => (
                    <button key={o.value} onClick={() => setPaymentMethod(o.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(paymentMethod === o.value)}`}>
                      {lang === 'es' ? o.labelEs : o.labelEn}
                    </button>
                  ))}
                </div>

                {paymentMethod === 'CREDITO' || paymentMethod === 'MIXTO' ? (
                  <div className="mt-3 space-y-3 rounded-xl border border-line bg-surface-2 p-3">
                    <select
                      className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none focus:border-violet-400"
                      value={financialEntity}
                      onChange={(e) => setFinancialEntity(e.target.value)}
                    >
                      <option className="bg-bg" value="">{t('cierres.entidad.placeholder')}</option>
                      {ENTIDAD_FINANCIERA_OPTIONS.map((entity) => (
                        <option key={entity} className="bg-bg" value={entity}>{entity}</option>
                      ))}
                    </select>
                    {paymentMethod === 'CREDITO' ? (
                      <label className="flex items-center gap-2 text-sm text-text-2">
                        <input type="checkbox" checked={approvalDelayed} onChange={(e) => setApprovalDelayed(e.target.checked)} className="h-4 w-4 rounded" />
                        {t('cierres.aprobacionDemoro')}
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Seccion D */}
              <div className="border-t border-line pt-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-violet-300">{t('cierres.seccionD')}</p>
                <label className="flex items-start gap-2.5 text-sm text-text-2">
                  <input type="checkbox" checked={declaredAccurate} onChange={(e) => setDeclaredAccurate(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded" />
                  {t('cierres.declaracion')}
                </label>
              </div>

              {warning ? <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">⚠️ {warning}</p> : null}
              {formError ? <p className="rounded-xl border border-pink-400/30 bg-pink-500/10 px-3 py-2 text-xs text-pink-200">{formError}</p> : null}

              <div className="flex gap-2">
                <button
                  onClick={submit}
                  disabled={creating || !declaredAccurate}
                  className="gradient-btn flex-1 rounded-full px-4 py-2.5 text-sm font-semibold text-grad-contrast transition-transform duration-200 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:flex-none"
                >
                  {creating ? t('cierres.form.guardando') : editingId ? t('cierres.guardarCambios') : t('cierres.form.submit')}
                </button>
                {editingId ? (
                  <button onClick={cancelEdit} className="rounded-full border border-line-strong px-4 py-2.5 text-sm font-semibold text-text-2 transition-colors duration-200 hover:bg-surface-2">
                    {t('cierres.cancelar')}
                  </button>
                ) : null}
              </div>
            </div>
        </RegisterAccordion>
        </div>
      ) : null}

      {/* PARTE 3: consulta */}
      <section className="glass-card rounded-[1.8rem] p-4 fade-up sm:p-6">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[20px] font-bold tracking-[-0.01em] text-text">{t('cierres.list.title')}</h2>
            <p className="text-[13.5px] text-text-2">{t('cierres.list.subtitle')}</p>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-full border border-[rgba(255,255,255,0.07)] bg-[#1c1930] p-[3px]">
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
            className="rounded-full border border-[rgba(255,255,255,0.07)] px-3 py-1.5 text-[13px] font-semibold text-text-2 transition-colors hover:text-text"
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
          <EmptyMapState t={t} onRegister={openRegisterAccordion} />
        ) : consultaView === 'mapa' ? (
          <div className="space-y-3">
            <p className="text-xs text-text-3">{t('cierres.zoomHint')}</p>

            {mapFiltersOpen ? (
              <div className="flex flex-wrap gap-2 rounded-2xl border border-line bg-surface-2 p-3">
                <select
                  className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-xs text-text outline-none focus:border-violet-400"
                  value={mapFilters.propertyType ?? ''}
                  onChange={(e) => setMapFilters((f) => ({ ...f, propertyType: e.target.value || undefined }))}
                >
                  <option className="bg-bg" value="">{t('cierres.filtro.tipo')}</option>
                  {CLOSED_DEAL_PROPERTY_TYPES.map((v) => (
                    <option key={v} className="bg-bg" value={v}>{tProperty(v)}</option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-xs text-text outline-none focus:border-violet-400"
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

            <div className="flex gap-2 rounded-full border border-line bg-surface-2 p-1 lg:hidden">
              <button onClick={() => setMobilePanel('mapa')} className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${mobilePanel === 'mapa' ? 'gradient-btn text-grad-contrast' : 'text-text-2'}`}>
                {t('cierres.tabMapa')}
              </button>
              <button onClick={() => setMobilePanel('resumen')} className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${mobilePanel === 'resumen' ? 'gradient-btn text-grad-contrast' : 'text-text-2'}`}>
                {t('cierres.resumenPorZona')}
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr,300px]">
              <div className={mobilePanel === 'resumen' ? 'hidden lg:block' : ''}>
                <div className="relative">
                  <CierresMapa filters={mapFilters} focusZoneKey={focusZoneKey} lang={lang} tProperty={tProperty} onCountChange={setMapCount} />
                  <div className="pointer-events-none absolute right-3 top-3 space-y-1 rounded-xl border border-line bg-bg/90 p-2 text-[10px] text-text-2">
                    {Object.keys(PROPERTY_PIN_COLORS).map((pt) => (
                      <div key={pt} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: pinColorFor(pt) }} />
                        <span className="truncate">{tProperty(pt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <aside className={`space-y-2 ${mobilePanel === 'mapa' ? 'hidden lg:block' : ''}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('cierres.resumenPorZona')}</p>
                {zoneStats.map((zs) => {
                  const isExpanded = expandedZone === zs.zone.key;
                  const smallSample = zs.count < MIN_SAMPLE_SIZE;
                  return (
                    <div
                      key={zs.zone.key}
                      className={`rounded-2xl border p-3 transition-colors duration-200 ${focusZoneKey === zs.zone.key ? 'border-emerald-400/40' : 'border-line'}`}
                      style={{ backgroundColor: zoneColor(zs.avgPpm2, zs.count) }}
                    >
                      <button
                        className="flex w-full items-center justify-between gap-2 text-left"
                        onClick={() => {
                          setExpandedZone(isExpanded ? null : zs.zone.key);
                          setFocusZoneKey(zs.zone.key);
                        }}
                      >
                        <span>
                          <p className="text-sm font-bold text-text">{zoneLabel(zs.zone.key, lang)}</p>
                          <p className="text-xs text-text-2">{zs.count} {t('cierres.cierresRegistrados')}</p>
                        </span>
                        {!smallSample && zs.avgPpm2 ? (
                          <span className="shrink-0 text-right text-sm font-bold text-text">${Math.round(zs.avgPpm2).toLocaleString('en-US')}/m²</span>
                        ) : (
                          <span className="shrink-0 text-text-3">—</span>
                        )}
                      </button>

                      {smallSample ? (
                        <div className="mt-2">
                          <p className="text-xs text-text-2">{t('cierres.muestraChica')} ({zs.count}/{MIN_SAMPLE_SIZE})</p>
                        </div>
                      ) : isExpanded ? (
                        <div className="mt-3 space-y-2 border-t border-line pt-3 text-xs text-text-2">
                          {zs.minPpm2 && zs.maxPpm2 ? (
                            <p>{t('cierres.rango')}: ${Math.round(zs.minPpm2).toLocaleString('en-US')} - ${Math.round(zs.maxPpm2).toLocaleString('en-US')}/m²</p>
                          ) : null}
                          {zs.avgGapPct !== null ? (
                            <p>{t('cierres.brechaPromedio')}: {zs.avgGapPct > 0 ? '+' : ''}{zs.avgGapPct.toFixed(1)}%</p>
                          ) : null}
                          {zs.paymentCounts.length > 0 ? (
                            <div>
                              <p className="mb-1 font-semibold text-text-2">{t('cierres.formaPago.label')}</p>
                              {zs.paymentCounts.map(([method, count]) => (
                                <div key={method} className="flex items-center gap-2">
                                  <span className="w-20 shrink-0 truncate">{FORMA_PAGO_OPTIONS.find((o) => o.value === method)?.[lang === 'es' ? 'labelEs' : 'labelEn'] ?? method}</span>
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                                    <div className="h-full rounded-full bg-violet-400" style={{ width: `${(count / zs.count) * 100}%` }} />
                                  </div>
                                  <span className="w-4 shrink-0 text-right">{count}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {zs.sectorCounts.length > 0 ? (
                            <div>
                              <p className="mb-1 font-semibold text-text-2">{t('cierres.desglosePorSector')}</p>
                              {zs.sectorCounts.slice(0, 5).map(([sectorName, count]) => (
                                <div key={sectorName} className="flex items-center justify-between">
                                  <span className="truncate">{sectorName}</span>
                                  <span className="shrink-0 font-semibold text-violet-300">{count}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </aside>
            </div>
          </div>
        ) : (
          <div>
            {filtersOpen ? (
              <div className="mb-3 flex flex-wrap gap-2">
                <select className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-xs text-text outline-none focus:border-violet-400" value={filterPropertyType} onChange={(e) => setFilterPropertyType(e.target.value)}>
                  <option className="bg-bg" value="">{t('cierres.filtro.tipo')}</option>
                  {CLOSED_DEAL_PROPERTY_TYPES.map((v) => (
                    <option key={v} className="bg-bg" value={v}>{tProperty(v)}</option>
                  ))}
                </select>
                <select className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-xs text-text outline-none focus:border-violet-400" value={filterSector} onChange={(e) => setFilterSector(e.target.value)}>
                  <option className="bg-bg" value="">{t('cierres.filtro.sector')}</option>
                  {availableSectors.map((s) => (
                    <option key={s} className="bg-bg" value={s}>{s}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {tableRows.length === 0 ? (
              <EmptyMapState t={t} onRegister={openRegisterAccordion} />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[#f8fafc] p-3">
                <table className="hidden w-full min-w-[680px] text-left text-xs text-[#334155] sm:table">
                  <thead>
                    <tr className="border-b border-[rgba(15,23,42,0.08)] text-[#94a3b8]">
                      <th className="py-2 pr-3">{t('cierres.zonaQuito')}</th>
                      <th className="py-2 pr-3">{t('cierres.filtro.sector')}</th>
                      <th className="py-2 pr-3">{t('cierres.filtro.tipo')}</th>
                      <th className="cursor-pointer py-2 pr-3" onClick={() => toggleSort('price')}>{t('cierres.form.precio.placeholder')} {sortKey === 'price' ? (sortDesc ? '↓' : '↑') : ''}</th>
                      <th className="cursor-pointer py-2 pr-3" onClick={() => toggleSort('pricePerM2')}>$/m² {sortKey === 'pricePerM2' ? (sortDesc ? '↓' : '↑') : ''}</th>
                      <th className="cursor-pointer py-2 pr-3" onClick={() => toggleSort('closedAt')}>{t('cierres.cerrado')} {sortKey === 'closedAt' ? (sortDesc ? '↓' : '↑') : ''}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map(({ deal, ppm2 }) => (
                      <tr key={deal.id} className="border-b border-[rgba(15,23,42,0.05)]">
                        <td className="py-2 pr-3">{zoneLabel(deal.zone ?? '', lang)}</td>
                        <td className="py-2 pr-3">{deal.sector ?? '—'}</td>
                        <td className="py-2 pr-3">{tProperty(deal.propertyType)}</td>
                        <td className="py-2 pr-3 font-semibold text-[#0f172a]">${deal.price.toLocaleString('en-US')}</td>
                        <td className="py-2 pr-3">{ppm2 ? `$${Math.round(ppm2).toLocaleString('en-US')}` : '—'}</td>
                        <td className="py-2 pr-3">{new Date(deal.closedAt).toLocaleDateString(lang === 'es' ? 'es-EC' : 'en-US', { month: 'short', year: 'numeric' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="space-y-2 sm:hidden">
                  {tableRows.map(({ deal, ppm2 }) => (
                    <div key={deal.id} className="min-w-0 rounded-xl border border-[rgba(15,23,42,0.08)] bg-white p-3 text-xs text-[#334155]">
                      <p className="truncate font-semibold text-[#0f172a]">{tProperty(deal.propertyType)} · {zoneLabel(deal.zone ?? '', lang)}{deal.sector ? ` - ${deal.sector}` : ''}</p>
                      <p className="mt-1">${deal.price.toLocaleString('en-US')} {ppm2 ? `· $${Math.round(ppm2).toLocaleString('en-US')}/m²` : ''}</p>
                      <p className="mt-1 text-[#94a3b8]">{new Date(deal.closedAt).toLocaleDateString(lang === 'es' ? 'es-EC' : 'en-US', { month: 'short', year: 'numeric' })}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canCreate && deals.some((d) => d.canEdit) ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {deals.filter((d) => d.canEdit).map((deal) => (
                  <div key={deal.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-text-2">
                    <span className="min-w-0 truncate">{tProperty(deal.propertyType)} · {zoneLabel(deal.zone ?? '', lang)}</span>
                    <button
                      onClick={() => handleDelete(deal.id)}
                      disabled={deletingId === deal.id}
                      className="shrink-0 rounded-full border border-pink-400/30 bg-pink-500/10 px-2.5 py-1 font-semibold text-pink-300 transition-colors duration-200 hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === deal.id ? t('cierres.eliminando') : t('cierres.eliminar')}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyMapState({ t, onRegister }: { t: (k: string) => string; onRegister: () => void }) {
  return (
    <div
      className="relative min-h-[300px] overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.07)] bg-bg-alt bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:28px_28px]"
    >
      <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.35),transparent_70%)]" />
      <div className="pointer-events-none absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.35),transparent_70%)]" />
      <div className="relative flex min-h-[300px] flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.1)] px-3 py-1 text-xs font-semibold text-text-3">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
          0 {t('cierres.cierresRegistrados')}
        </span>
        <h3 className="text-[16.5px] font-bold text-text">{t('cierres.estadoVacio.titulo')}</h3>
        <p className="max-w-xs text-[13.5px] text-text-2">{t('cierres.estadoVacio.texto')}</p>
        <button
          onClick={onRegister}
          className="mt-1 rounded-[10px] bg-grad px-5 py-3 text-sm font-bold text-grad-contrast transition-[filter] duration-150 hover:brightness-[1.08]"
        >
          {t('cierres.registrarPrimero')}
        </button>
      </div>
    </div>
  );
}
