'use client';

import { useEffect, useMemo, useState } from 'react';
import { compressImage } from '@/lib/real-estate/image-compress';
import {
  DURACIONES_VISITA,
  REACCIONES_VISITA,
  VISITA_LIMITES,
  validarConsentimientoFoto,
  type ReaccionVisita,
} from '@/lib/real-estate/reportes/tipos';
import type { InmuebleReporte, VisitaCompleta } from './tipos-cliente';
import EncabezadoSecundario from '@/components/navegacion/EncabezadoSecundario';

// Reporte de visita desde el celular (punto 3.1). Pensado para llenarse de pie,
// en el inmueble, en menos de un minuto:
//   - Solo cuatro datos son obligatorios: inmueble, fecha, visitante y reaccion.
//     El inmueble y la fecha ya vienen puestos.
//   - La duracion y la reaccion se eligen con un toque, sin teclado.
//   - Inputs de 16px en movil: con menos, iOS hace zoom al enfocar y descoloca
//     la pantalla.
//   - El boton de guardar queda fijo abajo en el celular, siempre a mano.

const ULTIMO_INMUEBLE = 'redinmo:reportes:ultimo-inmueble';

function ahoraLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function VisitaFormulario({
  inmuebles,
  inmuebleInicial,
  t,
  onCancelar,
  onGuardada,
}: {
  inmuebles: InmuebleReporte[];
  inmuebleInicial?: string | null;
  t: (k: string) => string;
  onCancelar: () => void;
  onGuardada: (visita: VisitaCompleta) => void;
}) {
  const activos = useMemo(() => inmuebles.filter((i) => i.status === 'ACTIVE' || i.status === 'RESERVED'), [inmuebles]);
  const opciones = activos.length > 0 ? activos : inmuebles;

  const [listingId, setListingId] = useState(inmuebleInicial ?? '');
  const [visitadaAt, setVisitadaAt] = useState(ahoraLocal);
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [acompanantes, setAcompanantes] = useState('');
  const [duracion, setDuracion] = useState<number | null>(null);
  const [reaccion, setReaccion] = useState<ReaccionVisita | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [objeciones, setObjeciones] = useState('');
  const [proximoPaso, setProximoPaso] = useState('');
  const [foto, setFoto] = useState<Blob | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const [respaldo, setRespaldo] = useState(false);
  const [redes, setRedes] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // El inmueble de la ultima visita queda preseleccionado: un agente muestra el
  // mismo inmueble varias veces en la semana.
  useEffect(() => {
    if (listingId) return;
    let ultimo: string | null = null;
    try {
      ultimo = window.localStorage.getItem(ULTIMO_INMUEBLE);
    } catch {
      ultimo = null;
    }
    const valido = opciones.find((i) => i.id === ultimo) ?? opciones[0];
    if (valido) setListingId(valido.id);
  }, [listingId, opciones]);

  useEffect(() => () => {
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
  }, [fotoUrl]);

  async function elegirFoto(archivo: File | undefined) {
    if (!archivo) return;
    setProcesandoFoto(true);
    setError('');
    try {
      // Se comprime en el celular: una foto de camara pesa 5-8MB y el limite
      // de la funcion es 4.5MB. Sale en ~200KB.
      const comprimida = await compressImage(archivo, 1280, 0.8);
      if (fotoUrl) URL.revokeObjectURL(fotoUrl);
      setFoto(comprimida);
      setFotoUrl(URL.createObjectURL(comprimida));
    } catch {
      setError(t('reportes.visita.errorFoto'));
    } finally {
      setProcesandoFoto(false);
    }
  }

  function quitarFoto() {
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    setFoto(null);
    setFotoUrl(null);
    setRespaldo(false);
    setRedes(false);
  }

  const cedulaLimpia = cedula.replace(/\D/g, '');
  const cedulaValida = !cedulaLimpia || cedulaLimpia.length === 10 || cedulaLimpia.length === 13;
  const consentimiento = validarConsentimientoFoto(Boolean(foto), { respaldo, redes });
  const listo = Boolean(listingId) && nombre.trim().length >= 2 && Boolean(reaccion) && cedulaValida && consentimiento.ok && !procesandoFoto;

  async function guardar() {
    if (!listo || !reaccion) return;
    setGuardando(true);
    setError('');
    try {
      const datos = {
        listingId,
        visitadaAt: new Date(visitadaAt).toISOString(),
        duracionMinutos: duracion,
        visitanteNombre: nombre.trim(),
        visitanteCedula: cedulaLimpia || null,
        acompanantes: acompanantes.trim() || null,
        reaccion,
        observaciones: observaciones.trim() || null,
        objeciones: objeciones.trim() || null,
        proximoPaso: proximoPaso.trim() || null,
        consentimientoRespaldo: Boolean(foto) && respaldo,
        consentimientoRedes: Boolean(foto) && respaldo && redes,
      };
      const form = new FormData();
      form.set('datos', JSON.stringify(datos));
      if (foto && respaldo) form.set('foto', new File([foto], 'visita.jpg', { type: 'image/jpeg' }));

      const r = await fetch('/api/real-estate/reportes/visitas', { method: 'POST', body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const primerDetalle = d.details ? (Object.values(d.details).flat()[0] as string | undefined) : undefined;
        setError(primerDetalle ?? d.error ?? t('reportes.visita.errorGuardar'));
        return;
      }
      try {
        window.localStorage.setItem(ULTIMO_INMUEBLE, listingId);
      } catch {
        // Modo privado: no pasa nada, la proxima vez se elige a mano.
      }
      onGuardada(d.visita as VisitaCompleta);
    } catch {
      setError(t('reportes.visita.errorGuardar'));
    } finally {
      setGuardando(false);
    }
  }

  const campo =
    'min-h-[48px] w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-base text-text outline-none transition focus:border-brand sm:text-sm';
  const etiqueta = 'mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-text-2';

  if (opciones.length === 0) {
    return (
      <div className="space-y-3 rounded-2xl border border-dashed border-line p-6 text-center">
        <p className="text-sm text-text-2">{t('reportes.sinInmuebles')}</p>
        <button onClick={onCancelar} className="min-h-[44px] rounded-xl border border-line-strong px-4 text-sm font-semibold text-text">
          {t('reportes.volver')}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl pb-[calc(7rem+env(safe-area-inset-bottom))] sm:pb-0">
      {/* Hijo directo del contenedor del formulario: así queda fijo mientras se baja. */}
      <EncabezadoSecundario enPanel onVolver={onCancelar} titulo={t('reportes.visita.nuevo')} etiquetaVolver={t('reportes.volver')} />

      <div className="mt-4 space-y-5">
        <div>
          <label className={etiqueta} htmlFor="visita-inmueble">
            {t('reportes.visita.inmueble')}
          </label>
          <select id="visita-inmueble" value={listingId} onChange={(e) => setListingId(e.target.value)} className={campo}>
            {opciones.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={etiqueta} htmlFor="visita-fecha">
            {t('reportes.visita.fecha')}
          </label>
          <input id="visita-fecha" type="datetime-local" value={visitadaAt} max={ahoraLocal()} onChange={(e) => setVisitadaAt(e.target.value)} className={campo} />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <div>
            <label className={etiqueta} htmlFor="visita-nombre">
              {t('reportes.visita.visitante')}
            </label>
            <input
              id="visita-nombre"
              value={nombre}
              maxLength={VISITA_LIMITES.nombre}
              autoComplete="off"
              autoCapitalize="words"
              onChange={(e) => setNombre(e.target.value)}
              className={campo}
            />
          </div>
          <div>
            <label className={etiqueta} htmlFor="visita-cedula">
              {t('reportes.visita.cedula')}
            </label>
            <input
              id="visita-cedula"
              value={cedula}
              inputMode="numeric"
              maxLength={VISITA_LIMITES.cedula}
              autoComplete="off"
              onChange={(e) => setCedula(e.target.value)}
              aria-invalid={!cedulaValida}
              className={`${campo} ${cedulaValida ? '' : 'border-danger'}`}
            />
          </div>
        </div>
        {!cedulaValida ? <p className="-mt-3 text-xs text-danger">{t('reportes.visita.cedulaInvalida')}</p> : null}

        <div>
          <label className={etiqueta} htmlFor="visita-acompanantes">
            {t('reportes.visita.acompanantes')}
          </label>
          <input
            id="visita-acompanantes"
            value={acompanantes}
            maxLength={VISITA_LIMITES.acompanantes}
            placeholder={t('reportes.visita.acompanantesPlaceholder')}
            onChange={(e) => setAcompanantes(e.target.value)}
            className={campo}
          />
        </div>

        <fieldset>
          <legend className={etiqueta}>{t('reportes.visita.duracion')}</legend>
          <div className="flex flex-wrap gap-2">
            {DURACIONES_VISITA.map((min) => (
              <button
                key={min}
                type="button"
                onClick={() => setDuracion(duracion === min ? null : min)}
                aria-pressed={duracion === min}
                className={`min-h-[44px] min-w-[64px] rounded-xl border px-3 text-sm font-semibold transition ${
                  duracion === min ? 'border-brand-line bg-brand-dim text-brand' : 'border-line-strong text-text-2 hover:bg-surface-2'
                }`}
              >
                {min} min
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={etiqueta}>{t('reportes.visita.reaccion')}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {REACCIONES_VISITA.map((clave) => (
              <button
                key={clave}
                type="button"
                onClick={() => setReaccion(clave)}
                aria-pressed={reaccion === clave}
                className={`min-h-[52px] rounded-xl border px-3 text-sm font-bold transition ${
                  reaccion === clave
                    ? clave === 'MUY_INTERESADO'
                      ? 'border-accent-line bg-accent-dim text-accent'
                      : clave === 'NO_INTERESADO'
                        ? 'border-line-strong bg-surface-2 text-text'
                        : 'border-brand-line bg-brand-dim text-brand'
                    : 'border-line-strong text-text-2 hover:bg-surface-2'
                }`}
              >
                {t(`reportes.reaccion.${clave}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <TextoLargo id="visita-observaciones" etiqueta={t('reportes.visita.observaciones')} valor={observaciones} max={VISITA_LIMITES.observaciones} onCambio={setObservaciones} clase={etiqueta} />
        <TextoLargo id="visita-objeciones" etiqueta={t('reportes.visita.objeciones')} valor={objeciones} max={VISITA_LIMITES.objeciones} onCambio={setObjeciones} clase={etiqueta} />
        <TextoLargo id="visita-proximo" etiqueta={t('reportes.visita.proximoPaso')} valor={proximoPaso} max={VISITA_LIMITES.proximoPaso} onCambio={setProximoPaso} clase={etiqueta} filas={2} />

        {/* ---- Foto con doble consentimiento (punto 3.3) ---- */}
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-bold text-text">{t('reportes.visita.foto')}</p>
          <p className="mt-1 text-xs leading-relaxed text-text-2">{t('reportes.visita.fotoDetalle')}</p>

          {!foto ? (
            <label className="mt-3 flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl border border-dashed border-line-strong text-sm font-semibold text-text-2 hover:bg-surface-2">
              {procesandoFoto ? t('reportes.visita.procesandoFoto') : t('reportes.visita.tomarFoto')}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  void elegirFoto(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {fotoUrl ? <img src={fotoUrl} alt="" className="h-24 w-20 shrink-0 rounded-lg object-cover" /> : null}
                <button type="button" onClick={quitarFoto} className="min-h-[40px] rounded-lg border border-line px-3 text-xs font-semibold text-text-2 hover:text-danger">
                  {t('reportes.visita.quitarFoto')}
                </button>
              </div>

              <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs leading-relaxed text-text-2">{t('reportes.visita.consentimientoInstruccion')}</p>

              <label className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border border-line-strong p-3">
                <input
                  type="checkbox"
                  checked={respaldo}
                  onChange={(e) => {
                    setRespaldo(e.target.checked);
                    if (!e.target.checked) setRedes(false);
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
                />
                <span className="text-sm text-text">{t('reportes.visita.consentimientoRespaldo')}</span>
              </label>

              {/* El segundo consentimiento es independiente, pero no existe sin
                  el primero: sin respaldo la foto ni se guarda. */}
              <label className={`flex min-h-[48px] items-start gap-3 rounded-xl border border-line-strong p-3 ${respaldo ? 'cursor-pointer' : 'opacity-50'}`}>
                <input
                  type="checkbox"
                  checked={redes}
                  disabled={!respaldo}
                  onChange={(e) => setRedes(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
                />
                <span className="text-sm text-text">
                  {t('reportes.visita.consentimientoRedes')}
                  <span className="mt-0.5 block text-xs text-text-3">{t('reportes.visita.consentimientoRedesDetalle')}</span>
                </span>
              </label>

              {!respaldo ? <p className="text-xs text-danger">{t('reportes.visita.sinConsentimiento')}</p> : null}
            </div>
          )}
        </div>

        {error ? <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p> : null}
      </div>

      {/* Fijo abajo en el celular, en linea en escritorio. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0">
        <button
          onClick={() => void guardar()}
          disabled={!listo || guardando}
          className="gradient-btn min-h-[52px] w-full rounded-xl text-base font-bold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-50"
        >
          {guardando ? t('reportes.guardando') : t('reportes.visita.guardar')}
        </button>
      </div>
    </div>
  );
}

function TextoLargo({
  id,
  etiqueta,
  valor,
  max,
  onCambio,
  clase,
  filas = 3,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  max: number;
  onCambio: (v: string) => void;
  clase: string;
  filas?: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className={clase} htmlFor={id}>
          {etiqueta}
        </label>
        <span className="text-[11px] text-text-3">
          {valor.length}/{max}
        </span>
      </div>
      <textarea
        id={id}
        rows={filas}
        value={valor}
        maxLength={max}
        onChange={(e) => onCambio(e.target.value)}
        className="w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 py-3 text-base leading-relaxed text-text outline-none transition focus:border-brand sm:text-sm"
      />
    </div>
  );
}
