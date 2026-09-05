'use client';

import { useState } from 'react';

const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
const WHATSAPP_MESSAGE = 'Hola, necesito recuperar el acceso a mi cuenta de Redinmo.io. Mi teléfono registrado es: ';

export default function ForgotAccessForm() {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit() {
    if (!identifier.trim() || loading) return;
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
    } catch {
      // La respuesta siempre es neutra: incluso si la peticion falla en red,
      // no hay nada distinto que mostrarle al usuario.
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <div>
        <p className="text-[13.5px] leading-relaxed text-text-2">
          Si el dato corresponde a una cuenta de Redinmo.io, te enviamos un enlace para restablecer tu contraseña. Revisa tu correo (y la carpeta de spam).
        </p>
        <WhatsappFallback />
        <a href="/login" className="mt-5 inline-block text-xs font-semibold text-text-3 hover:text-text-2">
          ← Volver al login
        </a>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="identifier" className="mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.06em] text-text-3">
        Correo o teléfono
      </label>
      <input
        id="identifier"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        placeholder="tucorreo@ejemplo.com o +593 9XXXXXXXX"
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
        className="h-11 w-full rounded-lg border border-line-strong bg-input-bg px-3.5 text-[13.5px] font-medium text-text outline-none transition placeholder:font-normal placeholder:text-text-3 focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-dim)]"
      />

      <button
        onClick={() => void submit()}
        disabled={loading || !identifier.trim()}
        className="gradient-btn mt-[18px] h-[47px] w-full rounded-lg text-sm font-bold text-grad-contrast transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Enviando...' : 'Enviarme el enlace'}
      </button>

      <WhatsappFallback />

      <a href="/login" className="mt-5 inline-block text-xs font-semibold text-text-3 hover:text-text-2">
        ← Volver al login
      </a>
    </div>
  );
}

function WhatsappFallback() {
  if (!SUPPORT_WHATSAPP) return null;
  const url = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
  return (
    <p className="mt-4 text-xs leading-relaxed text-text-3">
      ¿No tienes un correo asociado o no recuerdas cuál usaste?{' '}
      <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline">
        Escríbenos por WhatsApp
      </a>
      .
    </p>
  );
}
