'use client';

import { useState } from 'react';
import { Search, Lock, Pencil, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { PointsBanner } from '../PointsWidgets';
import { PriceInput } from '../PriceInput';
import { Card, Chip, DataBlock, IconActionButton, MatchLink, ModuleHeader, RegisterAccordion, abbreviatedTitle, fmtBudget, navigateWithFade, relativeLabel, zonaLine } from '../CardKit';
import { POINT_ACTIONS } from '@/lib/real-estate/points';
import { listingFieldsFor } from '@/lib/real-estate/listing-fields';
import type { AgentItem, AuthUser, OpportunityItem } from '../types';

const OPERATION_VALUES = ['SALE', 'RENT', 'BOTH'] as const;
const PROPERTY_VALUES = ['HOUSE', 'APARTMENT', 'SUITE', 'OFFICE', 'LAND', 'COMMERCIAL', 'WAREHOUSE', 'FARM', 'OTHER'];
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const PREF_VALUES = ['SI', 'NO'] as const;

export type NewOpportunityInput = {
  operationType: 'SALE' | 'RENT' | 'BOTH';
  propertyType: string;
  city: string;
  zone?: string;
  budgetMin?: number;
  budgetMax?: number;
  areaM2?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  prefAreaVerdeAmplia?: 'SI' | 'NO';
  prefAreasComunales?: 'SI' | 'NO';
  prefAscensor?: 'SI' | 'NO';
  prefAmoblado?: 'SI' | 'NO';
  prefTodosLosServicios?: 'SI' | 'NO';
  contactName?: string;
  contactPhone?: string;
};

function pillClasses(active: boolean): string {
  return active
    ? 'gradient-btn border-transparent text-grad-contrast'
    : 'border-line-strong text-text-2 hover:bg-surface-2';
}

// Tap targets de al menos 44px en movil (seccion 5.3).
function detailPillClasses(active: boolean): string {
  return `min-h-[44px] rounded-full border px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 ${
    active ? 'gradient-btn border-transparent text-grad-contrast' : 'border-line-strong text-text-2 hover:bg-surface-2'
  }`;
}

const detailInputClass =
  'w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400';

// Interruptor de preferencia (seccion 3.2): SI / NO / Indiferente, por
// defecto Indiferente (value=undefined) - solo pondera si el agente lo activa.
function PrefToggle({ label, value, onChange, t }: { label: string; value: 'SI' | 'NO' | undefined; onChange: (v: 'SI' | 'NO' | undefined) => void; t: (k: string) => string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {PREF_VALUES.map((v) => (
          <button key={v} type="button" onClick={() => onChange(value === v ? undefined : v)} className={detailPillClasses(value === v)}>
            {v === 'SI' ? t('common.si') : t('common.no')}
          </button>
        ))}
        <span className={`inline-flex items-center rounded-full border px-3.5 py-2.5 text-xs font-semibold ${value === undefined ? 'border-brand-line bg-brand-dim text-brand' : 'border-line text-text-3'}`}>
          {t('pedidos.form.indiferente')}
        </span>
      </div>
    </div>
  );
}

export default function PedidosTab({
  isAdmin,
  canCreate,
  agentOpportunities,
  agents,
  user,
  onCreateOpportunity,
  creatingOpportunity,
  onUpdateOpportunity,
  onDeleteOpportunity,
  onGoToMatches,
}: {
  isAdmin: boolean;
  canCreate: boolean;
  agentOpportunities: OpportunityItem[];
  agents: AgentItem[];
  user: AuthUser | null;
  onCreateOpportunity: (input: NewOpportunityInput) => Promise<void>;
  creatingOpportunity: boolean;
  onUpdateOpportunity: (id: string, input: NewOpportunityInput) => Promise<void>;
  onDeleteOpportunity: (id: string) => Promise<void>;
  onGoToMatches?: () => void;
}) {
  const { t, tProperty, tOperation, lang } = useLanguage();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [operationType, setOperationType] = useState<'SALE' | 'RENT' | 'BOTH'>('SALE');
  const [propertyType, setPropertyType] = useState('HOUSE');
  const [city, setCity] = useState('');
  const [zone, setZone] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Detalles de la busqueda (seccion 3.1) - todos opcionales, "al menos"
  // (minimo deseado) en vez de valor exacto.
  const [areaM2, setAreaM2] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [parkingSpaces, setParkingSpaces] = useState('');
  const [prefAreaVerdeAmplia, setPrefAreaVerdeAmplia] = useState<'SI' | 'NO' | undefined>(undefined);
  const [prefAreasComunales, setPrefAreasComunales] = useState<'SI' | 'NO' | undefined>(undefined);
  const [prefAscensor, setPrefAscensor] = useState<'SI' | 'NO' | undefined>(undefined);
  const [prefAmoblado, setPrefAmoblado] = useState<'SI' | 'NO' | undefined>(undefined);
  const [prefTodosLosServicios, setPrefTodosLosServicios] = useState<'SI' | 'NO' | undefined>(undefined);

  const fieldFlags = listingFieldsFor(propertyType, operationType);

  function resetDetailFields() {
    setAreaM2('');
    setBedrooms('');
    setBathrooms('');
    setParkingSpaces('');
    setPrefAreaVerdeAmplia(undefined);
    setPrefAreasComunales(undefined);
    setPrefAscensor(undefined);
    setPrefAmoblado(undefined);
    setPrefTodosLosServicios(undefined);
  }

  function resetForm() {
    setCity('');
    setZone('');
    setBudgetMin('');
    setBudgetMax('');
    setContactName('');
    setContactPhone('');
    setEditingId(null);
    resetDetailFields();
  }

  function startEdit(op: OpportunityItem) {
    setEditingId(op.id);
    setOperationType(op.operationType);
    setPropertyType(op.propertyType);
    setCity(op.city);
    setZone(op.zone ?? '');
    setBudgetMin(op.budgetMin !== undefined ? String(op.budgetMin) : '');
    setBudgetMax(op.budgetMax !== undefined ? String(op.budgetMax) : '');
    setAreaM2(op.areaM2 != null ? String(op.areaM2) : '');
    setBedrooms(op.bedrooms != null ? String(op.bedrooms) : '');
    setBathrooms(op.bathrooms != null ? String(op.bathrooms) : '');
    setParkingSpaces(op.parkingSpaces != null ? String(op.parkingSpaces) : '');
    setPrefAreaVerdeAmplia(op.prefAreaVerdeAmplia === 'SI' || op.prefAreaVerdeAmplia === 'NO' ? op.prefAreaVerdeAmplia : undefined);
    setPrefAreasComunales(op.prefAreasComunales === 'SI' || op.prefAreasComunales === 'NO' ? op.prefAreasComunales : undefined);
    setPrefAscensor(op.prefAscensor === 'SI' || op.prefAscensor === 'NO' ? op.prefAscensor : undefined);
    setPrefAmoblado(op.prefAmoblado === 'SI' || op.prefAmoblado === 'NO' ? op.prefAmoblado : undefined);
    setPrefTodosLosServicios(op.prefTodosLosServicios === 'SI' || op.prefTodosLosServicios === 'NO' ? op.prefTodosLosServicios : undefined);
    setContactName(op.contactName ?? '');
    setContactPhone(op.contactPhone ?? '');
    setFormOpen(true);
  }

  function cancelEdit() {
    resetForm();
    setFormOpen(false);
  }

  async function submitOpportunity() {
    if (!city.trim()) return;
    // Presupuesto obligatorio solo para pedidos NUEVOS (criterio excluyente
    // del matching) - un pedido existente sin presupuesto se sigue pudiendo
    // editar sin que esto lo bloquee.
    if (!editingId && !budgetMin.trim() && !budgetMax.trim()) return;
    const num = (v: string) => (v.trim() ? Number(v) : undefined);
    const input: NewOpportunityInput = {
      operationType,
      propertyType,
      city: city.trim(),
      zone: zone.trim() || undefined,
      budgetMin: budgetMin.trim() ? Number(budgetMin.trim()) : undefined,
      budgetMax: budgetMax.trim() ? Number(budgetMax.trim()) : undefined,
      areaM2: num(areaM2),
      bedrooms: fieldFlags.showDormitorios ? num(bedrooms) : undefined,
      bathrooms: fieldFlags.showBanos ? num(bathrooms) : undefined,
      parkingSpaces: fieldFlags.showParqueos ? num(parkingSpaces) : undefined,
      prefAreaVerdeAmplia: propertyType === 'HOUSE' ? prefAreaVerdeAmplia : undefined,
      prefAreasComunales: propertyType === 'APARTMENT' || propertyType === 'SUITE' ? prefAreasComunales : undefined,
      prefAscensor: propertyType === 'APARTMENT' || propertyType === 'SUITE' ? prefAscensor : undefined,
      prefAmoblado: fieldFlags.showAmoblado ? prefAmoblado : undefined,
      prefTodosLosServicios: propertyType === 'LAND' ? prefTodosLosServicios : undefined,
      contactName: contactName.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
    };
    if (editingId) {
      await onUpdateOpportunity(editingId, input);
    } else {
      await onCreateOpportunity(input);
    }
    resetForm();
    setFormOpen(false);
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t('pedidos.eliminarConfirm'))) return;
    setDeletingId(id);
    try {
      await onDeleteOpportunity(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <ModuleHeader icon={<Search className="h-[18px] w-[18px]" strokeWidth={2} />} title={isAdmin ? t('pedidos.list.title.admin') : t('pedidos.list.title.agent')} subtitle={t('pedidos.moduleSubtitle')} />

      {!isAdmin ? <PointsBanner variant="pedidos" t={t} /> : null}

      {canCreate ? (
        <RegisterAccordion
          title={editingId ? t('pedidos.editando') : t('pedidos.form.title')}
          points={POINT_ACTIONS.PEDIDO_CREATED.points}
          subtitle={t('pedidos.form.subtitle')}
          open={formOpen}
          onToggle={() => (formOpen ? cancelEdit() : setFormOpen(true))}
        >
            <div>
              <div className="flex flex-wrap gap-2">
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

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t('pedidos.form.ciudad.placeholder')}
                />
                <input
                  className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  placeholder={t('pedidos.form.zona.placeholder')}
                />
                <PriceInput value={budgetMin} onChange={setBudgetMin} placeholder={t('pedidos.form.presupuestoMin.placeholder')} helperText={t('common.precioAyuda')} />
                <PriceInput value={budgetMax} onChange={setBudgetMax} placeholder={t('pedidos.form.presupuestoMax.placeholder')} />
              </div>
              {!editingId ? <p className="mt-1.5 text-xs text-text-3">{t('pedidos.form.presupuestoObligatorio')}</p> : null}

              {/* Detalles de la busqueda (seccion 3.1) - todo opcional, plegado
                  por defecto para que el formulario se sienta agil pese a
                  tener mas campos. */}
              <details className="mt-3 rounded-2xl border border-line-strong bg-surface-2/60 p-3">
                <summary className="cursor-pointer select-none text-sm font-semibold text-text-2">{t('pedidos.form.detallesOpcional')}</summary>
                <div className="mt-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
                        {lang === 'es' ? fieldFlags.areaM2Label.es : fieldFlags.areaM2Label.en} — {t('pedidos.form.alMenos')}
                      </label>
                      <input type="number" min={0} inputMode="decimal" className={detailInputClass} value={areaM2} onChange={(e) => setAreaM2(e.target.value)} placeholder="m²" />
                    </div>
                    {fieldFlags.showDormitorios ? (
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
                          {t('inmuebles.form.dormitorios')} — {t('pedidos.form.alMenos')}
                        </label>
                        <input type="number" min={0} inputMode="numeric" className={detailInputClass} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
                      </div>
                    ) : null}
                    {fieldFlags.showBanos ? (
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
                          {t('inmuebles.form.banos')} — {t('pedidos.form.alMenos')}
                        </label>
                        <input type="number" min={0} inputMode="numeric" className={detailInputClass} value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
                      </div>
                    ) : null}
                    {fieldFlags.showParqueos ? (
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
                          {t('inmuebles.form.parqueos')} — {t('pedidos.form.alMenos')}
                        </label>
                        <input type="number" min={0} inputMode="numeric" className={detailInputClass} value={parkingSpaces} onChange={(e) => setParkingSpaces(e.target.value)} />
                      </div>
                    ) : null}
                  </div>

                  {propertyType === 'HOUSE' || propertyType === 'APARTMENT' || propertyType === 'SUITE' || propertyType === 'LAND' || fieldFlags.showAmoblado ? (
                    <div className="mt-4 space-y-3 border-t border-line pt-3">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-3">{t('pedidos.form.interruptores')}</p>
                      {propertyType === 'HOUSE' ? (
                        <PrefToggle label={t('pedidos.form.prefAreaVerde')} value={prefAreaVerdeAmplia} onChange={setPrefAreaVerdeAmplia} t={t} />
                      ) : null}
                      {propertyType === 'APARTMENT' || propertyType === 'SUITE' ? (
                        <>
                          <PrefToggle label={t('pedidos.form.prefAreasComunales')} value={prefAreasComunales} onChange={setPrefAreasComunales} t={t} />
                          <PrefToggle label={t('pedidos.form.prefAscensor')} value={prefAscensor} onChange={setPrefAscensor} t={t} />
                        </>
                      ) : null}
                      {fieldFlags.showAmoblado ? (
                        <PrefToggle label={t('pedidos.form.prefAmoblado')} value={prefAmoblado} onChange={setPrefAmoblado} t={t} />
                      ) : null}
                      {propertyType === 'LAND' ? (
                        <PrefToggle label={t('pedidos.form.prefServicios')} value={prefTodosLosServicios} onChange={setPrefTodosLosServicios} t={t} />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </details>

              <div className="mt-3 rounded-2xl border border-violet-400/20 bg-violet-500/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-violet-300">
                  <Lock className="h-3 w-3 shrink-0" strokeWidth={2} /> {t('pedidos.form.datosCliente.titulo')}
                </p>
                <p className="mt-1 text-xs text-text-2">{t('pedidos.form.datosCliente.privacidad')}</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <input
                    className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder={t(
                      operationType === 'RENT' ? 'pedidos.form.arrendatario.placeholder' : 'pedidos.form.comprador.placeholder',
                    )}
                  />
                  <input
                    className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder={t('pedidos.form.telefonoCliente.placeholder')}
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={submitOpportunity}
                  disabled={creatingOpportunity || !city.trim() || (!editingId && !budgetMin.trim() && !budgetMax.trim())}
                  className="gradient-btn flex-1 rounded-full px-4 py-2.5 text-sm font-semibold text-grad-contrast transition-transform duration-200 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:flex-none"
                >
                  {creatingOpportunity ? t('pedidos.form.guardando') : editingId ? t('pedidos.guardarCambios') : t('pedidos.form.submit')}
                </button>
                {editingId ? (
                  <button
                    onClick={cancelEdit}
                    className="rounded-full border border-line-strong px-4 py-2.5 text-sm font-semibold text-text-2 transition-colors duration-200 hover:bg-surface-2"
                  >
                    {t('pedidos.cancelar')}
                  </button>
                ) : null}
              </div>
            </div>
        </RegisterAccordion>
      ) : !isAdmin ? (
        <section className="glass-card rounded-[1.8rem] p-4 fade-up sm:p-6">
          <h2 className="text-lg font-bold text-text">{t('pedidos.locked.title')}</h2>
          <p className="mt-1 text-sm text-text-2">{t('pedidos.locked.detail')}</p>
        </section>
      ) : null}

      <div id="pedidos-panel" className="grid gap-[18px] xl:grid-cols-2">
        {agentOpportunities.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line-strong p-5 text-sm text-text-2">
            {isAdmin ? t('pedidos.list.empty.admin') : t('pedidos.list.empty.agent')}
          </div>
        )}
        {[...agentOpportunities]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((op) => {
            const canEdit = !isAdmin && Boolean(user?.agentId) && op.createdByAgentId === user?.agentId;
            const presupuestoIncompleto = canEdit && !op.budgetMin && !op.budgetMax;
            const withinEditWindow = Date.now() - new Date(op.createdAt).getTime() < EDIT_WINDOW_MS;
            const editDeadline = new Date(new Date(op.createdAt).getTime() + EDIT_WINDOW_MS);

            const origenLabel = op.createdByAgentId
              ? isAdmin
                ? `${t('admin.pedidos.cargadoPor')} ${agents.find((a) => a.id === op.createdByAgentId)?.fullName ?? op.createdByAgentId}`
                : op.createdByAgentId === user?.agentId
                  ? t('pedidos.cargadoPorAgente')
                  : t('pedidos.chatWeb')
              : t('pedidos.chatWeb');

            const dateLabel = relativeLabel(
              op.createdAt,
              { today: t('pedidos.pedidoHoy'), yesterday: t('pedidos.pedidoAyer'), prefix: t('pedidos.pedidoDel') },
              lang,
            );

            const matches = op.listingMatches ?? [];

            return (
              <Card key={op.id}>
                {/* Fila 1 */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <Chip tone="violet">{tOperation(op.operationType)} · {tProperty(op.propertyType)}</Chip>
                    <Chip tone="neutral" uppercase={false}>{origenLabel}</Chip>
                  </div>
                  <span className="shrink-0 text-[12px] font-medium text-text-3">{dateLabel}</span>
                </div>

                {/* Fila 2 */}
                <h3 className="mt-3 truncate text-[16px] font-bold leading-tight tracking-[-0.01em] text-text">
                  {abbreviatedTitle(op.propertyType, op.zone || op.city, tProperty, lang)}
                </h3>
                <p className="mb-3.5 mt-1 truncate text-[12.5px] font-medium text-text-2">{zonaLine(op)}</p>

                {/* Fila 3 */}
                <DataBlock
                  rows={[
                    { label: t('pedidos.presupuesto').replace(':', ''), value: fmtBudget(op.budgetMin, op.budgetMax, t('pedidos.presupuestoNoDetectado')) },
                    op.contactName || op.contactPhone
                      ? {
                          label: t('pedidos.contacto').replace(':', ''),
                          value: (
                            <span className="inline-flex items-center gap-1.5" title={t('common.visibleSoloParaTi')}>
                              <Lock className="h-[11px] w-[11px] shrink-0 text-text-3" strokeWidth={2.2} />
                              {op.contactName ?? t('pedidos.sinNombre')}
                            </span>
                          ),
                        }
                      : null,
                  ]}
                />

                {op.referredByAgentId ? (
                  <p className="mt-2.5 truncate text-xs text-cyan-300">
                    {t('pedidos.referidoPor')} {agents.find((a) => a.id === op.referredByAgentId)?.fullName ?? op.referredByAgentId}
                    {typeof op.referralCommissionPercent === 'number' ? ` (${op.referralCommissionPercent}%)` : ''}
                  </p>
                ) : null}

                {!isAdmin && user?.agentId && op.claimedByAgentId ? (
                  <p className="mt-2.5 text-xs text-text-3">
                    {op.claimedByAgentId === user.agentId ? t('pedidos.yaReclamada') : t('pedidos.reclamadaOtro')}
                  </p>
                ) : null}

                {/* Fila 4 */}
                <div className="mt-3.5 min-w-0">
                  {matches.length > 0 ? (
                    <>
                      <div className="mb-2 flex items-center gap-1.5">
                        <span className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-text-3">{t('pedidos.matchesDeEstePedido')}</span>
                        <span className="rounded-full bg-brand-dim px-[7px] py-px text-[10.5px] font-semibold text-brand">{matches.length}</span>
                      </div>
                      <div className="space-y-2">
                        {matches.map((lm) => {
                          const name = agents.find((a) => a.id === lm.managingAgentId)?.fullName ?? '—';
                          const matchDate = relativeLabel(
                            lm.createdAt,
                            { today: t('matches.matchHoy'), yesterday: t('matches.matchAyer'), prefix: t('matches.matchDel') },
                            lang,
                          );
                          return (
                            <MatchLink
                              key={lm.id}
                              accent="violet"
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

                {/* Aviso suave para pedidos existentes sin presupuesto (nunca bloquea). */}
                {presupuestoIncompleto ? (
                  <button
                    type="button"
                    onClick={() => startEdit(op)}
                    className="mt-3.5 flex w-full min-h-[44px] items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-left text-xs text-amber-200 transition-colors hover:bg-amber-500/15"
                  >
                    <span className="flex-1">{t('pedidos.presupuestoIncompleto')}</span>
                    <span className="shrink-0 font-semibold underline decoration-dotted underline-offset-2">{t('inmuebles.detalleIncompleto.link')}</span>
                  </button>
                ) : null}

                {/* Fila 5 */}
                <div className="mt-3.5 flex items-end justify-between gap-3 border-t border-[rgba(255,255,255,0.07)] pt-3">
                  {canEdit ? (
                    <p className="min-w-0 text-xs leading-relaxed text-text-3">
                      {withinEditWindow
                        ? `${t('pedidos.editableHastaPrefix')} ${editDeadline.toLocaleString(lang === 'es' ? 'es-EC' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.`
                        : t('common.editVencido24h')}
                    </p>
                  ) : (
                    <span />
                  )}
                  {canEdit ? (
                    <div className="flex shrink-0 items-center gap-2">
                      {withinEditWindow ? (
                        <IconActionButton
                          icon={<Pencil className="h-[14px] w-[14px]" strokeWidth={2} />}
                          onClick={() => startEdit(op)}
                          ariaLabel={t('pedidos.editar')}
                          tone="edit"
                        />
                      ) : null}
                      <IconActionButton
                        icon={<Trash2 className="h-[14px] w-[14px]" strokeWidth={2} />}
                        onClick={() => handleDelete(op.id)}
                        ariaLabel={t('pedidos.eliminar')}
                        tone="delete"
                        disabled={deletingId === op.id}
                      />
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
