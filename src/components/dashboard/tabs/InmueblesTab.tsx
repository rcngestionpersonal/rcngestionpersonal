'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Building2, Download, Home, ImagesIcon, Lock, Pencil, Trash2, Upload, Warehouse } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { PointsBanner } from '../PointsWidgets';
import { PriceInput } from '../PriceInput';
import { Card, Chip, IconActionButton, MatchLink, ModuleHeader, RegisterAccordion, abbreviatedTitle, navigateWithFade, relativeLabel, zonaLine } from '../CardKit';
import FichaDownloadModal from '../FichaDownloadModal';
import ListingPhotoManager, { type GalleryItem } from '../ListingPhotoManager';
import PhotoLightbox from '../PhotoLightbox';
import type { AccesoInput } from '@/lib/real-estate/access';
import { FICHA_ICONS } from '@/lib/real-estate/ficha/icons';
import { fichaPrimaryRows } from '@/lib/real-estate/ficha/fields';
import { POINT_ACTIONS } from '@/lib/real-estate/points';
import { MAX_LISTING_PHOTOS } from '@/lib/real-estate/listing-photos-shared';
import { compressGalleryPhoto } from '@/lib/real-estate/image-compress';
import {
  AMOBLADO_OPTIONS,
  ANTIGUEDAD_OPTIONS,
  DISTRIBUCION_LOCAL_OPTIONS,
  ESQUINERO_MEDIANERO_OPTIONS,
  ESTADO_OCUPACION_OPTIONS,
  NIVEL_LOCAL_OPTIONS,
  SERVICIOS_OPTIONS,
  USO_SUELO_TERRENO_OPTIONS,
  hasAreaVerdeAmplia,
  isListingDetailIncomplete,
  listingFieldsFor,
  type OptionDef,
} from '@/lib/real-estate/listing-fields';
import type { AgentItem, ListingItem } from '../types';

const PROPERTY_VALUES = ['HOUSE', 'APARTMENT', 'SUITE', 'OFFICE', 'LAND', 'COMMERCIAL', 'WAREHOUSE', 'FARM', 'OTHER'];
const OPERATION_VALUES = ['SALE', 'RENT', 'BOTH'] as const;
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type NewListingInput = {
  title: string;
  operationType: 'SALE' | 'RENT' | 'BOTH';
  propertyType: string;
  city: string;
  zone?: string;
  price: number;
  areaM2?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  esIndependiente?: boolean;
  antiguedad?: string;
  amoblado?: string;
  alicuotaMensual?: number;
  piso?: number;
  tieneAscensor?: boolean;
  areasComunales?: boolean;
  esquineroOMedianero?: string;
  usoSueloTerreno?: string;
  pisosPermitidos?: number;
  serviciosBasicos?: string;
  frenteM?: number;
  nivelLocal?: string;
  distribucionLocal?: string;
  estadoOcupacion?: string;
  canonMensualActual?: number;
  alturaLibreM?: number;
  accesoCamion?: boolean;
  terrenoTotalM2?: number;
  areaLibrePropiaM2?: number;
  terrenoLibreExclusivoM2?: number;
  espaciosAdicionales?: number;
  mediosBanos?: number;
  balconOTerraza?: boolean;
  ownerName?: string;
  ownerPhone?: string;
  commissionSharePercent: number;
  managingAgentId?: string;
};

// Tap targets de al menos 44px en movil (seccion 5.3) para los chips/toggles
// nuevos de esta fase - los pills preexistentes (operacion/tipo) no se tocan.
function chipPillClasses(active: boolean): string {
  return `min-h-[44px] rounded-full border px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 ${
    active ? 'gradient-btn border-transparent text-grad-contrast' : 'border-line-strong text-text-2 hover:bg-surface-2'
  }`;
}

const detailInputClass =
  'w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400';
const detailLabelClass = 'mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2';

function FieldLabel({ children, help }: { children: string; help?: string }) {
  return (
    <div className="mb-1">
      <label className={detailLabelClass}>{children}</label>
      {help ? <p className="text-[11px] text-text-3">{help}</p> : null}
    </div>
  );
}

function ChipSelect({ label, value, onChange, options, lang }: { label: string; value: string; onChange: (v: string) => void; options: OptionDef[]; lang: 'es' | 'en' }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.value} type="button" onClick={() => onChange(value === o.value ? '' : o.value)} className={chipPillClasses(value === o.value)}>
            {lang === 'es' ? o.labelEs : o.labelEn}
          </button>
        ))}
      </div>
    </div>
  );
}

function BoolToggle({
  label,
  value,
  onChange,
  trueLabel,
  falseLabel,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
  trueLabel: string;
  falseLabel: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange(value === true ? undefined : true)} className={chipPillClasses(value === true)}>
          {trueLabel}
        </button>
        <button type="button" onClick={() => onChange(value === false ? undefined : false)} className={chipPillClasses(value === false)}>
          {falseLabel}
        </button>
      </div>
    </div>
  );
}

function TerrenoAreaRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const checked = value !== '';
  return (
    <label className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked ? '0' : '')}
        className="h-5 w-5 shrink-0 accent-violet-500"
      />
      <span className="flex-1 text-sm text-text">{label}</span>
      {checked ? (
        <input
          type="number"
          min={0}
          inputMode="decimal"
          className="w-24 shrink-0 rounded-lg border border-line-strong bg-input-bg px-2 py-1.5 text-sm text-text outline-none focus:border-violet-400"
          value={value === '0' ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="m²"
          autoFocus
        />
      ) : null}
    </label>
  );
}

function agentName(agentId: string | undefined, agents: AgentItem[]): string | undefined {
  if (!agentId) return undefined;
  return agents.find((a) => a.id === agentId)?.fullName;
}

function pillClasses(active: boolean): string {
  return active
    ? 'gradient-btn border-transparent text-grad-contrast'
    : 'border-line-strong text-text-2 hover:bg-surface-2';
}

function PlaceholderIcon({ propertyType }: { propertyType: string }) {
  const cls = 'h-5 w-5';
  if (propertyType === 'HOUSE' || propertyType === 'FARM') return <Home className={cls} strokeWidth={1.8} />;
  if (propertyType === 'LAND') return <MapPinFallback />;
  if (propertyType === 'COMMERCIAL' || propertyType === 'WAREHOUSE') return <Warehouse className={cls} strokeWidth={1.8} />;
  return <Building2 className={cls} strokeWidth={1.8} />;
}

function MapPinFallback() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 21s-6.5-5.4-9-9.8C1.2 7.6 3.4 3.8 7.2 3.4c2-.2 3.9.9 4.8 2.6.9-1.7 2.8-2.8 4.8-2.6 3.8.4 6 4.2 4.2 7.8-2.5 4.4-9 9.8-9 9.8Z" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  );
}

export default function InmueblesTab({
  isAdmin,
  canCreate,
  listings,
  agents,
  myAgentId,
  myAgent,
  onCreateListing,
  creating,
  onUpdateListing,
  onDeleteListing,
  onUploadPhoto,
  onUploadPhotos,
  onDeletePhoto,
  onSetCoverPhoto,
  onReorderPhotos,
  onGoToMatches,
}: {
  isAdmin: boolean;
  canCreate: boolean;
  listings: ListingItem[];
  agents: AgentItem[];
  myAgentId?: string;
  myAgent?: AgentItem;
  onCreateListing: (input: NewListingInput) => Promise<string | undefined | void>;
  creating: boolean;
  onUpdateListing: (id: string, input: NewListingInput) => Promise<void>;
  onDeleteListing: (id: string) => Promise<void>;
  onUploadPhoto?: (listingId: string, photo: Blob) => Promise<void>;
  onUploadPhotos?: (listingId: string, photos: Blob[]) => Promise<void>;
  onDeletePhoto?: (listingId: string, photoId: string) => Promise<void>;
  onSetCoverPhoto?: (listingId: string, photoId: string) => Promise<void>;
  onReorderPhotos?: (listingId: string, order: string[]) => Promise<void>;
  onGoToMatches?: () => void;
}) {
  const { t, tProperty, tOperation, tListingStatus, lang } = useLanguage();
  const [fichaListingId, setFichaListingId] = useState<string | null>(null);
  const accesoInput: AccesoInput | null = myAgent
    ? {
        subscriptionStatus: myAgent.subscriptionStatus,
        trialEndsAt: myAgent.trialEndsAt,
        subscriptionPaidUntil: myAgent.subscriptionPaidUntil,
        plan: myAgent.plan ?? 'BASICO',
      }
    : null;

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [operationType, setOperationType] = useState<'SALE' | 'RENT' | 'BOTH'>('SALE');
  const [propertyType, setPropertyType] = useState('HOUSE');
  const [city, setCity] = useState('');
  const [zone, setZone] = useState('');
  const [price, setPrice] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [commissionSharePercent, setCommissionSharePercent] = useState('50');
  const [managingAgentId, setManagingAgentId] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Campos condicionales por tipo (Fase 8, Bloque A) - todos opcionales, solo
  // se leen/envian los que aplican al tipo elegido (ver listingFieldsFor).
  const [areaM2, setAreaM2] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [parkingSpaces, setParkingSpaces] = useState('');
  const [esIndependiente, setEsIndependiente] = useState<boolean | undefined>(undefined);
  const [antiguedad, setAntiguedad] = useState('');
  const [amoblado, setAmoblado] = useState('');
  const [alicuotaMensual, setAlicuotaMensual] = useState('');
  const [piso, setPiso] = useState('');
  const [tieneAscensor, setTieneAscensor] = useState<boolean | undefined>(undefined);
  const [areasComunales, setAreasComunales] = useState<boolean | undefined>(undefined);
  const [esquineroOMedianero, setEsquineroOMedianero] = useState('');
  const [usoSueloTerreno, setUsoSueloTerreno] = useState('');
  const [pisosPermitidos, setPisosPermitidos] = useState('');
  const [serviciosBasicos, setServiciosBasicos] = useState('');
  const [frenteM, setFrenteM] = useState('');
  const [nivelLocal, setNivelLocal] = useState('');
  const [distribucionLocal, setDistribucionLocal] = useState('');
  const [estadoOcupacion, setEstadoOcupacion] = useState('');
  const [canonMensualActual, setCanonMensualActual] = useState('');
  const [alturaLibreM, setAlturaLibreM] = useState('');
  const [accesoCamion, setAccesoCamion] = useState<boolean | undefined>(undefined);
  const [terrenoTotalM2, setTerrenoTotalM2] = useState('');
  const [areaLibrePropiaM2, setAreaLibrePropiaM2] = useState('');
  const [terrenoLibreExclusivoM2, setTerrenoLibreExclusivoM2] = useState('');
  // Fase 8, Bloque B, seccion 1.2 - espacios que antes no existian como dato.
  const [espaciosAdicionales, setEspaciosAdicionales] = useState('');
  const [mediosBanos, setMediosBanos] = useState('');
  const [balconOTerraza, setBalconOTerraza] = useState<boolean | undefined>(undefined);

  const fieldFlags = listingFieldsFor(propertyType, operationType);
  const areaVerdeAmpliaPreview = hasAreaVerdeAmplia({
    terrenoTotalM2: terrenoTotalM2 ? Number(terrenoTotalM2) : null,
    areaLibrePropiaM2: areaLibrePropiaM2 ? Number(areaLibrePropiaM2) : null,
    terrenoLibreExclusivoM2: terrenoLibreExclusivoM2 ? Number(terrenoLibreExclusivoM2) : null,
  });

  function resetDetailFields() {
    setAreaM2('');
    setBedrooms('');
    setBathrooms('');
    setParkingSpaces('');
    setEsIndependiente(undefined);
    setAntiguedad('');
    setAmoblado('');
    setAlicuotaMensual('');
    setPiso('');
    setTieneAscensor(undefined);
    setAreasComunales(undefined);
    setEsquineroOMedianero('');
    setUsoSueloTerreno('');
    setPisosPermitidos('');
    setServiciosBasicos('');
    setFrenteM('');
    setNivelLocal('');
    setDistribucionLocal('');
    setEstadoOcupacion('');
    setCanonMensualActual('');
    setAlturaLibreM('');
    setAccesoCamion(undefined);
    setTerrenoTotalM2('');
    setAreaLibrePropiaM2('');
    setTerrenoLibreExclusivoM2('');
    setEspaciosAdicionales('');
    setMediosBanos('');
    setBalconOTerraza(undefined);
  }

  // Galeria de fotos (Fase 4): para un inmueble ya existente cada foto se sube
  // de inmediato; para uno nuevo se guardan en memoria (con su preview local)
  // hasta que la creacion devuelva el id, y ahi se suben en el orden elegido.
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [pendingPhotoPreviews, setPendingPhotoPreviews] = useState<string[]>([]);
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [lightboxListingId, setLightboxListingId] = useState<string | null>(null);
  const cardFileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const visibleListings = isAdmin ? listings : listings.filter((l) => l.managingAgentId === myAgentId || l.referredByAgentId === myAgentId);

  function resetForm() {
    setTitle('');
    setCity('');
    setZone('');
    setPrice('');
    setOwnerName('');
    setOwnerPhone('');
    setCommissionSharePercent('50');
    setManagingAgentId('');
    setEditingId(null);
    setPendingPhotos([]);
    setPendingPhotoPreviews([]);
    setPhotoError('');
    resetDetailFields();
  }

  function startEdit(listing: ListingItem) {
    setEditingId(listing.id);
    setTitle(listing.title);
    setOperationType(listing.operationType);
    setPropertyType(listing.propertyType);
    setCity(listing.city);
    setZone(listing.zone ?? '');
    setPrice(String(listing.price));
    setOwnerName(listing.ownerName ?? '');
    setOwnerPhone(listing.ownerPhone ?? '');
    setCommissionSharePercent(String(listing.commissionSharePercent ?? 50));
    setManagingAgentId(listing.managingAgentId);
    setPendingPhotos([]);
    setPendingPhotoPreviews([]);
    setAreaM2(listing.areaM2 != null ? String(listing.areaM2) : '');
    setBedrooms(listing.bedrooms != null ? String(listing.bedrooms) : '');
    setBathrooms(listing.bathrooms != null ? String(listing.bathrooms) : '');
    setParkingSpaces(listing.parkingSpaces != null ? String(listing.parkingSpaces) : '');
    setEsIndependiente(listing.esIndependiente ?? undefined);
    setAntiguedad(listing.antiguedad ?? '');
    setAmoblado(listing.amoblado ?? '');
    setAlicuotaMensual(listing.alicuotaMensual != null ? String(listing.alicuotaMensual) : '');
    setPiso(listing.piso != null ? String(listing.piso) : '');
    setTieneAscensor(listing.tieneAscensor ?? undefined);
    setAreasComunales(listing.areasComunales ?? undefined);
    setEsquineroOMedianero(listing.esquineroOMedianero ?? '');
    setUsoSueloTerreno(listing.usoSueloTerreno ?? '');
    setPisosPermitidos(listing.pisosPermitidos != null ? String(listing.pisosPermitidos) : '');
    setServiciosBasicos(listing.serviciosBasicos ?? '');
    setFrenteM(listing.frenteM != null ? String(listing.frenteM) : '');
    setNivelLocal(listing.nivelLocal ?? '');
    setDistribucionLocal(listing.distribucionLocal ?? '');
    setEstadoOcupacion(listing.estadoOcupacion ?? '');
    setCanonMensualActual(listing.canonMensualActual != null ? String(listing.canonMensualActual) : '');
    setAlturaLibreM(listing.alturaLibreM != null ? String(listing.alturaLibreM) : '');
    setAccesoCamion(listing.accesoCamion ?? undefined);
    setTerrenoTotalM2(listing.terrenoTotalM2 != null ? String(listing.terrenoTotalM2) : '');
    setAreaLibrePropiaM2(listing.areaLibrePropiaM2 != null ? String(listing.areaLibrePropiaM2) : '');
    setTerrenoLibreExclusivoM2(listing.terrenoLibreExclusivoM2 != null ? String(listing.terrenoLibreExclusivoM2) : '');
    setEspaciosAdicionales(listing.espaciosAdicionales != null ? String(listing.espaciosAdicionales) : '');
    setMediosBanos(listing.mediosBanos != null ? String(listing.mediosBanos) : '');
    setBalconOTerraza(listing.balconOTerraza ?? undefined);
    setFormOpen(true);
  }

  function cancelEdit() {
    resetForm();
    setFormOpen(false);
  }

  // Galeria del formulario (Fase 4): agregar N fotos de una - a un inmueble
  // ya existente se suben de inmediato (secuencial, un solo refresh al
  // final); a uno nuevo se guardan en memoria con su preview hasta que la
  // creacion devuelva el id. Respeta el maximo de 8 sumando lo que ya haya.
  async function handleAddPhotoFiles(fileList: FileList) {
    setPhotoError('');
    const existingCount = editingId ? (listings.find((l) => l.id === editingId)?.photos?.length ?? 0) : 0;
    const room = MAX_LISTING_PHOTOS - existingCount - pendingPhotos.length;
    const files = Array.from(fileList).slice(0, Math.max(room, 0));
    if (files.length < fileList.length) setPhotoError(t('inmuebles.fotos.errorMaximo'));
    if (files.length === 0) return;

    try {
      const compressed = await Promise.all(files.map((f) => compressGalleryPhoto(f)));
      if (editingId) {
        setUploadingPhotoFor(editingId);
        await onUploadPhotos?.(editingId, compressed);
        setUploadingPhotoFor(null);
      } else {
        setPendingPhotos((prev) => [...prev, ...files]);
        setPendingPhotoPreviews((prev) => [...prev, ...compressed.map((b) => URL.createObjectURL(b))]);
      }
    } catch {
      setPhotoError(t('inmuebles.fotos.errorSubir'));
      setUploadingPhotoFor(null);
    }
  }

  function handlePendingPhotoDelete(index: number) {
    setPendingPhotos((prev) => prev.filter((_, i) => i !== index));
    setPendingPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function handlePendingPhotoReorder(order: number[]) {
    setPendingPhotos((prev) => order.map((i) => prev[i]));
    setPendingPhotoPreviews((prev) => order.map((i) => prev[i]));
  }

  async function handleCardPhotoSelected(file: File, listingId: string) {
    setPhotoError('');
    try {
      const compressed = await compressGalleryPhoto(file);
      setUploadingPhotoFor(listingId);
      await onUploadPhoto?.(listingId, compressed);
    } catch {
      setPhotoError(t('inmuebles.fotoPortada.error'));
    } finally {
      setUploadingPhotoFor(null);
    }
  }

  async function submit() {
    if (!title.trim() || !city.trim() || !price.trim()) return;
    const num = (v: string) => (v.trim() ? Number(v) : undefined);
    const input: NewListingInput = {
      title: title.trim(),
      operationType,
      propertyType,
      city: city.trim(),
      zone: zone.trim() || undefined,
      price: Number(price),
      areaM2: num(areaM2),
      bedrooms: fieldFlags.showDormitorios ? num(bedrooms) : undefined,
      bathrooms: fieldFlags.showBanos ? num(bathrooms) : undefined,
      parkingSpaces: fieldFlags.showParqueos ? num(parkingSpaces) : undefined,
      esIndependiente: fieldFlags.showEsIndependienteCasa || fieldFlags.showEsIndependienteLocal ? esIndependiente : undefined,
      antiguedad: fieldFlags.showAntiguedad ? antiguedad || undefined : undefined,
      amoblado: fieldFlags.showAmoblado ? amoblado || undefined : undefined,
      alicuotaMensual: fieldFlags.showAlicuota ? num(alicuotaMensual) : undefined,
      piso: fieldFlags.showPiso ? num(piso) : undefined,
      tieneAscensor: fieldFlags.showAscensor ? tieneAscensor : undefined,
      areasComunales: fieldFlags.showAreasComunales ? areasComunales : undefined,
      esquineroOMedianero: fieldFlags.showEsquineroMedianero ? esquineroOMedianero || undefined : undefined,
      usoSueloTerreno: fieldFlags.showUsoSueloTerreno ? usoSueloTerreno || undefined : undefined,
      pisosPermitidos: fieldFlags.showPisosPermitidos ? num(pisosPermitidos) : undefined,
      serviciosBasicos: fieldFlags.showServiciosBasicos ? serviciosBasicos || undefined : undefined,
      frenteM: fieldFlags.showFrenteM ? num(frenteM) : undefined,
      nivelLocal: fieldFlags.showNivelLocal ? nivelLocal || undefined : undefined,
      distribucionLocal: fieldFlags.showDistribucionLocal ? distribucionLocal || undefined : undefined,
      estadoOcupacion: fieldFlags.showEstadoOcupacion ? estadoOcupacion || undefined : undefined,
      canonMensualActual: fieldFlags.showEstadoOcupacion && estadoOcupacion === 'ARRENDADO' ? num(canonMensualActual) : undefined,
      alturaLibreM: fieldFlags.showAlturaLibreM ? num(alturaLibreM) : undefined,
      accesoCamion: fieldFlags.showAccesoCamion ? accesoCamion : undefined,
      terrenoTotalM2: fieldFlags.showTerrenoCasa ? num(terrenoTotalM2) : undefined,
      areaLibrePropiaM2: fieldFlags.showTerrenoCasa ? num(areaLibrePropiaM2) : undefined,
      terrenoLibreExclusivoM2: fieldFlags.showTerrenoCasa ? num(terrenoLibreExclusivoM2) : undefined,
      espaciosAdicionales: fieldFlags.showEspaciosYMediosBanos ? num(espaciosAdicionales) : undefined,
      mediosBanos: fieldFlags.showEspaciosYMediosBanos ? num(mediosBanos) : undefined,
      balconOTerraza: fieldFlags.showEspaciosYMediosBanos ? balconOTerraza : undefined,
      ownerName: ownerName.trim() || undefined,
      ownerPhone: ownerPhone.trim() || undefined,
      commissionSharePercent: Number(commissionSharePercent) || 0,
      managingAgentId: isAdmin ? managingAgentId || undefined : undefined,
    };
    if (editingId) {
      await onUpdateListing(editingId, input);
    } else {
      const newId = await onCreateListing(input);
      if (newId && pendingPhotos.length > 0) {
        const compressed = await Promise.all(pendingPhotos.map((f) => compressGalleryPhoto(f)));
        await onUploadPhotos?.(newId, compressed);
      }
    }
    resetForm();
    setFormOpen(false);
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t('inmuebles.eliminarConfirm'))) return;
    setDeletingId(id);
    try {
      await onDeleteListing(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <ModuleHeader icon={<Home className="h-[17px] w-[17px]" strokeWidth={2} />} title={isAdmin ? t('inmuebles.list.title.admin') : t('inmuebles.list.title.agent')} subtitle={t('inmuebles.moduleSubtitle')} />

      {!isAdmin ? <PointsBanner variant="inmuebles" t={t} /> : null}

      {canCreate ? (
        <RegisterAccordion
          title={editingId ? t('inmuebles.editando') : t('inmuebles.form.title')}
          points={POINT_ACTIONS.LISTING_CREATED.points}
          subtitle={t('inmuebles.form.subtitle')}
          open={formOpen}
          onToggle={() => (formOpen ? cancelEdit() : setFormOpen(true))}
        >
            <div>
              <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.12em] text-text-3">{t('inmuebles.form.seccionUbicacion')}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('inmuebles.form.titulo.placeholder')}
                />
                <PriceInput value={price} onChange={setPrice} placeholder={t('inmuebles.form.precio.placeholder')} helperText={t('common.precioAyuda')} />
                <input
                  className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t('inmuebles.form.ciudad.placeholder')}
                />
                <input
                  className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  placeholder={t('inmuebles.form.zona.placeholder')}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {OPERATION_VALUES.map((value) => (
                  <button
                    key={value}
                    onClick={() => setOperationType(value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(operationType === value)}`}
                  >
                    {tOperation(value)}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {PROPERTY_VALUES.map((value) => (
                  <button
                    key={value}
                    onClick={() => setPropertyType(value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${pillClasses(propertyType === value)}`}
                  >
                    {tProperty(value)}
                  </button>
                ))}
              </div>

              {/* Detalles del inmueble (seccion 2/5.1) - ponderantes: solo se
                  muestran los campos que aplican al tipo elegido. */}
              <div className="mt-5">
                <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.12em] text-text-3">{t('inmuebles.form.seccionDetalles')}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <FieldLabel>{lang === 'es' ? fieldFlags.areaM2Label.es : fieldFlags.areaM2Label.en}</FieldLabel>
                    <input type="number" min={0} inputMode="decimal" className={detailInputClass} value={areaM2} onChange={(e) => setAreaM2(e.target.value)} placeholder="m²" />
                  </div>
                  {fieldFlags.showDormitorios ? (
                    <div>
                      <FieldLabel>{t('inmuebles.form.dormitorios')}</FieldLabel>
                      <input type="number" min={0} inputMode="numeric" className={detailInputClass} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
                    </div>
                  ) : null}
                  {fieldFlags.showEspaciosYMediosBanos ? (
                    <div>
                      <FieldLabel help={t('inmuebles.form.espaciosAdicionalesAyuda')}>{t('inmuebles.form.espaciosAdicionales')}</FieldLabel>
                      <input type="number" min={0} inputMode="numeric" className={detailInputClass} value={espaciosAdicionales} onChange={(e) => setEspaciosAdicionales(e.target.value)} placeholder="0" />
                    </div>
                  ) : null}
                  {fieldFlags.showBanos ? (
                    <div>
                      <FieldLabel>{t('inmuebles.form.banos')}</FieldLabel>
                      <input type="number" min={0} inputMode="numeric" className={detailInputClass} value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
                    </div>
                  ) : null}
                  {fieldFlags.showEspaciosYMediosBanos ? (
                    <div>
                      <FieldLabel>{t('inmuebles.form.mediosBanos')}</FieldLabel>
                      <input type="number" min={0} inputMode="numeric" className={detailInputClass} value={mediosBanos} onChange={(e) => setMediosBanos(e.target.value)} placeholder="0" />
                    </div>
                  ) : null}
                  {fieldFlags.showParqueos ? (
                    <div>
                      <FieldLabel>{t('inmuebles.form.parqueos')}</FieldLabel>
                      <input type="number" min={0} inputMode="numeric" className={detailInputClass} value={parkingSpaces} onChange={(e) => setParkingSpaces(e.target.value)} />
                    </div>
                  ) : null}
                  {fieldFlags.showPiso ? (
                    <div>
                      <FieldLabel>{t('inmuebles.form.piso')}</FieldLabel>
                      <input type="number" min={0} inputMode="numeric" className={detailInputClass} value={piso} onChange={(e) => setPiso(e.target.value)} />
                    </div>
                  ) : null}
                  {fieldFlags.showAlicuota ? (
                    <div>
                      <FieldLabel help={t('inmuebles.form.alicuotaAyuda')}>{t('inmuebles.form.alicuota')}</FieldLabel>
                      <input type="number" min={0} inputMode="decimal" className={detailInputClass} value={alicuotaMensual} onChange={(e) => setAlicuotaMensual(e.target.value)} placeholder="$" />
                    </div>
                  ) : null}
                  {fieldFlags.showFrenteM ? (
                    <div>
                      <FieldLabel help={t('common.opcional')}>{t('inmuebles.form.frente')}</FieldLabel>
                      <input type="number" min={0} inputMode="decimal" className={detailInputClass} value={frenteM} onChange={(e) => setFrenteM(e.target.value)} placeholder="m" />
                    </div>
                  ) : null}
                  {fieldFlags.showEstadoOcupacion && estadoOcupacion === 'ARRENDADO' ? (
                    <div>
                      <FieldLabel>{t('inmuebles.form.canonMensual')}</FieldLabel>
                      <input type="number" min={0} inputMode="decimal" className={detailInputClass} value={canonMensualActual} onChange={(e) => setCanonMensualActual(e.target.value)} placeholder="$" />
                    </div>
                  ) : null}
                  {fieldFlags.showAlturaLibreM ? (
                    <div>
                      <FieldLabel>{t('inmuebles.form.alturaLibre')}</FieldLabel>
                      <input type="number" min={0} inputMode="decimal" className={detailInputClass} value={alturaLibreM} onChange={(e) => setAlturaLibreM(e.target.value)} placeholder="m" />
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {fieldFlags.showAntiguedad ? (
                    <ChipSelect label={t('inmuebles.form.antiguedad')} value={antiguedad} onChange={setAntiguedad} options={[...ANTIGUEDAD_OPTIONS]} lang={lang} />
                  ) : null}
                  {fieldFlags.showEsIndependienteCasa ? (
                    <BoolToggle
                      label={t('inmuebles.form.independiente')}
                      value={esIndependiente}
                      onChange={setEsIndependiente}
                      trueLabel={t('inmuebles.form.casaIndependiente')}
                      falseLabel={t('inmuebles.form.casaConjunto')}
                    />
                  ) : null}
                  {fieldFlags.showEsIndependienteLocal ? (
                    <BoolToggle
                      label={t('inmuebles.form.independienteLocal')}
                      value={esIndependiente}
                      onChange={setEsIndependiente}
                      trueLabel={t('inmuebles.form.localIndependiente')}
                      falseLabel={t('inmuebles.form.localCentroComercial')}
                    />
                  ) : null}
                  {fieldFlags.showEsquineroMedianero ? (
                    <ChipSelect label={t('inmuebles.form.esquineroMedianero')} value={esquineroOMedianero} onChange={setEsquineroOMedianero} options={[...ESQUINERO_MEDIANERO_OPTIONS]} lang={lang} />
                  ) : null}
                  {fieldFlags.showUsoSueloTerreno ? (
                    <ChipSelect label={t('inmuebles.form.usoSuelo')} value={usoSueloTerreno} onChange={setUsoSueloTerreno} options={[...USO_SUELO_TERRENO_OPTIONS]} lang={lang} />
                  ) : null}
                  {fieldFlags.showNivelLocal ? (
                    <ChipSelect label={t('inmuebles.form.nivel')} value={nivelLocal} onChange={setNivelLocal} options={[...NIVEL_LOCAL_OPTIONS]} lang={lang} />
                  ) : null}
                  {fieldFlags.showDistribucionLocal ? (
                    <ChipSelect label={t('inmuebles.form.distribucion')} value={distribucionLocal} onChange={setDistribucionLocal} options={[...DISTRIBUCION_LOCAL_OPTIONS]} lang={lang} />
                  ) : null}
                  {fieldFlags.showEstadoOcupacion ? (
                    <ChipSelect label={t('inmuebles.form.estadoOcupacion')} value={estadoOcupacion} onChange={setEstadoOcupacion} options={[...ESTADO_OCUPACION_OPTIONS]} lang={lang} />
                  ) : null}
                </div>

                {fieldFlags.showTerrenoCasa ? (
                  <div className="mt-3 rounded-2xl border border-line-strong bg-surface-2/60 p-3">
                    <p className="text-sm font-semibold text-text">{t('inmuebles.form.terrenoTitulo')}</p>
                    <p className="mt-0.5 text-xs text-text-3">{t('inmuebles.form.terrenoAyuda')}</p>
                    <div className="mt-2.5 space-y-2">
                      <TerrenoAreaRow label={t('inmuebles.form.terrenoTotal')} value={terrenoTotalM2} onChange={setTerrenoTotalM2} />
                      <TerrenoAreaRow label={t('inmuebles.form.areaLibrePropia')} value={areaLibrePropiaM2} onChange={setAreaLibrePropiaM2} />
                      <TerrenoAreaRow label={t('inmuebles.form.terrenoLibreExclusivo')} value={terrenoLibreExclusivoM2} onChange={setTerrenoLibreExclusivoM2} />
                    </div>
                    {areaVerdeAmpliaPreview ? (
                      <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                        ✓ {t('inmuebles.form.areaVerdeAmplia')}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Extras (informativos - solo se muestran en la ficha, nunca ponderan) */}
              {fieldFlags.showAmoblado || fieldFlags.showAscensor || fieldFlags.showAreasComunales || fieldFlags.showServiciosBasicos || fieldFlags.showPisosPermitidos || fieldFlags.showAccesoCamion || fieldFlags.showEspaciosYMediosBanos ? (
                <div className="mt-5">
                  <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.12em] text-text-3">{t('inmuebles.form.seccionExtras')}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {fieldFlags.showAmoblado ? (
                      <ChipSelect label={t('inmuebles.form.amoblado')} value={amoblado} onChange={setAmoblado} options={[...AMOBLADO_OPTIONS]} lang={lang} />
                    ) : null}
                    {fieldFlags.showAscensor ? (
                      <BoolToggle label={t('inmuebles.form.ascensor')} value={tieneAscensor} onChange={setTieneAscensor} trueLabel={t('common.si')} falseLabel={t('common.no')} />
                    ) : null}
                    {fieldFlags.showAreasComunales ? (
                      <BoolToggle label={t('inmuebles.form.areasComunales')} value={areasComunales} onChange={setAreasComunales} trueLabel={t('common.si')} falseLabel={t('common.no')} />
                    ) : null}
                    {fieldFlags.showServiciosBasicos ? (
                      <ChipSelect label={t('inmuebles.form.servicios')} value={serviciosBasicos} onChange={setServiciosBasicos} options={[...SERVICIOS_OPTIONS]} lang={lang} />
                    ) : null}
                    {fieldFlags.showPisosPermitidos ? (
                      <div>
                        <FieldLabel>{t('inmuebles.form.pisosPermitidos')}</FieldLabel>
                        <input type="number" min={0} inputMode="numeric" className={detailInputClass} value={pisosPermitidos} onChange={(e) => setPisosPermitidos(e.target.value)} />
                      </div>
                    ) : null}
                    {fieldFlags.showAccesoCamion ? (
                      <BoolToggle label={t('inmuebles.form.accesoCamion')} value={accesoCamion} onChange={setAccesoCamion} trueLabel={t('common.si')} falseLabel={t('common.no')} />
                    ) : null}
                    {fieldFlags.showEspaciosYMediosBanos ? (
                      <BoolToggle label={t('inmuebles.form.balconOTerraza')} value={balconOTerraza} onChange={setBalconOTerraza} trueLabel={t('common.si')} falseLabel={t('common.no')} />
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-3">
                <ListingPhotoManager
                  items={
                    editingId
                      ? (listings.find((l) => l.id === editingId)?.photos ?? []).map((p): GalleryItem => ({ key: p.id, previewUrl: p.url, isCover: p.esPortada }))
                      : pendingPhotoPreviews.map((url, i): GalleryItem => ({ key: `pending-${i}`, previewUrl: url, isCover: i === 0 }))
                  }
                  maxPhotos={MAX_LISTING_PHOTOS}
                  uploading={uploadingPhotoFor === editingId && Boolean(editingId)}
                  onAddFiles={(files) => void handleAddPhotoFiles(files)}
                  onDelete={(key) => {
                    if (editingId) {
                      void onDeletePhoto?.(editingId, key);
                    } else {
                      handlePendingPhotoDelete(Number(key.replace('pending-', '')));
                    }
                  }}
                  onSetCover={(key) => {
                    if (editingId) {
                      void onSetCoverPhoto?.(editingId, key);
                    } else {
                      const index = Number(key.replace('pending-', ''));
                      const order = pendingPhotos.map((_, i) => i);
                      order.splice(order.indexOf(index), 1);
                      order.unshift(index);
                      handlePendingPhotoReorder(order);
                    }
                  }}
                  onReorder={(newKeyOrder) => {
                    if (editingId) {
                      void onReorderPhotos?.(editingId, newKeyOrder);
                    } else {
                      handlePendingPhotoReorder(newKeyOrder.map((k) => Number(k.replace('pending-', ''))));
                    }
                  }}
                  t={t}
                />
                <p className="mt-2.5 text-xs text-emerald-300/80">{t('inmuebles.fotoIncentivo')}</p>
                {photoError ? <p className="mt-1 text-xs text-pink-300">{photoError}</p> : null}
              </div>

              <div className="mt-4 rounded-2xl border border-violet-400/20 bg-violet-500/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-violet-300">
                  <Lock className="h-3 w-3 shrink-0" strokeWidth={2} /> {t('inmuebles.form.datosCliente.titulo')}
                </p>
                <p className="mt-1 text-xs text-text-2">{t('inmuebles.form.datosCliente.privacidad')}</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <input
                    className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder={t(
                      operationType === 'RENT' ? 'inmuebles.form.arrendador.placeholder' : 'inmuebles.form.propietario.placeholder',
                    )}
                  />
                  <input
                    className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    placeholder={t('inmuebles.form.telefonoCliente.placeholder')}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
                    {t('inmuebles.form.quienGestiona')}
                  </label>
                  {isAdmin ? (
                    <select
                      className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none focus:border-violet-400"
                      value={managingAgentId}
                      onChange={(e) => setManagingAgentId(e.target.value)}
                    >
                      <option className="bg-bg" value="">{t('inmuebles.form.seleccionaAgente')}</option>
                      {agents.map((a) => (
                        <option key={a.id} className="bg-bg" value={a.id}>
                          {a.fullName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex h-[42px] items-center rounded-xl border border-line bg-surface px-3 text-sm text-text-2">
                      {t('inmuebles.form.yoDirectamente')}
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
                    {t('inmuebles.form.comision')}
                  </label>
                  <input
                    className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none focus:border-violet-400"
                    value={commissionSharePercent}
                    type="number"
                    min={0}
                    max={100}
                    onChange={(e) => setCommissionSharePercent(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={submit}
                  disabled={creating || !title.trim() || !city.trim() || !price.trim()}
                  className="gradient-btn flex-1 rounded-full px-4 py-2.5 text-sm font-semibold text-grad-contrast transition-transform duration-200 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:flex-none"
                >
                  {creating ? t('inmuebles.form.guardando') : editingId ? t('inmuebles.guardarCambios') : t('inmuebles.form.submit')}
                </button>
                {editingId ? (
                  <button
                    onClick={cancelEdit}
                    className="rounded-full border border-line-strong px-4 py-2.5 text-sm font-semibold text-text-2 transition-colors duration-200 hover:bg-surface-2"
                  >
                    {t('inmuebles.cancelar')}
                  </button>
                ) : null}
              </div>
            </div>
        </RegisterAccordion>
      ) : !isAdmin ? (
        <section className="glass-card rounded-[1.8rem] p-4 fade-up sm:p-6">
          <h2 className="text-lg font-bold text-text">{t('inmuebles.locked.title')}</h2>
          <p className="mt-1 text-sm text-text-2">{t('inmuebles.locked.detail')}</p>
        </section>
      ) : null}

      <div className="grid gap-[18px] xl:grid-cols-2">
        {visibleListings.length === 0 && <p className="text-sm text-text-2">{t('inmuebles.list.empty')}</p>}
        {[...visibleListings]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((listing) => {
            const canEdit = !isAdmin && listing.managingAgentId === myAgentId;
            const detailIncomplete = canEdit && isListingDetailIncomplete(listing, listing.propertyType, listing.operationType);
            const withinEditWindow = Date.now() - new Date(listing.createdAt).getTime() < EDIT_WINDOW_MS;
            const editDeadline = new Date(new Date(listing.createdAt).getTime() + EDIT_WINDOW_MS);
            const dateLabel = relativeLabel(
              listing.createdAt,
              { today: t('inmuebles.cargadoHoy'), yesterday: t('inmuebles.cargadoAyer'), prefix: t('inmuebles.cargadoDel') },
              lang,
            );
            const isUploading = uploadingPhotoFor === listing.id;

            return (
              <Card key={listing.id}>
                {/* Fila 1 */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <Chip tone="teal">{tOperation(listing.operationType)} · {tProperty(listing.propertyType)}</Chip>
                    <Chip tone="teal" uppercase={false}>&#9679; {tListingStatus(listing.status)}</Chip>
                  </div>
                  <span className="shrink-0 text-[12px] font-medium text-text-3">{dateLabel}</span>
                </div>

                {/* Fila 2 */}
                <div className="mt-3 flex min-w-0 items-start gap-[13px]">
                  {listing.coverPhotoUrl ? (
                    <button
                      type="button"
                      onClick={() => setLightboxListingId(listing.id)}
                      aria-label={t('inmuebles.fotos.verGaleria')}
                      className="group relative flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-line bg-surface-2 text-accent"
                    >
                      <Image src={listing.coverPhotoUrl} alt={listing.title} fill sizes="52px" className="object-cover" />
                      {(listing.photos?.length ?? 0) > 1 ? (
                        <span className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 rounded-full bg-black/60 px-1 py-px text-[8.5px] font-bold text-white">
                          <ImagesIcon className="h-2.5 w-2.5" strokeWidth={2.4} />
                          {listing.photos?.length}
                        </span>
                      ) : null}
                    </button>
                  ) : (
                    <label className="group relative flex h-[52px] w-[52px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[11px] border border-line bg-surface-2 text-accent">
                      <PlaceholderIcon propertyType={listing.propertyType} />
                      {canEdit ? (
                        <>
                          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400/40 bg-bg text-emerald-300">
                            <Upload className="h-3 w-3" strokeWidth={2.2} />
                          </span>
                          <span className="absolute inset-0 flex items-center justify-center bg-black/70 text-center text-[9px] font-semibold text-text opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                            {isUploading ? t('inmuebles.fotoPortada.subiendo') : t('inmuebles.fotoPortada.agregar')}
                          </span>
                          <input
                            ref={(el) => {
                              cardFileInputs.current[listing.id] = el;
                            }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void handleCardPhotoSelected(file, listing.id);
                              e.target.value = '';
                            }}
                          />
                        </>
                      ) : null}
                    </label>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[16px] font-bold leading-tight text-text">
                      {abbreviatedTitle(listing.propertyType, listing.zone || listing.city, tProperty, lang)}
                    </h3>
                    <p className="mt-0.5 truncate text-[12.5px] text-text-2">{zonaLine(listing)}</p>
                    <p className="mt-1 text-[17px] font-extrabold text-accent">${listing.price.toLocaleString('en-US')}</p>
                  </div>
                </div>

                {/* Fila 3 - resumen: solo lo esencial para identificar y decidir (seccion
                    3.3): hasta 3 datos clave segun el tipo (misma fuente que la franja de
                    la ficha, ver ficha/fields.ts) + comision al colega. El detalle completo
                    (campos especificos, descripcion, propietario) vive en la ficha, no aqui. */}
                <div className="mt-3.5 flex min-w-0 flex-wrap items-center gap-1.5">
                  {fichaPrimaryRows(listing, lang).slice(0, 3).map((row, i) => {
                    const RowIcon = FICHA_ICONS[row.icon];
                    return (
                      <span
                        key={i}
                        className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text"
                      >
                        <RowIcon size={13} color="var(--accent)" strokeWidth={2} />
                        <span className="truncate">{row.value}</span>
                      </span>
                    );
                  })}
                  <Chip tone="teal" uppercase={false}>{listing.commissionSharePercent}% {t('inmuebles.comisionAlColega')}</Chip>
                </div>
                {isAdmin ? (
                  <p className="mt-2 truncate text-[11.5px] text-text-3">
                    {t('inmuebles.gestionaLabel')} <span className="font-medium text-text-2">{agentName(listing.managingAgentId, agents) ?? '—'}</span>
                  </p>
                ) : null}

                {/* Fila 4 */}
                <div className="mt-3.5 min-w-0">
                  {listing.matches && listing.matches.length > 0 ? (
                    <>
                      <div className="mb-2 flex items-center gap-1.5">
                        <span className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-text-3">{t('inmuebles.matchesDeEsteInmueble')}</span>
                        <span className="rounded-full bg-accent-dim px-[7px] py-px text-[10.5px] font-semibold text-accent">{listing.matches.length}</span>
                      </div>
                      <div className="space-y-2">
                        {/* Orden por compatibilidad descendente (Fase 8, seccion 2.8). */}
                        {[...listing.matches].sort((a, b) => b.score - a.score).map((lm) => {
                          const name = agentName(lm.createdByAgentId, agents) ?? '—';
                          const matchDate = relativeLabel(
                            lm.createdAt,
                            { today: t('matches.matchHoy'), yesterday: t('matches.matchAyer'), prefix: t('matches.matchDel') },
                            lang,
                          );
                          return (
                            <MatchLink
                              key={lm.id}
                              accent="teal"
                              onClick={() => navigateWithFade(() => onGoToMatches?.())}
                              title={`${t('common.matchCon')} ${name}`}
                              detail={`· ${matchDate}`}
                              ariaLabel={`${t('common.matchCon')} ${name} · ${matchDate}`}
                            />
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-[12.5px] text-text-3">{t('common.aunSinMatches')}</p>
                  )}
                </div>

                {/* Aviso suave de galeria vacia (Fase 4, seccion 4) - nunca bloquea, solo invita. */}
                {canEdit && !listing.coverPhotoUrl ? (
                  <button
                    type="button"
                    onClick={() => startEdit(listing)}
                    className="mt-3.5 flex w-full min-h-[44px] items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5 text-left text-xs text-emerald-200 transition-colors hover:bg-emerald-500/15"
                  >
                    <span className="flex-1">{t('inmuebles.fotos.avisoVacio')}</span>
                    <span className="shrink-0 font-semibold underline decoration-dotted underline-offset-2">{t('inmuebles.fotoPortada.agregar')}</span>
                  </button>
                ) : null}

                {/* Aviso suave de ficha incompleta (seccion 5.2) - nunca bloquea, solo invita. */}
                {detailIncomplete ? (
                  <button
                    type="button"
                    onClick={() => startEdit(listing)}
                    className="mt-3.5 flex w-full min-h-[44px] items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-left text-xs text-amber-200 transition-colors hover:bg-amber-500/15"
                  >
                    <span className="flex-1">{t('inmuebles.detalleIncompleto')}</span>
                    <span className="shrink-0 font-semibold underline decoration-dotted underline-offset-2">{t('inmuebles.detalleIncompleto.link')}</span>
                  </button>
                ) : null}

                {/* Fila 5 */}
                {canEdit ? (
                  <div className="mt-3.5 flex items-end justify-between gap-3 border-t border-line pt-3">
                    <p className="min-w-0 text-xs leading-relaxed text-text-3">
                      {withinEditWindow
                        ? `${t('inmuebles.editableHastaPrefix')} ${editDeadline.toLocaleString(lang === 'es' ? 'es-EC' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.`
                        : t('common.editVencido24h')}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      {accesoInput ? (
                        <IconActionButton
                          icon={<Download className="h-[14px] w-[14px]" strokeWidth={2} />}
                          onClick={() => setFichaListingId(listing.id)}
                          ariaLabel={t('ficha.descargar')}
                          tone="download"
                        />
                      ) : null}
                      {withinEditWindow ? (
                        <IconActionButton
                          icon={<Pencil className="h-[14px] w-[14px]" strokeWidth={2} />}
                          onClick={() => startEdit(listing)}
                          ariaLabel={t('inmuebles.editar')}
                          tone="edit"
                        />
                      ) : null}
                      <IconActionButton
                        icon={<Trash2 className="h-[14px] w-[14px]" strokeWidth={2} />}
                        onClick={() => handleDelete(listing.id)}
                        ariaLabel={t('inmuebles.eliminar')}
                        tone="delete"
                        disabled={deletingId === listing.id}
                      />
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
      </div>

      {fichaListingId && accesoInput ? (
        <FichaDownloadModal
          listingId={fichaListingId}
          listingHasPhoto={Boolean(listings.find((l) => l.id === fichaListingId)?.coverPhotoUrl)}
          suscripcion={accesoInput}
          lang={lang}
          t={t}
          onClose={() => setFichaListingId(null)}
        />
      ) : null}

      {lightboxListingId ? (
        <PhotoLightbox
          photos={(() => {
            const l = listings.find((x) => x.id === lightboxListingId);
            const urls = (l?.photos ?? []).map((p) => p.url);
            return urls.length > 0 ? urls : l?.coverPhotoUrl ? [l.coverPhotoUrl] : [];
          })()}
          onClose={() => setLightboxListingId(null)}
        />
      ) : null}
    </div>
  );
}
