'use client';

import { useRef, useState } from 'react';
import { CARTA_DESTINATARIOS, type CartaDestinatarioTipo, type CartaImagenTipo, type CartaPaleta } from '@/lib/real-estate/cartas/tipos';
import { cropImageToSquare } from '@/lib/real-estate/image-compress';
import type { CartaCompleta, DatosPantallaCartas } from './tipos-cliente';

// Pasos 1 a 4 del flujo (destinatario, sus datos, imagen del encabezado y
// generacion). Mobile-first: un paso por pantalla, con el avance abajo, para
// que se pueda completar con una mano desde el celular.

const campoClase =
  'min-h-[44px] w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-brand';

type Paso = 1 | 2 | 3;

export default function NuevaCartaAsistente({
  datos,
  t,
  onCreada,
  onCancelar,
}: {
  datos: DatosPantallaCartas;
  t: (k: string) => string;
  onCreada: (carta: CartaCompleta, usoPlantilla: boolean) => void;
  onCancelar: () => void;
}) {
  const [paso, setPaso] = useState<Paso>(1);
  const [tipo, setTipo] = useState<CartaDestinatarioTipo | null>(null);
  const [nombre, setNombre] = useState('');
  const [cargo, setCargo] = useState('');
  const [contexto, setContexto] = useState('');
  const [imagenTipo, setImagenTipo] = useState<CartaImagenTipo>(datos.agente.imagenTipoPreferida);
  const [paleta, setPaleta] = useState<CartaPaleta>('clara');
  const [logoUrl, setLogoUrl] = useState<string | null>(datos.agente.logoUrl);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');
  const logoInput = useRef<HTMLInputElement | null>(null);

  const sinCuota = datos.cuota.restantes <= 0;

  async function subirLogo(archivo: File) {
    setSubiendoLogo(true);
    setError('');
    try {
      // Mismo recorte cuadrado que la foto de perfil: el encabezado reserva un
      // cuadrado y un logo apaisado sin recortar se deformaria.
      const recortado = await cropImageToSquare(archivo);
      setLogoPreview(URL.createObjectURL(recortado));
      const cuerpo = new FormData();
      cuerpo.append('logo', new File([recortado], 'logo.jpg', { type: recortado.type || 'image/jpeg' }));
      const r = await fetch('/api/real-estate/agents/me/logo', { method: 'POST', body: cuerpo });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? t('cartas.error.logo'));
        return;
      }
      setLogoUrl(d.url);
      setImagenTipo('logo');
    } catch {
      setError(t('cartas.error.logo'));
    } finally {
      setSubiendoLogo(false);
    }
  }

  async function generar() {
    if (!tipo) return;
    setGenerando(true);
    setError('');
    try {
      const r = await fetch('/api/real-estate/cartas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinatarioTipo: tipo,
          destinatarioNombre: nombre.trim(),
          destinatarioCargo: cargo.trim() || null,
          contexto: contexto.trim() || null,
          imagenTipo,
          paleta,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? t('cartas.error.generar'));
        return;
      }
      onCreada(d.carta as CartaCompleta, Boolean(d.usoPlantilla));
    } catch {
      setError(t('cartas.error.generar'));
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="space-y-5">
      <ol className="flex items-center gap-2" aria-label={t('cartas.pasos.aria')}>
        {([1, 2, 3] as const).map((n) => (
          <li key={n} className="flex flex-1 items-center gap-2">
            <span
              aria-current={paso === n ? 'step' : undefined}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                paso >= n ? 'gradient-btn text-grad-contrast' : 'border border-line bg-surface-2 text-text-3'
              }`}
            >
              {n}
            </span>
            {n < 3 ? <span className={`h-px flex-1 ${paso > n ? 'bg-brand' : 'bg-line'}`} /> : null}
          </li>
        ))}
      </ol>

      {/* ---- PASO 1: tipo de destinatario ---- */}
      {paso === 1 ? (
        <section>
          <h3 className="text-base font-bold text-text">{t('cartas.paso1.titulo')}</h3>
          <p className="mt-1 text-sm text-text-2">{t('cartas.paso1.bajada')}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {CARTA_DESTINATARIOS.map((clave) => {
              const activo = tipo === clave;
              return (
                <button
                  key={clave}
                  onClick={() => setTipo(clave)}
                  aria-pressed={activo}
                  className={`min-h-[44px] rounded-2xl border p-4 text-left transition ${
                    activo ? 'border-brand-line bg-brand-dim' : 'border-line bg-surface hover:border-line-strong'
                  }`}
                >
                  <p className={`text-sm font-bold ${activo ? 'text-brand' : 'text-text'}`}>
                    {t(`cartas.destinatario.${clave}`)}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-text-2">{t(`cartas.destinatario.${clave}.desc`)}</p>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ---- PASO 2: datos del destinatario ---- */}
      {paso === 2 ? (
        <section className="space-y-3">
          <h3 className="text-base font-bold text-text">{t('cartas.paso2.titulo')}</h3>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
              {t('cartas.campo.nombre')}
            </span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campoClase} maxLength={120} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
              {t('cartas.campo.cargo')}
            </span>
            <input value={cargo} onChange={(e) => setCargo(e.target.value)} className={campoClase} maxLength={120} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-2">
              {t('cartas.campo.contexto')}
            </span>
            <input
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
              placeholder={t('cartas.campo.contextoPlaceholder')}
              className={campoClase}
              maxLength={240}
            />
          </label>
          <p className="rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-xs leading-relaxed text-text-2">
            {t('cartas.privacidadDestinatario')}
          </p>
        </section>
      ) : null}

      {/* ---- PASO 3: imagen del encabezado y paleta ---- */}
      {paso === 3 ? (
        <section className="space-y-4">
          <h3 className="text-base font-bold text-text">{t('cartas.paso3.titulo')}</h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setImagenTipo('foto')}
              aria-pressed={imagenTipo === 'foto'}
              disabled={!datos.agente.photoUrl}
              className={`flex min-h-[44px] items-center gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-50 ${
                imagenTipo === 'foto' ? 'border-brand-line bg-brand-dim' : 'border-line bg-surface'
              }`}
            >
              {datos.agente.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={datos.agente.photoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-3">—</span>
              )}
              <span>
                <span className="block text-sm font-bold text-text">{t('cartas.imagen.foto')}</span>
                <span className="mt-0.5 block text-xs text-text-2">
                  {datos.agente.photoUrl ? t('cartas.imagen.fotoOk') : t('cartas.imagen.fotoFalta')}
                </span>
              </span>
            </button>

            <button
              onClick={() => (logoUrl ? setImagenTipo('logo') : logoInput.current?.click())}
              aria-pressed={imagenTipo === 'logo'}
              className={`flex min-h-[44px] items-center gap-3 rounded-2xl border p-3 text-left transition ${
                imagenTipo === 'logo' ? 'border-brand-line bg-brand-dim' : 'border-line bg-surface'
              }`}
            >
              {logoPreview ?? logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={(logoPreview ?? logoUrl) as string} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-3">+</span>
              )}
              <span>
                <span className="block text-sm font-bold text-text">{t('cartas.imagen.logo')}</span>
                <span className="mt-0.5 block text-xs text-text-2">
                  {subiendoLogo ? t('cartas.imagen.subiendo') : logoUrl ? t('cartas.imagen.logoCambiar') : t('cartas.imagen.logoSubir')}
                </span>
              </span>
            </button>
          </div>

          <input
            ref={logoInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) void subirLogo(archivo);
              e.target.value = '';
            }}
          />

          {logoUrl ? (
            <button
              onClick={() => logoInput.current?.click()}
              className="min-h-[44px] text-xs font-semibold text-brand underline-offset-2 hover:underline"
            >
              {t('cartas.imagen.logoCambiar')}
            </button>
          ) : null}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('cartas.paleta')}</p>
            <div className="flex gap-2">
              {(['clara', 'oscura'] as const).map((clave) => (
                <button
                  key={clave}
                  onClick={() => setPaleta(clave)}
                  aria-pressed={paleta === clave}
                  className={`min-h-[44px] rounded-xl border px-4 text-sm font-semibold transition ${
                    paleta === clave ? 'border-brand-line bg-brand-dim text-brand' : 'border-line text-text-2 hover:bg-surface-2'
                  }`}
                >
                  {t(`cartas.paleta.${clave}`)}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {error ? <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        {paso < 3 ? (
          <button
            onClick={() => setPaso((p) => (p + 1) as Paso)}
            disabled={(paso === 1 && !tipo) || (paso === 2 && nombre.trim().length < 2)}
            className="gradient-btn min-h-[44px] rounded-xl px-6 text-sm font-bold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[180px]"
          >
            {t('cartas.continuar')}
          </button>
        ) : (
          <button
            onClick={() => void generar()}
            disabled={generando || sinCuota}
            className="gradient-btn min-h-[44px] rounded-xl px-6 text-sm font-bold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[180px]"
          >
            {generando ? t('cartas.generando') : sinCuota ? t('cartas.cuotaAgotada') : t('cartas.generar')}
          </button>
        )}
        <button
          onClick={() => (paso === 1 ? onCancelar() : setPaso((p) => (p - 1) as Paso))}
          className="min-h-[44px] rounded-xl border border-line px-6 text-sm font-semibold text-text-2 transition hover:bg-surface-2"
        >
          {paso === 1 ? t('common.cancelar') : t('cartas.volver')}
        </button>
      </div>
    </div>
  );
}
