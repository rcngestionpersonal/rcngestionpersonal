'use client';

import { useState } from 'react';
import {
  AVISO_MODULO_CASILLA,
  AVISO_MODULO_PARRAFOS,
  AVISO_MODULO_TITULO,
  AVISO_MODULO_VIGENCIA_DIAS,
  ENLACE_REVISION_ABOGADO,
  ENLACE_REVISION_ABOGADO_ETIQUETA,
} from '@/lib/real-estate/contratos/tipos';

// Aviso de entrada al módulo (punto 4.2.a). La primera vez y cada 90 días.
//
// Es una PUERTA, no un banner: mientras no se acepte no se ve la lista ni el
// botón de generar. Y no se puede cerrar por fuera —sin botón de cancelar, sin
// clic en el fondo, sin tecla de escape—, porque un aviso que se esquiva con
// un clic distraído no deja constancia de nada.
//
// El texto no vive acá: viene de las constantes del módulo, que el agente no
// puede editar desde ningún punto de la aplicación (punto 4.3).
export default function AvisoModelosReferenciales({
  onAceptado,
  reaparicion,
}: {
  onAceptado: () => void;
  // true cuando el agente ya lo aceptó antes y vuelve a tocarle por los 90
  // días: conviene decirle por qué lo está viendo otra vez.
  reaparicion: boolean;
}) {
  const [marcado, setMarcado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function aceptar() {
    setEnviando(true);
    setError('');
    try {
      const r = await fetch('/api/real-estate/contratos/aviso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acepta: true }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error ?? 'No se pudo registrar tu aceptación. Intenta de nuevo.');
        return;
      }
      onAceptado();
    } catch {
      setError('No se pudo registrar tu aceptación. Revisa tu conexión.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-line bg-surface p-5 sm:p-6"
      role="region"
      aria-labelledby="aviso-modelos-titulo"
    >
      <h3 id="aviso-modelos-titulo" className="text-base font-bold text-text sm:text-lg">
        {AVISO_MODULO_TITULO}
      </h3>

      {reaparicion ? (
        <p className="mt-2 text-[13px] leading-relaxed text-text-3">
          Te lo mostramos de nuevo porque han pasado más de {AVISO_MODULO_VIGENCIA_DIAS} días desde la última vez.
        </p>
      ) : null}

      <div className="mt-3 space-y-3">
        {AVISO_MODULO_PARRAFOS.map((parrafo) => (
          <p key={parrafo} className="text-[14px] leading-relaxed text-text-2">
            {parrafo}
          </p>
        ))}
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-2 p-4">
        <input
          type="checkbox"
          checked={marcado}
          onChange={(e) => setMarcado(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
        />
        <span className="text-[14px] font-semibold leading-relaxed text-text">{AVISO_MODULO_CASILLA}</span>
      </label>

      {error ? (
        <p className="mt-3 rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p>
      ) : null}

      <button
        onClick={() => void aceptar()}
        disabled={!marcado || enviando}
        className="gradient-btn mt-4 min-h-[48px] w-full rounded-xl px-6 text-sm font-bold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:min-w-[240px]"
      >
        {enviando ? 'Registrando…' : 'Entendido, continuar'}
      </button>

      <p className="mt-4 text-[13px] leading-relaxed text-text-3">
        <a href={ENLACE_REVISION_ABOGADO} className="font-semibold text-accent hover:underline">
          {ENLACE_REVISION_ABOGADO_ETIQUETA}
        </a>
      </p>
    </section>
  );
}
