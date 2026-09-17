'use client';

import { useCallback, useEffect, useState } from 'react';
import { nuevaClaveClausula, type ClausulaEditable, type EdicionClausulas } from '@/lib/real-estate/contratos/clausulas';
import type { DocumentoTrabajo } from './tipos-cliente';

// Nivel 2: el editor de cláusulas.
//
// Pensado para el celular: una tarjeta por cláusula, y se edita de a una. No es
// un editor de documento completo, porque en una pantalla de 375 px un
// documento de doce páginas no se edita, se sufre.
//
// Lo que el agente hace aquí se guarda como EDICIONES sobre el modelo, nunca
// como un texto suelto: por eso cada cláusula modificada se puede restaurar, la
// numeración se recalcula sola y las referencias entre cláusulas siguen
// apuntando bien aunque se active una opcional o se agregue una nueva.

export default function ContratoClausulas({ t, contratoId }: { t: (k: string) => string; contratoId: string }) {
  const [doc, setDoc] = useState<DocumentoTrabajo | null>(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  // Qué tarjeta está en edición, o dónde se está agregando una nueva.
  const [editando, setEditando] = useState<string | null>(null);
  const [agregandoTras, setAgregandoTras] = useState<string | null | undefined>(undefined);

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/real-estate/contratos/${contratoId}/documento`, { cache: 'no-store' });
    if (!r.ok) {
      setError(t('contratos.error.documento'));
      return;
    }
    setDoc((await r.json()) as DocumentoTrabajo);
  }, [contratoId, t]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Cada acción guarda la edición entera y vuelve a pedir el documento: la
  // numeración y las referencias las resuelve el servidor, no la pantalla.
  async function guardar(edicion: EdicionClausulas): Promise<boolean> {
    setGuardando(true);
    setError('');
    try {
      const r = await fetch(`/api/real-estate/contratos/${contratoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clausulas: edicion }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error ?? t('contratos.error.guardar'));
        return false;
      }
      await cargar();
      return true;
    } finally {
      setGuardando(false);
    }
  }

  if (!doc) {
    return error ? (
      <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p>
    ) : (
      <p className="text-sm text-text-2">{t('contratos.cargando')}</p>
    );
  }

  if (!doc.admiteEdicion) {
    return <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-text-2">{t('contratos.clausulas.noEditable')}</p>;
  }

  const e = doc.edicion;
  const activas = doc.clausulas.filter((c) => c.activa).length;
  const modificadas = doc.clausulas.filter((c) => c.modificada).length;
  const agregadas = doc.clausulas.filter((c) => c.nueva).length;

  const acciones = {
    guardarTexto: (c: ClausulaEditable, titulo: string, texto: string) => {
      if (c.nueva) {
        return guardar({ ...e, nuevas: e.nuevas.map((n) => (n.id === c.clave ? { ...n, titulo, texto } : n)) });
      }
      const textos = { ...e.textos };
      // Guardar el mismo texto del modelo es no haberlo editado.
      if (titulo.trim() === c.tituloOriginal.trim() && texto.trim() === c.textoOriginal.trim()) delete textos[c.clave];
      else textos[c.clave] = { titulo, texto };
      return guardar({ ...e, textos });
    },
    restaurar: (c: ClausulaEditable) => {
      const textos = { ...e.textos };
      delete textos[c.clave];
      return guardar({ ...e, textos });
    },
    alternar: (c: ClausulaEditable, activa: boolean) => {
      const nuevasActivas = { ...e.activas };
      if (c.opcional && activa === c.opcional.activaPorDefecto) delete nuevasActivas[c.clave];
      else nuevasActivas[c.clave] = activa;
      return guardar({ ...e, activas: nuevasActivas });
    },
    quitar: (c: ClausulaEditable) => {
      // Las que iban detrás de la quitada pasan a ir detrás de su anterior.
      const quitada = e.nuevas.find((n) => n.id === c.clave);
      const nuevas = e.nuevas
        .filter((n) => n.id !== c.clave)
        .map((n) => (n.despuesDe === c.clave ? { ...n, despuesDe: quitada?.despuesDe ?? null } : n));
      const textos = { ...e.textos };
      delete textos[c.clave];
      return guardar({ ...e, textos, nuevas });
    },
    agregar: (despuesDe: string | null, titulo: string, texto: string) =>
      guardar({ ...e, nuevas: [...e.nuevas, { id: nuevaClaveClausula(), titulo, texto, despuesDe }] }),
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-[13px] leading-relaxed text-text-2">{t('contratos.clausulas.intro')}</p>
        <p className="mt-2 text-xs font-semibold text-text-3">
          {t('contratos.clausulas.resumen')
            .replace('{n}', String(activas))
            .replace('{m}', String(modificadas))
            .replace('{a}', String(agregadas))}
          {guardando ? ` · ${t('contratos.clausulas.guardando')}` : ''}
        </p>
      </div>

      {error ? <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p> : null}

      <ol className="space-y-3">
        {doc.clausulas.map((c) => (
          <li key={c.clave}>
            <TarjetaClausula
              t={t}
              clausula={c}
              editando={editando === c.clave}
              ocupado={guardando}
              onEditar={() => {
                setEditando(c.clave);
                setAgregandoTras(undefined);
              }}
              onCancelar={() => setEditando(null)}
              onGuardar={async (titulo, texto) => {
                if (await acciones.guardarTexto(c, titulo, texto)) setEditando(null);
              }}
              onRestaurar={() => void acciones.restaurar(c)}
              onAlternar={(activa) => void acciones.alternar(c, activa)}
              onQuitar={() => void acciones.quitar(c)}
            />
            {agregandoTras === c.clave ? (
              <FormularioNueva
                t={t}
                ocupado={guardando}
                onCancelar={() => setAgregandoTras(undefined)}
                onGuardar={async (titulo, texto) => {
                  if (await acciones.agregar(c.clave, titulo, texto)) setAgregandoTras(undefined);
                }}
              />
            ) : (
              <button
                onClick={() => {
                  setAgregandoTras(c.clave);
                  setEditando(null);
                }}
                className="mt-1.5 min-h-[40px] w-full rounded-xl border border-dashed border-line px-3 text-[12.5px] font-semibold text-text-3 transition hover:border-line-strong hover:text-text-2"
              >
                {t('contratos.clausulas.agregarDespues')}
              </button>
            )}
          </li>
        ))}
      </ol>

      {agregandoTras === null ? (
        <FormularioNueva
          t={t}
          ocupado={guardando}
          onCancelar={() => setAgregandoTras(undefined)}
          onGuardar={async (titulo, texto) => {
            if (await acciones.agregar(null, titulo, texto)) setAgregandoTras(undefined);
          }}
        />
      ) : (
        <button
          onClick={() => {
            setAgregandoTras(null);
            setEditando(null);
          }}
          className="min-h-[44px] w-full rounded-xl border border-line px-4 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
        >
          {t('contratos.clausulas.agregarFinal')}
        </button>
      )}
    </div>
  );
}

function Insignia({ children, tono }: { children: React.ReactNode; tono: 'marca' | 'acento' | 'neutro' | 'aviso' }) {
  const clases = {
    marca: 'border-brand-line bg-brand-dim text-brand',
    acento: 'border-accent-line bg-accent-dim text-accent',
    neutro: 'border-line bg-surface-2 text-text-2',
    aviso: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200',
  }[tono];
  return <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${clases}`}>{children}</span>;
}

function TarjetaClausula({
  t,
  clausula: c,
  editando,
  ocupado,
  onEditar,
  onCancelar,
  onGuardar,
  onRestaurar,
  onAlternar,
  onQuitar,
}: {
  t: (k: string) => string;
  clausula: ClausulaEditable;
  editando: boolean;
  ocupado: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onGuardar: (titulo: string, texto: string) => void;
  onRestaurar: () => void;
  onAlternar: (activa: boolean) => void;
  onQuitar: () => void;
}) {
  const [titulo, setTitulo] = useState(c.titulo);
  const [texto, setTexto] = useState(c.texto);
  const [completa, setCompleta] = useState(false);
  const [verOriginal, setVerOriginal] = useState(false);

  // Al abrir el editor, parte del texto vigente.
  useEffect(() => {
    if (editando) {
      setTitulo(c.titulo);
      setTexto(c.texto);
    }
  }, [editando, c.titulo, c.texto]);

  const larga = c.texto.length > 420;
  const parrafos = c.texto.split(/\n+/).filter((p) => p.trim());

  return (
    <div
      className={`rounded-2xl border bg-surface p-4 ${
        c.modificada || c.nueva ? 'border-brand-line' : c.activa ? 'border-line' : 'border-dashed border-line opacity-90'
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {c.modificada ? <Insignia tono="marca">{t('contratos.clausulas.modificada')}</Insignia> : null}
        {c.nueva ? <Insignia tono="marca">{t('contratos.clausulas.nueva')}</Insignia> : null}
        {c.opcional ? <Insignia tono={c.opcional.nota ? 'aviso' : 'neutro'}>{t('contratos.clausulas.opcional')}</Insignia> : null}
      </div>

      <p className={`mt-1.5 text-[13.5px] font-bold leading-snug ${c.activa ? 'text-text' : 'text-text-3'}`}>
        {c.encabezado ?? `${c.titulo} · ${t('contratos.clausulas.noIncluida')}`}
      </p>

      {c.opcional ? (
        <div className="mt-2 space-y-2">
          {c.opcional.nota ? (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] leading-relaxed text-text">
              {c.opcional.nota}
            </p>
          ) : null}
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={c.activa}
              disabled={ocupado}
              onChange={(ev) => onAlternar(ev.target.checked)}
              className="h-5 w-5 shrink-0 accent-[var(--brand)]"
            />
            <span className="text-[13px] font-semibold text-text-2">{t('contratos.clausulas.incluir')}</span>
          </label>
        </div>
      ) : null}

      {editando ? (
        <div className="mt-3 space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-text-2">{t('contratos.clausulas.titulo')}</span>
            <input
              value={titulo}
              maxLength={200}
              onChange={(ev) => setTitulo(ev.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-sm text-text outline-none focus:border-brand"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-text-2">{t('contratos.clausulas.texto')}</span>
            <textarea
              value={texto}
              maxLength={12000}
              onChange={(ev) => setTexto(ev.target.value)}
              rows={Math.min(18, Math.max(6, Math.ceil(texto.length / 38)))}
              className="w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 py-3 text-[14px] leading-relaxed text-text outline-none focus:border-brand"
            />
          </label>
          {!c.nueva ? <p className="text-[11.5px] leading-relaxed text-text-3">{t('contratos.clausulas.avisoEdicion')}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button
              onClick={() => onGuardar(titulo.trim(), texto.trim())}
              disabled={ocupado || !titulo.trim() || !texto.trim()}
              className="gradient-btn min-h-[44px] rounded-xl px-5 text-sm font-bold text-grad-contrast disabled:opacity-50"
            >
              {t('contratos.clausulas.guardar')}
            </button>
            <button onClick={onCancelar} className="min-h-[44px] rounded-xl border border-line px-5 text-sm font-semibold text-text-2">
              {t('contratos.clausulas.cancelar')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={`relative mt-2 ${larga && !completa ? 'max-h-40 overflow-hidden' : ''}`}>
            {parrafos.map((p, i) => (
              <p key={i} className={`mt-1 break-words text-[13.5px] leading-relaxed ${c.activa ? 'text-text-2' : 'text-text-3'}`}>
                {p}
              </p>
            ))}
            {larga && !completa ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface" /> : null}
          </div>
          {larga ? (
            <button onClick={() => setCompleta((v) => !v)} className="mt-1 min-h-[36px] text-[12.5px] font-semibold text-accent">
              {completa ? t('contratos.clausulas.verMenos') : t('contratos.clausulas.verCompleta')}
            </button>
          ) : null}

          {c.modificada && verOriginal ? (
            <div className="mt-2 rounded-xl border border-line bg-surface-2 px-3 py-2">
              <p className="text-[12px] font-bold text-text-2">{c.tituloOriginal}</p>
              {c.textoOriginal
                .split(/\n+/)
                .filter((p) => p.trim())
                .map((p, i) => (
                  <p key={i} className="mt-1 break-words text-[12.5px] leading-relaxed text-text-3">
                    {p}
                  </p>
                ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={onEditar}
              disabled={ocupado}
              className="min-h-[40px] rounded-lg border border-line-strong px-3.5 text-xs font-semibold text-text transition hover:bg-surface-2 disabled:opacity-50"
            >
              {t('contratos.clausulas.editar')}
            </button>
            {c.modificada ? (
              <>
                <button
                  onClick={onRestaurar}
                  disabled={ocupado}
                  className="min-h-[40px] rounded-lg border border-line px-3.5 text-xs font-semibold text-text-2 transition hover:bg-surface-2 disabled:opacity-50"
                >
                  {t('contratos.clausulas.restaurar')}
                </button>
                <button onClick={() => setVerOriginal((v) => !v)} className="min-h-[40px] px-2 text-xs font-semibold text-text-3">
                  {verOriginal ? t('contratos.clausulas.ocultarOriginal') : t('contratos.clausulas.verOriginal')}
                </button>
              </>
            ) : null}
            {c.nueva ? (
              <button
                onClick={onQuitar}
                disabled={ocupado}
                className="min-h-[40px] rounded-lg border border-line px-3.5 text-xs font-semibold text-text-3 transition hover:text-danger disabled:opacity-50"
              >
                {t('contratos.clausulas.quitar')}
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function FormularioNueva({
  t,
  ocupado,
  onCancelar,
  onGuardar,
}: {
  t: (k: string) => string;
  ocupado: boolean;
  onCancelar: () => void;
  onGuardar: (titulo: string, texto: string) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  return (
    <div className="mt-1.5 space-y-2.5 rounded-2xl border border-brand-line bg-surface p-4">
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-text-2">{t('contratos.clausulas.titulo')}</span>
        <input
          value={titulo}
          maxLength={200}
          autoFocus
          onChange={(ev) => setTitulo(ev.target.value)}
          className="min-h-[44px] w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-sm uppercase text-text outline-none focus:border-brand"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-text-2">{t('contratos.clausulas.texto')}</span>
        <textarea
          value={texto}
          maxLength={12000}
          rows={6}
          onChange={(ev) => setTexto(ev.target.value)}
          className="w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 py-3 text-[14px] leading-relaxed text-text outline-none focus:border-brand"
        />
      </label>
      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <button
          onClick={() => onGuardar(titulo.trim().toUpperCase(), texto.trim())}
          disabled={ocupado || !titulo.trim() || !texto.trim()}
          className="gradient-btn min-h-[44px] rounded-xl px-5 text-sm font-bold text-grad-contrast disabled:opacity-50"
        >
          {t('contratos.clausulas.guardar')}
        </button>
        <button onClick={onCancelar} className="min-h-[44px] rounded-xl border border-line px-5 text-sm font-semibold text-text-2">
          {t('contratos.clausulas.cancelar')}
        </button>
      </div>
    </div>
  );
}
