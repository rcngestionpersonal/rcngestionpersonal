'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Building2, Home, Lock, Pencil, Trash2, Upload, Warehouse } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { PointsBanner } from '../PointsWidgets';
import { PriceInput } from '../PriceInput';
import { Card, Chip, DataBlock, IconActionButton, MatchLink, ModuleHeader, RegisterAccordion, abbreviatedTitle, navigateWithFade, relativeLabel, zonaLine } from '../CardKit';
import { POINT_ACTIONS } from '@/lib/real-estate/points';
import { compressImage } from '@/lib/real-estate/image-compress';
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
  ownerName?: string;
  ownerPhone?: string;
  commissionSharePercent: number;
  managingAgentId?: string;
};

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
  onCreateListing,
  creating,
  onUpdateListing,
  onDeleteListing,
  onUploadPhoto,
  onGoToMatches,
}: {
  isAdmin: boolean;
  canCreate: boolean;
  listings: ListingItem[];
  agents: AgentItem[];
  myAgentId?: string;
  onCreateListing: (input: NewListingInput) => Promise<string | undefined | void>;
  creating: boolean;
  onUpdateListing: (id: string, input: NewListingInput) => Promise<void>;
  onDeleteListing: (id: string) => Promise<void>;
  onUploadPhoto?: (listingId: string, photo: Blob) => Promise<void>;
  onGoToMatches?: () => void;
}) {
  const { t, tProperty, tOperation, tListingStatus, lang } = useLanguage();

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

  // Foto de portada: para un inmueble ya existente se sube de inmediato (sin limite
  // de 24h); para uno nuevo se guarda en memoria hasta que la creacion devuelva el id.
  const [pendingPhoto, setPendingPhoto] = useState<Blob | null>(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');
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
    setPendingPhoto(null);
    setPendingPhotoPreview(null);
    setPhotoError('');
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
    setPendingPhoto(null);
    setPendingPhotoPreview(null);
    setFormOpen(true);
  }

  function cancelEdit() {
    resetForm();
    setFormOpen(false);
  }

  async function handleFormPhotoSelected(file: File) {
    setPhotoError('');
    try {
      const compressed = await compressImage(file);
      if (editingId) {
        setUploadingPhotoFor(editingId);
        await onUploadPhoto?.(editingId, compressed);
        setUploadingPhotoFor(null);
      } else {
        setPendingPhoto(compressed);
        setPendingPhotoPreview(URL.createObjectURL(compressed));
      }
    } catch {
      setPhotoError(t('inmuebles.fotoPortada.error'));
      setUploadingPhotoFor(null);
    }
  }

  async function handleCardPhotoSelected(file: File, listingId: string) {
    setPhotoError('');
    try {
      const compressed = await compressImage(file);
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
    const input: NewListingInput = {
      title: title.trim(),
      operationType,
      propertyType,
      city: city.trim(),
      zone: zone.trim() || undefined,
      price: Number(price),
      ownerName: ownerName.trim() || undefined,
      ownerPhone: ownerPhone.trim() || undefined,
      commissionSharePercent: Number(commissionSharePercent) || 0,
      managingAgentId: isAdmin ? managingAgentId || undefined : undefined,
    };
    if (editingId) {
      await onUpdateListing(editingId, input);
    } else {
      const newId = await onCreateListing(input);
      if (newId && pendingPhoto) {
        await onUploadPhoto?.(newId, pendingPhoto);
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

              <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-300">{t('inmuebles.fotoPortada.label')}</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-line bg-surface-2">
                    {pendingPhotoPreview || (editingId && listings.find((l) => l.id === editingId)?.coverPhotoUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pendingPhotoPreview ?? listings.find((l) => l.id === editingId)?.coverPhotoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <>
                        <PlaceholderIcon propertyType={propertyType} />
                        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400/40 bg-bg text-emerald-300">
                          <Upload className="h-3 w-3" strokeWidth={2.2} />
                        </span>
                      </>
                    )}
                  </div>
                  <label className="cursor-pointer rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors duration-200 hover:bg-emerald-500/20">
                    {uploadingPhotoFor === editingId && editingId ? t('inmuebles.fotoPortada.subiendo') : t('inmuebles.fotoPortada.cambiar')}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFormPhotoSelected(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                <p className="mt-2 text-xs text-emerald-300/80">{t('inmuebles.fotoIncentivo')}</p>
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
                  <label className="group relative flex h-[52px] w-[52px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[11px] border border-line bg-surface-2 text-[#2dd4bf]">
                    {listing.coverPhotoUrl ? (
                      <Image src={listing.coverPhotoUrl} alt={listing.title} fill sizes="52px" className="object-cover" />
                    ) : (
                      <>
                        <PlaceholderIcon propertyType={listing.propertyType} />
                        {canEdit ? (
                          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400/40 bg-bg text-emerald-300">
                            <Upload className="h-3 w-3" strokeWidth={2.2} />
                          </span>
                        ) : null}
                        {canEdit ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/70 text-center text-[9px] font-semibold text-text opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                            {isUploading ? t('inmuebles.fotoPortada.subiendo') : t('inmuebles.fotoPortada.agregar')}
                          </span>
                        ) : null}
                      </>
                    )}
                    {canEdit ? (
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
                    ) : null}
                  </label>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[16px] font-bold leading-tight text-text">
                      {abbreviatedTitle(listing.propertyType, listing.zone || listing.city, tProperty, lang)}
                    </h3>
                    <p className="mt-0.5 truncate text-[12.5px] text-text-2">{zonaLine(listing)}</p>
                    <p className="mt-1 text-[17px] font-extrabold text-[#2dd4bf]">${listing.price.toLocaleString('en-US')}</p>
                  </div>
                </div>

                {/* Fila 3 */}
                <div className="mt-3.5 min-w-0">
                  <DataBlock
                    rows={[
                      {
                        label: t('inmuebles.comisionSufijo'),
                        value: <span className="font-bold text-[#2dd4bf]">{listing.commissionSharePercent}% {t('inmuebles.comisionAlColega')}</span>,
                      },
                      listing.ownerName || listing.ownerPhone
                        ? {
                            label: t('inmuebles.propietarioLabel'),
                            value: (
                              <span className="inline-flex items-center gap-1.5" title={t('common.visibleSoloParaTi')}>
                                <Lock className="h-[11px] w-[11px] shrink-0 text-text-3" strokeWidth={2.2} />
                                {listing.ownerName ?? t('pedidos.sinNombre')}
                              </span>
                            ),
                          }
                        : null,
                      { label: t('inmuebles.gestionaLabel'), value: agentName(listing.managingAgentId, agents) ?? '—' },
                    ]}
                  />
                </div>

                {/* Fila 4 */}
                <div className="mt-3.5 min-w-0">
                  {listing.matches && listing.matches.length > 0 ? (
                    <>
                      <div className="mb-2 flex items-center gap-1.5">
                        <span className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-text-3">{t('inmuebles.matchesDeEsteInmueble')}</span>
                        <span className="rounded-full bg-[rgba(45,212,191,0.12)] px-[7px] py-px text-[10.5px] font-semibold text-[#2dd4bf]">{listing.matches.length}</span>
                      </div>
                      <div className="space-y-2">
                        {listing.matches.map((lm) => {
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

                {/* Fila 5 */}
                {canEdit ? (
                  <div className="mt-3.5 flex items-end justify-between gap-3 border-t border-[rgba(255,255,255,0.07)] pt-3">
                    <p className="min-w-0 text-xs leading-relaxed text-text-3">
                      {withinEditWindow
                        ? `${t('inmuebles.editableHastaPrefix')} ${editDeadline.toLocaleString(lang === 'es' ? 'es-EC' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.`
                        : t('common.editVencido24h')}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
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
    </div>
  );
}
