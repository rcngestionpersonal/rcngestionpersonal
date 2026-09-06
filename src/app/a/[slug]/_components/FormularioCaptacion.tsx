'use client';

import { useState } from 'react';
import Link from 'next/link';

// Formulario de captacion (punto 2.4): la pieza que convierte el mini-sitio en
// herramienta de trabajo y no en una tarjeta de presentacion.
//
// Anti-spam sin captcha (decision explicita del pedido): honeypot invisible +
// rate limiting por IP del lado del servidor. Un captcha agrega friccion justo
// a la persona real que queremos que complete el formulario.

const TIPOS = [
  { valor: 'HOUSE', label: 'Casa' },
  { valor: 'APARTMENT', label: 'Departamento' },
  { valor: 'SUITE', label: 'Suite' },
  { valor: 'LAND', label: 'Terreno' },
  { valor: 'OFFICE', label: 'Oficina' },
  { valor: 'COMMERCIAL', label: 'Local comercial' },
  { valor: 'WAREHOUSE', label: 'Bodega' },
  { valor: 'FARM', label: 'Quinta o finca' },
  { valor: 'OTHER', label: 'Otro' },
];

const campoClase =
  'min-h-[48px] w-full rounded-xl border border-line-strong bg-surface px-3.5 text-sm text-text placeholder:text-text-3';

export default function FormularioCaptacion({ slug, nombreAgente }: { slug: string; nombreAgente: string }) {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setEnviando(true);
    setError('');

    try {
      const respuesta = await fetch(`/api/real-estate/mini-sitio/${slug}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: datos.get('nombre'),
          telefono: datos.get('telefono'),
          propertyType: datos.get('propertyType'),
          operationType: datos.get('operationType'),
          zona: datos.get('zona'),
          mensaje: datos.get('mensaje') || undefined,
          consentimiento: datos.get('consentimiento') === 'on',
          website: datos.get('website') || undefined,
        }),
      });
      const json = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        setError(json.error ?? 'No pudimos enviar tu mensaje. Intenta de nuevo.');
        return;
      }
      setEnviado(true);
    } catch {
      setError('No pudimos enviar tu mensaje. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <section className="border-t border-line px-4 py-14">
        <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-7 text-center">
          <p className="text-3xl">✓</p>
          <h2 className="mt-3 text-lg font-extrabold text-text">Listo, tu mensaje llegó</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-2">
            {nombreAgente.split(/\s+/)[0]} recibió tus datos y se pondrá en contacto contigo.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="border-t border-line px-4 py-14">
      <div className="mx-auto max-w-md">
        <h2 className="text-center text-xl font-extrabold sm:text-2xl">¿Vas a vender o arrendar tu inmueble?</h2>
        <p className="mt-2 text-center text-sm text-text-2">
          Déjame tus datos y te contacto para conversarlo.
        </p>

        <form onSubmit={enviar} className="mt-6 space-y-3">
          {/* Honeypot: oculto para personas, visible para bots que llenan todo.
              aria-hidden + tabIndex para que un lector de pantalla tampoco lo
              anuncie ni lo alcance con el teclado. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
          />

          <input name="nombre" required minLength={2} placeholder="Tu nombre" className={campoClase} />
          <input name="telefono" required minLength={6} type="tel" placeholder="Tu teléfono" className={campoClase} />

          <div className="grid grid-cols-2 gap-3">
            <select name="operationType" required defaultValue="SALE" aria-label="Qué quieres hacer" className={campoClase}>
              <option value="SALE">Quiero vender</option>
              <option value="RENT">Quiero arrendar</option>
            </select>
            <select name="propertyType" required defaultValue="HOUSE" aria-label="Tipo de inmueble" className={campoClase}>
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <input name="zona" required minLength={2} placeholder="¿En qué zona está?" className={campoClase} />
          <textarea
            name="mensaje"
            rows={3}
            maxLength={600}
            placeholder="Cuéntame brevemente (opcional)"
            className={`${campoClase} py-3`}
          />

          {/* Consentimiento LOPDP: se recogen datos de un tercero que no acepto
              los terminos de la plataforma (punto 2.4). No premarcado. */}
          <label className="flex items-start gap-2.5 rounded-xl border border-line bg-surface p-3 text-[12.5px] leading-snug text-text-2">
            <input type="checkbox" name="consentimiento" required className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Autorizo el tratamiento de mis datos para que {nombreAgente.split(/\s+/)[0]} me contacte, conforme a la{' '}
              <Link href="/legal/privacidad" target="_blank" className="font-semibold underline">
                política de privacidad
              </Link>
              .
            </span>
          </label>

          {error ? <p className="text-center text-xs text-danger">{error}</p> : null}

          <button
            type="submit"
            disabled={enviando}
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl px-6 text-sm font-bold transition-opacity disabled:opacity-60"
            style={{ background: 'var(--ms-acento)', color: 'var(--ms-contraste)' }}
          >
            {enviando ? 'Enviando…' : 'Enviar mis datos'}
          </button>
        </form>
      </div>
    </section>
  );
}
