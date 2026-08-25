'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { Card, ModuleHeader } from '../CardKit';
import { IconTarget } from '../icons';
import { POINT_ACTIONS } from '@/lib/real-estate/points';
import { PriceInput } from '../PriceInput';
import {
  ANTIGUEDAD_OPTIONS,
  CLOSED_DEAL_PROPERTY_TYPES,
  ENTIDAD_FINANCIERA_OPTIONS,
  ESTADO_OPTIONS,
  FORMA_PAGO_OPTIONS,
  TIEMPO_MERCADO_OPTIONS,
  UBICACION_COMERCIAL_OPTIONS,
  USO_SUELO_OPTIONS,
  requiresAntiguedadYEstado,
  roundCoord,
  validateClosedDeal,
  type ClosedDealDetails,
} from '@/lib/real-estate/closed-deals-config';
import { QUITO_ZONES, sectorsForZone, zoneForCoordinates, zoneLabel } from '@/lib/real-estate/quito-zones';
import type { ClosedDealItem } from '../types';

const ClosedDealsMap = dynamic(() => import('../ClosedDealsMap'), { ssr: false, loading: () => <div className="h-64 w-full animate-pulse rounded-2xl bg-surface-2 sm:h-80" /> });

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

export default function RegistrarCierreTab({
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

  if (!canAccess) {
    return (
      <section className="glass-card rounded-[1.8rem] p-4 fade-up sm:p-6">
        <h2 className="text-xl font-bold text-text">{t('nav.registrocierre')}</h2>
        <p className="mt-2 text-sm text-text-2">{t('cierres.locked.detail')}</p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <ModuleHeader icon={<IconTarget className="h-[17px] w-[17px]" strokeWidth={1.8} />} title={t('nav.registrocierre')} subtitle={t('cierres.form.subtitle')} />

      <Card>
        <h3 className="text-[18px] font-bold tracking-[-0.01em] text-text">{t('cierres.introTitulo1')}</h3>
        <p className="mb-2 text-[15px] font-bold text-brand">{t('cierres.introTitulo2')}</p>
        <p className="mb-[13px] text-sm leading-[1.65] text-text-2">
          {t('cierres.intro.p1')}
          <span className="font-semibold text-text">{t('cierres.intro.bold')}</span>
          {t('cierres.intro.p2')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-[11px] py-[5px] text-[11.5px] font-semibold text-text-2">
            <Lock className="h-[11px] w-[11px] shrink-0 text-brand" strokeWidth={2.2} />
            {t('cierres.chip.anonimo')}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-[11px] py-[5px] text-[11.5px] font-semibold text-text-2">
            <Check className="h-[11px] w-[11px] shrink-0 text-brand" strokeWidth={2.2} />
            {t('cierres.chip.datosAgregados')}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-[11px] py-[5px] text-[11.5px] font-semibold text-text-2">
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

      {canCreate ? (
        <Card>
          <div className="mb-5 flex items-center justify-between gap-2">
            <div>
              <p className="text-[17px] font-bold text-text">{editingId ? t('cierres.editando') : t('cierres.form.title')}</p>
              <p className="mt-0.5 text-xs text-text-3">+{POINT_ACTIONS.CLOSING_REGISTERED.points} pts</p>
            </div>
            {editingId ? (
              <button onClick={cancelEdit} className="shrink-0 rounded-full border border-line-strong px-3 py-1.5 text-xs font-semibold text-text-2 transition-colors duration-200 hover:bg-surface-2">
                {t('cierres.cancelar')}
              </button>
            ) : null}
          </div>

          <div className="space-y-6">
            {/* Seccion A */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-brand">{t('cierres.seccionA')}</p>
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
                    className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none focus:border-brand"
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
                      className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand"
                      value={sectorOtro}
                      onChange={(e) => setSectorOtro(e.target.value)}
                      placeholder={t('cierres.otroSector.placeholder')}
                    />
                  ) : null}
                </div>
              ) : null}

              <input
                className="mt-3 w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand"
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
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-brand">{t('cierres.seccionB')}</p>

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
                      <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={terrenoM2} type="number" min={0} onChange={(e) => setTerrenoM2(e.target.value)} placeholder={t('cierres.terrenoM2.placeholder')} />
                    ) : null}
                    <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={areaM2} type="number" min={0} onChange={(e) => setAreaM2(e.target.value)} placeholder={esIndependiente ? t('cierres.construccionM2.placeholder') : t('cierres.metrajeHabitable.placeholder')} />
                    {esIndependiente === false ? (
                      <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={alicuotaMensual} type="number" min={0} onChange={(e) => setAlicuotaMensual(e.target.value)} placeholder={t('cierres.alicuota.placeholder')} />
                    ) : null}
                    <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={plantas} type="number" min={0} onChange={(e) => setPlantas(e.target.value)} placeholder={t('cierres.plantas.placeholder')} />
                    <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={bedrooms} type="number" min={0} onChange={(e) => setBedrooms(e.target.value)} placeholder={t('cierres.form.habitaciones.placeholder')} />
                    <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={bathrooms} type="number" min={0} onChange={(e) => setBathrooms(e.target.value)} placeholder={t('cierres.form.banos.placeholder')} />
                    <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={parkingSpaces} type="number" min={0} onChange={(e) => setParkingSpaces(e.target.value)} placeholder={t('cierres.form.parqueaderos.placeholder')} />
                  </div>
                </div>
              ) : null}

              {kind === 'DEPTO_SUITE' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={areaM2} type="number" min={0} onChange={(e) => setAreaM2(e.target.value)} placeholder={t('cierres.metrajeHabitable.placeholder')} />
                  <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={piso} type="number" min={0} onChange={(e) => setPiso(e.target.value)} placeholder={t('cierres.piso.placeholder')} />
                  <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={bedrooms} type="number" min={0} onChange={(e) => setBedrooms(e.target.value)} placeholder={t('cierres.form.habitaciones.placeholder')} />
                  <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={bathrooms} type="number" min={0} onChange={(e) => setBathrooms(e.target.value)} placeholder={t('cierres.form.banos.placeholder')} />
                  <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={parkingSpaces} type="number" min={0} onChange={(e) => setParkingSpaces(e.target.value)} placeholder={t('cierres.form.parqueaderos.placeholder')} />
                  <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={alicuotaMensual} type="number" min={0} onChange={(e) => setAlicuotaMensual(e.target.value)} placeholder={t('cierres.alicuota.placeholder')} />
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
                    <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={terrenoM2} type="number" min={0} onChange={(e) => setTerrenoM2(e.target.value)} placeholder={t('cierres.superficie.placeholder')} />
                    <input className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand" value={frenteM} type="number" min={0} onChange={(e) => setFrenteM(e.target.value)} placeholder={t('cierres.frente.placeholder')} />
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
                  <input className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-brand md:w-1/2" value={areaM2} type="number" min={0} onChange={(e) => setAreaM2(e.target.value)} placeholder={t('cierres.form.metraje.placeholder')} />
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
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-brand">{t('cierres.seccionC')}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <PriceInput value={publicationPrice} onChange={setPublicationPrice} placeholder={t('cierres.precioPublicacion.placeholder')} />
                <PriceInput value={price} onChange={setPrice} placeholder={t('cierres.form.precio.placeholder')} helperText={t('common.precioAyuda')} />
                <div>
                  <label className="mb-1 block text-[11px] text-text-3">{t('cierres.fechaCierre.label')}</label>
                  <input
                    type="month"
                    className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none focus:border-brand"
                    value={closedMonth}
                    max={new Date().toISOString().slice(0, 7)}
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

            {/* Seccion D */}
            <div className="border-t border-line pt-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-brand">{t('cierres.seccionD')}</p>
              <label className="flex items-start gap-2.5 text-sm text-text-2">
                <input type="checkbox" checked={declaredAccurate} onChange={(e) => setDeclaredAccurate(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded" />
                {t('cierres.declaracion')}
              </label>
            </div>

            {warning ? <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">⚠️ {warning}</p> : null}
            {formError ? <p className="rounded-xl border border-danger-dim border-danger px-3 py-2 text-xs text-danger">{formError}</p> : null}

            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={creating || !declaredAccurate}
                className="gradient-btn flex-1 rounded-full px-4 py-2.5 text-sm font-semibold text-grad-contrast transition-transform duration-200 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:flex-none"
              >
                {creating ? t('cierres.form.guardando') : editingId ? t('cierres.guardarCambios') : t('cierres.form.submit')}
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      {canCreate && deals.some((d) => d.canEdit) ? (
        <Card>
          <p className="mb-3 text-sm font-bold text-text">{t('cierres.misCierres')}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {deals.filter((d) => d.canEdit).map((deal) => (
              <div key={deal.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-text-2">
                <span className="min-w-0 truncate">{tProperty(deal.propertyType)} · {zoneLabel(deal.zone ?? '', lang)}</span>
                <button
                  onClick={() => handleDelete(deal.id)}
                  disabled={deletingId === deal.id}
                  className="shrink-0 rounded-full border border-danger bg-danger-dim px-2.5 py-1 font-semibold text-danger transition-colors duration-200 hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === deal.id ? t('cierres.eliminando') : t('cierres.eliminar')}
                </button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
