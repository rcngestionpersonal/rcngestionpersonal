'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { PriceInput } from '../PriceInput';
import {
  ANTIGUEDAD_OPTIONS,
  CLOSED_DEAL_PROPERTY_TYPES,
  ENTIDAD_FINANCIERA_OPTIONS,
  ESTADO_OPTIONS,
  FORMA_PAGO_OPTIONS,
  TIEMPO_MERCADO_OPTIONS,
  computeSectorInsight,
  metrajeFieldFor,
  metrajeLabelKeyFor,
  requiresAntiguedadYEstado,
  roundCoord,
  validateClosedDeal,
} from '@/lib/real-estate/closed-deals-config';
import { MIN_SAMPLE_SIZE, nearestZoneForCoordinates, zoneLabel } from '@/lib/real-estate/quito-zones';
import type { ClosedDealItem } from '../types';

const ClosedDealsMap = dynamic(() => import('../ClosedDealsMap'), { ssr: false, loading: () => <div className="h-56 w-full animate-pulse rounded-2xl bg-surface-2 sm:h-64" /> });

export type NewClosedDealInput = {
  operationType: 'SALE' | 'RENT' | 'BOTH';
  propertyType: string;
  zone: string;
  sector: string;
  antiguedad?: string;
  estadoInmueble?: string;
  latitude?: number;
  longitude?: number;
  price: number;
  publicationPrice?: number;
  areaM2?: number;
  landAreaM2?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  timeOnMarket?: string;
  paymentMethod?: string;
  financialEntity?: string;
  approvalDelayed?: boolean;
  closedAt: string;
  declaredAccurate: true;
};

export type SavedDealResult = {
  latitude: number;
  longitude: number;
  zoneKey: string;
  myPpm2: number;
  avgPpm2: number | null;
  diffPct: number | null;
};

function pillClasses(active: boolean): string {
  return active ? 'gradient-btn border-transparent text-grad-contrast' : 'border-line-strong text-text-2 hover:bg-surface-2';
}

function monthYearToIso(value: string): string {
  if (!value) return new Date().toISOString();
  return new Date(`${value}-01T12:00:00Z`).toISOString();
}

function monthOffset(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7);
}

export default function CierreFormPanel({
  deals,
  editingDeal,
  onCreateDeal,
  onUpdateDeal,
  creating,
  onSaved,
  onCancel,
}: {
  deals: ClosedDealItem[];
  editingDeal: ClosedDealItem | null;
  onCreateDeal: (input: NewClosedDealInput) => Promise<void>;
  onUpdateDeal: (id: string, input: NewClosedDealInput) => Promise<void>;
  creating: boolean;
  onSaved: (result: SavedDealResult) => void;
  onCancel: () => void;
}) {
  const { t, tProperty, tOperation, lang } = useLanguage();

  const [propertyType, setPropertyType] = useState('HOUSE');
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [metraje, setMetraje] = useState('');
  const [antiguedad, setAntiguedad] = useState('');
  const [price, setPrice] = useState('');
  const [closedMonth, setClosedMonth] = useState('');

  // Seccion opcional ("30 segundos mas")
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [operationType, setOperationType] = useState<'SALE' | 'RENT'>('SALE');
  const [publicationPrice, setPublicationPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [financialEntity, setFinancialEntity] = useState('');
  const [approvalDelayed, setApprovalDelayed] = useState(false);
  const [timeOnMarket, setTimeOnMarket] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [parkingSpaces, setParkingSpaces] = useState('');
  const [estadoInmueble, setEstadoInmueble] = useState('');

  const [declaredAccurate, setDeclaredAccurate] = useState(false);
  const [formError, setFormError] = useState('');
  const [warning, setWarning] = useState('');
  const [successInsight, setSuccessInsight] = useState<SavedDealResult | null>(null);

  const editing = Boolean(editingDeal);
  const needsAntiguedad = requiresAntiguedadYEstado(propertyType);
  const zoneKey = pickedLat !== null && pickedLng !== null ? nearestZoneForCoordinates(pickedLat, pickedLng) : null;

  useEffect(() => {
    if (!editingDeal) return;
    setPropertyType(editingDeal.propertyType);
    setPickedLat(editingDeal.latitude ?? null);
    setPickedLng(editingDeal.longitude ?? null);
    const field = metrajeFieldFor(editingDeal.propertyType);
    setMetraje(String((field === 'landAreaM2' ? editingDeal.landAreaM2 : editingDeal.areaM2) ?? ''));
    setAntiguedad(editingDeal.antiguedad ?? '');
    setPrice(String(editingDeal.price ?? ''));
    setClosedMonth(editingDeal.closedAt ? editingDeal.closedAt.slice(0, 7) : '');
    setOperationType(editingDeal.operationType === 'RENT' ? 'RENT' : 'SALE');
    setPublicationPrice(editingDeal.publicationPrice ? String(editingDeal.publicationPrice) : '');
    setPaymentMethod(editingDeal.paymentMethod ?? '');
    setFinancialEntity(editingDeal.financialEntity ?? '');
    setApprovalDelayed(Boolean(editingDeal.approvalDelayed));
    setTimeOnMarket(editingDeal.timeOnMarket ?? '');
    setBedrooms(editingDeal.bedrooms ? String(editingDeal.bedrooms) : '');
    setBathrooms(editingDeal.bathrooms ? String(editingDeal.bathrooms) : '');
    setParkingSpaces(editingDeal.parkingSpaces ? String(editingDeal.parkingSpaces) : '');
    setEstadoInmueble(editingDeal.estadoInmueble ?? '');
    setDeclaredAccurate(true);
    const hasEnrichment = Boolean(
      editingDeal.publicationPrice || editingDeal.paymentMethod || editingDeal.timeOnMarket || editingDeal.bedrooms || editingDeal.bathrooms || editingDeal.parkingSpaces || editingDeal.estadoInmueble,
    );
    setOptionalOpen(hasEnrichment);
  }, [editingDeal]);

  const metrajeLabel = t(metrajeLabelKeyFor(propertyType));

  async function submit() {
    setFormError('');
    setWarning('');

    if (!propertyType) {
      setFormError(t('cierres.form.errorCampos'));
      return;
    }
    if (pickedLat === null || pickedLng === null || !zoneKey) {
      setFormError(t('cierres.ubicacionObligatoria'));
      return;
    }
    const metrajeNum = Number(metraje || '0');
    if (!metraje.trim() || metrajeNum <= 0) {
      setFormError(t('cierres.form.errorCampos'));
      return;
    }
    if (needsAntiguedad && !antiguedad) {
      setFormError(t('cierres.form.errorCampos'));
      return;
    }
    if (!price.trim()) {
      setFormError(t('cierres.form.errorCampos'));
      return;
    }
    if (!closedMonth) {
      setFormError(t('cierres.form.errorCampos'));
      return;
    }
    if (!declaredAccurate) {
      setFormError(t('cierres.form.errorDeclaracion'));
      return;
    }

    const priceNum = Number(price);
    const publicationPriceNum = publicationPrice.trim() ? Number(publicationPrice) : undefined;
    const closedAtIso = monthYearToIso(closedMonth);
    const field = metrajeFieldFor(propertyType);
    const areaM2 = field === 'areaM2' ? metrajeNum : undefined;
    const landAreaM2 = field === 'landAreaM2' ? metrajeNum : undefined;

    const { errors, warnings } = validateClosedDeal({
      propertyType,
      price: priceNum,
      publicationPrice: publicationPriceNum,
      areaM2,
      landAreaM2,
      closedAt: closedAtIso,
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
      sector: zoneLabel(zoneKey, 'es'),
      antiguedad: needsAntiguedad ? antiguedad : undefined,
      estadoInmueble: estadoInmueble || undefined,
      latitude: roundCoord(pickedLat),
      longitude: roundCoord(pickedLng),
      price: priceNum,
      publicationPrice: publicationPriceNum,
      areaM2,
      landAreaM2,
      bedrooms: bedrooms.trim() ? Number(bedrooms) : undefined,
      bathrooms: bathrooms.trim() ? Number(bathrooms) : undefined,
      parkingSpaces: parkingSpaces.trim() ? Number(parkingSpaces) : undefined,
      timeOnMarket: timeOnMarket || undefined,
      paymentMethod: paymentMethod || undefined,
      financialEntity: paymentMethod === 'CREDITO' || paymentMethod === 'MIXTO' ? financialEntity || undefined : undefined,
      approvalDelayed: paymentMethod === 'CREDITO' ? approvalDelayed : undefined,
      closedAt: closedAtIso,
      declaredAccurate: true,
    };

    if (editingDeal) {
      await onUpdateDeal(editingDeal.id, input);
      onCancel();
      return;
    }

    const myPpm2 = priceNum / metrajeNum;
    const otherDeals = deals.filter((d) => d.zone === zoneKey && d.propertyType === propertyType);
    const insight = computeSectorInsight(myPpm2, otherDeals, MIN_SAMPLE_SIZE);
    await onCreateDeal(input);
    setSuccessInsight({ latitude: pickedLat, longitude: pickedLng, zoneKey, myPpm2, avgPpm2: insight.avgPpm2, diffPct: insight.diffPct });
  }

  const insightMessage = useMemo(() => {
    if (!successInsight) return '';
    const zoneName = zoneLabel(successInsight.zoneKey, lang);
    if (successInsight.avgPpm2 === null || successInsight.diffPct === null) {
      return t('cierres.insight.primero').replace('{zona}', zoneName);
    }
    const pct = Math.abs(Math.round(successInsight.diffPct));
    const key = successInsight.diffPct >= 0 ? 'cierres.insight.sobre' : 'cierres.insight.bajo';
    return t(key)
      .replace('{pct}', String(pct))
      .replace('{zona}', zoneName)
      .replace('{promedio}', `$${Math.round(successInsight.avgPpm2).toLocaleString('en-US')}`)
      .replace('{tuyo}', `$${Math.round(successInsight.myPpm2).toLocaleString('en-US')}`);
  }, [successInsight, lang, t]);

  if (successInsight) {
    return (
      <div className="space-y-5 fade-up">
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold leading-relaxed text-emerald-200">🏆 {insightMessage}</p>
        </div>
        <p className="text-sm font-bold text-accent">{t('cierres.chip.puntos')}</p>
        <button
          onClick={() => onSaved(successInsight)}
          className="gradient-btn w-full rounded-full px-4 py-3 text-sm font-semibold text-grad-contrast transition-transform duration-200 hover:scale-[1.01]"
        >
          {t('cierres.insight.verMapa')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* a. Tipo de inmueble */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('cierres.filtro.tipo')}</p>
        <div className="flex flex-wrap gap-2">
          {CLOSED_DEAL_PROPERTY_TYPES.filter((v) => v !== 'FARM').map((value) => (
            <button key={value} onClick={() => setPropertyType(value)} className={`rounded-full border px-3 py-2 text-xs font-semibold transition-all duration-200 ${pillClasses(propertyType === value)}`}>
              {tProperty(value)}
            </button>
          ))}
        </div>
      </div>

      {/* b. Ubicacion */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('cierres.ubicacionMapa.label')}</p>
        <ClosedDealsMap
          points={[]}
          pickable
          pickedPosition={pickedLat !== null && pickedLng !== null ? { lat: pickedLat, lng: pickedLng } : null}
          onPick={(lat, lng) => {
            setPickedLat(lat);
            setPickedLng(lng);
          }}
        />
        <p className="mt-1.5 text-[11px] text-text-3">{t('cierres.ubicacionMapa.privacidad')}</p>
        {zoneKey ? <p className="mt-1 text-[12px] font-semibold text-brand">{zoneLabel(zoneKey, lang)}</p> : null}
      </div>

      {/* c. Metraje */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{metrajeLabel}</label>
        <input
          className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand"
          value={metraje}
          type="number"
          min={0}
          onChange={(e) => setMetraje(e.target.value)}
          placeholder={metrajeLabel}
        />
      </div>

      {/* d. Antiguedad (oculta en Terreno) */}
      {needsAntiguedad ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('cierres.antiguedad.label')}</p>
          <div className="flex flex-wrap gap-2">
            {ANTIGUEDAD_OPTIONS.map((o) => (
              <button key={o.value} onClick={() => setAntiguedad(o.value)} className={`rounded-full border px-3 py-2 text-xs font-semibold transition-all duration-200 ${pillClasses(antiguedad === o.value)}`}>
                {lang === 'es' ? o.labelEs : o.labelEn}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* e. Precio de cierre */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('cierres.form.precio.placeholder')}</label>
        <PriceInput value={price} onChange={setPrice} placeholder={t('cierres.form.precio.placeholder')} helperText={t('common.precioAyuda')} />
      </div>

      {/* f. Mes/anio de cierre */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('cierres.fechaCierre.label')}</label>
        <p className="mb-1.5 text-[11px] text-text-3">{t('cierres.fechaCierre.ayuda')}</p>
        <input
          type="month"
          className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none focus:border-brand"
          value={closedMonth}
          max={monthOffset(0)}
          onChange={(e) => setClosedMonth(e.target.value)}
        />
        <div className="mt-2 flex gap-2">
          <button onClick={() => setClosedMonth(monthOffset(0))} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(closedMonth === monthOffset(0))}`}>
            {t('cierres.mesActual')}
          </button>
          <button onClick={() => setClosedMonth(monthOffset(-1))} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(closedMonth === monthOffset(-1))}`}>
            {t('cierres.mesPasado')}
          </button>
        </div>
      </div>

      {/* Seccion opcional */}
      <div className="rounded-2xl border border-line bg-surface-2/50">
        <button
          type="button"
          onClick={() => setOptionalOpen((v) => !v)}
          aria-expanded={optionalOpen}
          className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left text-sm font-semibold text-brand"
        >
          <span>{t('cierres.opcional.titulo')}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${optionalOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
        </button>
        {optionalOpen ? (
          <div className="space-y-4 border-t border-line px-4 pb-4 pt-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('cierres.tipoOperacion.label')}</p>
              <div className="flex flex-wrap gap-2">
                {(['SALE', 'RENT'] as const).map((value) => (
                  <button key={value} onClick={() => setOperationType(value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(operationType === value)}`}>
                    {tOperation(value)}
                  </button>
                ))}
              </div>
            </div>

            <PriceInput value={publicationPrice} onChange={setPublicationPrice} placeholder={t('cierres.precioPublicacion.placeholder')} />

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('cierres.formaPago.label')}</p>
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
                    className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none focus:border-brand"
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

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('cierres.tiempoMercado.label')}</p>
              <div className="flex flex-wrap gap-2">
                {TIEMPO_MERCADO_OPTIONS.map((o) => (
                  <button key={o.value} onClick={() => setTimeOnMarket(o.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(timeOnMarket === o.value)}`}>
                    {lang === 'es' ? o.labelEs : o.labelEn}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('cierres.estado.label')}</p>
              <div className="flex flex-wrap gap-2">
                {ESTADO_OPTIONS.map((o) => (
                  <button key={o.value} onClick={() => setEstadoInmueble(o.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(estadoInmueble === o.value)}`}>
                    {lang === 'es' ? o.labelEs : o.labelEn}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={bedrooms} type="number" min={0} onChange={(e) => setBedrooms(e.target.value)} placeholder={t('cierres.form.habitaciones.placeholder')} />
              <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={bathrooms} type="number" min={0} onChange={(e) => setBathrooms(e.target.value)} placeholder={t('cierres.form.banos.placeholder')} />
              <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={parkingSpaces} type="number" min={0} onChange={(e) => setParkingSpaces(e.target.value)} placeholder={t('cierres.form.parqueaderos.placeholder')} />
            </div>
          </div>
        ) : null}
      </div>

      <label className="flex items-start gap-2.5 text-sm text-text-2">
        <input type="checkbox" checked={declaredAccurate} onChange={(e) => setDeclaredAccurate(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded" />
        {t('cierres.declaracion')}
      </label>

      {warning ? <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">⚠️ {warning}</p> : null}
      {formError ? <p className="rounded-xl border border-danger-dim border-danger px-3 py-2 text-xs text-danger">{formError}</p> : null}

      <button
        onClick={submit}
        disabled={creating || !declaredAccurate}
        className="gradient-btn w-full rounded-full px-4 py-3 text-sm font-semibold text-grad-contrast transition-transform duration-200 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {creating ? t('cierres.form.guardando') : editing ? t('cierres.guardarCambios') : t('cierres.form.submit')}
      </button>
      {!editing ? <p className="text-center text-xs font-bold text-accent">{t('cierres.chip.puntos')}</p> : null}
    </div>
  );
}
