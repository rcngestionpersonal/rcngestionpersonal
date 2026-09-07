'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { MINI_SITIO_COLORES, MINI_SITIO_FRASE_MAX, type MiniSitioColor } from '@/lib/real-estate/mini-sitio';

// Panel del mini-sitio: personalizacion (seccion 3), compartir (seccion 4) y
// estadisticas (seccion 6). Se monta desde la pestaña "Mi Sitio" del panel
// (MiSitioTab), que es la que pone el titulo del modulo y el bloqueo por plan.

type Ajustes = {
  slug: string;
  activo: boolean;
  colorAcento: string;
  mostrarInventario: boolean;
  mostrarFormulario: boolean;
  frasePresentacion: string | null;
};

type Metricas = {
  totalVisitas: number;
  serieDiaria: Array<{ dia: string; total: number }>;
  inmuebleMasVisto: { titulo: string; visitas: number } | null;
  pedidosRecibidos: number;
};

function Interruptor({ label, hint, valor, onChange, disabled }: { label: string; hint?: string; valor: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-semibold text-text">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-text-3">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={valor}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]"
      />
    </label>
  );
}

export default function MiniSitioPanel({ appUrl }: { appUrl?: string }) {
  // Sin prop se usa el origen del navegador: en local da localhost y en
  // produccion el dominio real, sin depender de una env var del cliente.
  const base = appUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'https://redinmo.io');
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [tieneFoto, setTieneFoto] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [sinAcceso, setSinAcceso] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [frase, setFrase] = useState('');
  const fraseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const url = ajustes ? `${base.replace(/\/$/, '')}/a/${ajustes.slug}` : '';

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/real-estate/mini-sitio/me', { cache: 'no-store' });
        if (r.status === 403) { setSinAcceso(true); return; }
        if (!r.ok) { setError('No se pudo cargar tu mini-sitio.'); return; }
        const d = await r.json();
        setAjustes(d.miniSitio);
        setMetricas(d.metricas);
        setTieneFoto(d.agente?.tieneFoto ?? true);
        setFrase(d.miniSitio?.frasePresentacion ?? '');
      } catch {
        setError('No se pudo cargar tu mini-sitio.');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 512, margin: 2 }).then(setQr).catch(() => setQr(null));
  }, [url]);

  const guardar = useCallback(async (cambios: Partial<Ajustes>) => {
    setGuardando(true);
    setError('');
    try {
      const r = await fetch('/api/real-estate/mini-sitio/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? 'No se pudo guardar.'); return; }
      setAjustes(d.miniSitio);
    } catch {
      setError('No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }, []);

  if (cargando) return <p className="text-sm text-text-2">Cargando tu mini-sitio…</p>;

  if (sinAcceso) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="text-base font-bold text-text">Mini-sitio profesional</h3>
        <p className="mt-2 text-sm leading-relaxed text-text-2">
          Tu página pública con tu inventario y tu carnet verificado es una función del plan Pro.
        </p>
        <a href="/agentes/suscripcion/planes" className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-accent px-5 text-sm font-bold text-accent-contrast">
          Ver planes
        </a>
      </div>
    );
  }

  const activo = ajustes?.activo ?? false;
  const maxSerie = Math.max(1, ...(metricas?.serieDiaria ?? []).map((d) => d.total));

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-text">{activo ? 'Tu sitio está publicado' : 'Tu sitio está apagado'}</h3>
            <p className="mt-0.5 text-xs text-text-2">
              {activo ? 'Cualquiera con el enlace puede verlo.' : 'Nadie puede verlo hasta que lo actives.'}
            </p>
          </div>
          <button
            onClick={() => void guardar({ activo: !activo })}
            disabled={guardando}
            className={`min-h-[44px] rounded-xl px-5 text-sm font-bold transition disabled:opacity-60 ${
              activo ? 'border border-line-strong text-text-2 hover:bg-surface-2' : 'bg-accent text-accent-contrast'
            }`}
          >
            {activo ? 'Desactivar' : 'Activar mi sitio'}
          </button>
        </div>

        {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}

        {/* Aviso de foto (punto 7.4): es lo primero que ve quien visita. */}
        {activo && !tieneFoto ? (
          <p className="mt-3 rounded-xl border border-accent-line bg-accent-dim px-3.5 py-2.5 text-xs text-accent">
            Sube tu foto: es lo primero que ve quien visita tu sitio.
          </p>
        ) : null}

        {ajustes ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2 p-3">
              <span className="min-w-0 flex-1 truncate text-xs text-text-2">{url}</span>
              <button
                onClick={() => { void navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 1800); }}
                className="min-h-[40px] rounded-lg border border-line-strong px-3 text-xs font-semibold text-text-2 hover:bg-surface"
              >
                {copiado ? 'Copiado ✓' : 'Copiar'}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Mira mi perfil profesional en Redinmo.io: ${url}`)}`}
                target="_blank"
                rel="noreferrer"
                className="min-h-[40px] rounded-lg border border-line-strong px-3 text-xs font-semibold leading-[2.4] text-text-2 hover:bg-surface"
              >
                WhatsApp
              </a>
              <a
                href={`/a/${ajustes.slug}`}
                target="_blank"
                rel="noreferrer"
                className="min-h-[40px] rounded-lg border border-line-strong px-3 text-xs font-semibold leading-[2.4] text-text-2 hover:bg-surface"
              >
                Vista previa
              </a>
            </div>

            {qr ? (
              <div className="mt-3 flex items-center gap-4 rounded-xl border border-line bg-surface-2 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="Código QR de mi sitio" className="h-20 w-20 rounded-lg bg-white p-1" />
                <div className="min-w-0">
                  <p className="text-xs text-text-2">Para tarjetas impresas y vitrinas.</p>
                  <a
                    href={qr}
                    download={`redinmo-${ajustes.slug}-qr.png`}
                    className="mt-1.5 inline-block text-xs font-semibold text-accent hover:underline"
                  >
                    Descargar QR
                  </a>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {ajustes ? (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h4 className="text-sm font-bold text-text">Personalización</h4>

          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Color de acento</p>
          <div className="mt-2 flex flex-wrap gap-2.5">
            {(Object.keys(MINI_SITIO_COLORES) as MiniSitioColor[]).map((clave) => (
              <button
                key={clave}
                onClick={() => void guardar({ colorAcento: clave })}
                aria-label={MINI_SITIO_COLORES[clave].label}
                className={`h-11 w-11 rounded-full border-2 transition ${ajustes.colorAcento === clave ? 'border-text scale-110' : 'border-transparent'}`}
                style={{ background: MINI_SITIO_COLORES[clave].acento }}
              />
            ))}
          </div>

          <div className="mt-4 divide-y divide-line border-y border-line">
            <Interruptor
              label="Mostrar mi inventario"
              hint="Si no tienes inmuebles activos, la sección se oculta sola."
              valor={ajustes.mostrarInventario}
              onChange={(v) => void guardar({ mostrarInventario: v })}
              disabled={guardando}
            />
            <Interruptor
              label="Mostrar formulario de contacto"
              hint="Quien visite tu sitio puede dejarte sus datos; llegan a tus pedidos."
              valor={ajustes.mostrarFormulario}
              onChange={(v) => void guardar({ mostrarFormulario: v })}
              disabled={guardando}
            />
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Frase de presentación</span>
            <textarea
              value={frase}
              maxLength={MINI_SITIO_FRASE_MAX}
              rows={2}
              onChange={(e) => {
                setFrase(e.target.value);
                if (fraseTimer.current) clearTimeout(fraseTimer.current);
                // Se guarda sola al dejar de escribir: un boton "guardar" mas
                // en una pantalla que ya guarda todo al toque seria inconsistente.
                fraseTimer.current = setTimeout(() => void guardar({ frasePresentacion: e.target.value.trim() || null }), 900);
              }}
              placeholder="Ej.: Acompaño a familias a encontrar su próximo hogar en el norte de Quito."
              className="mt-1.5 w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 py-3 text-sm text-text placeholder:text-text-3"
            />
            <span className="mt-1 block text-right text-[11px] text-text-3">{frase.length}/{MINI_SITIO_FRASE_MAX}</span>
          </label>
        </div>
      ) : null}

      {ajustes && metricas ? (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h4 className="text-sm font-bold text-text">Últimos 30 días</h4>

          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <p className="text-2xl font-extrabold text-accent">{metricas.totalVisitas}</p>
              <p className="text-xs text-text-2">visitas</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-accent">{metricas.pedidosRecibidos}</p>
              <p className="text-xs text-text-2">pedidos recibidos</p>
            </div>
          </div>

          {metricas.inmuebleMasVisto ? (
            <p className="mt-3 text-xs text-text-2">
              Más visto: <span className="font-semibold text-text">{metricas.inmuebleMasVisto.titulo}</span>{' '}
              ({metricas.inmuebleMasVisto.visitas} visitas)
            </p>
          ) : null}

          {/* Grafico simple, sin libreria: una barra por dia. */}
          {metricas.serieDiaria.length > 0 ? (
            <div className="mt-4 flex h-24 items-end gap-[2px]" role="img" aria-label={`Visitas por día: ${metricas.totalVisitas} en total`}>
              {metricas.serieDiaria.map((d) => (
                <div
                  key={d.dia}
                  title={`${d.dia}: ${d.total}`}
                  className="flex-1 rounded-t-sm bg-accent"
                  style={{ height: `${Math.max(2, (d.total / maxSerie) * 100)}%`, opacity: d.total === 0 ? 0.18 : 1 }}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
