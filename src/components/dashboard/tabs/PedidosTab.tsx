'use client';

import { useState } from 'react';
import { Search, Lock, Pencil, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { PointsBanner } from '../PointsWidgets';
import { PriceInput } from '../PriceInput';
import { Card, Chip, DataBlock, IconActionButton, MatchLink, ModuleHeader, RegisterAccordion, abbreviatedTitle, fmtBudget, navigateWithFade, relativeLabel, zonaLine } from '../CardKit';
import { POINT_ACTIONS } from '@/lib/real-estate/points';
import type { AgentItem, AuthUser, OpportunityItem } from '../types';

const OPERATION_VALUES = ['SALE', 'RENT', 'BOTH'] as const;
const PROPERTY_VALUES = ['HOUSE', 'APARTMENT', 'SUITE', 'OFFICE', 'LAND', 'COMMERCIAL', 'WAREHOUSE', 'FARM', 'OTHER'];
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type NewOpportunityInput = {
  operationType: 'SALE' | 'RENT' | 'BOTH';
  propertyType: string;
  city: string;
  zone?: string;
  budgetMin?: number;
  budgetMax?: number;
  contactName?: string;
  contactPhone?: string;
};

function pillClasses(active: boolean): string {
  return active
    ? 'gradient-btn border-transparent text-grad-contrast'
    : 'border-line-strong text-text-2 hover:bg-surface-2';
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

  function resetForm() {
    setCity('');
    setZone('');
    setBudgetMin('');
    setBudgetMax('');
    setContactName('');
    setContactPhone('');
    setEditingId(null);
  }

  function startEdit(op: OpportunityItem) {
    setEditingId(op.id);
    setOperationType(op.operationType);
    setPropertyType(op.propertyType);
    setCity(op.city);
    setZone(op.zone ?? '');
    setBudgetMin(op.budgetMin !== undefined ? String(op.budgetMin) : '');
    setBudgetMax(op.budgetMax !== undefined ? String(op.budgetMax) : '');
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
    const input: NewOpportunityInput = {
      operationType,
      propertyType,
      city: city.trim(),
      zone: zone.trim() || undefined,
      budgetMin: budgetMin.trim() ? Number(budgetMin.trim()) : undefined,
      budgetMax: budgetMax.trim() ? Number(budgetMax.trim()) : undefined,
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
                  disabled={creatingOpportunity || !city.trim()}
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
