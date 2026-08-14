'use client';

import { useState } from 'react';

const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
const WHATSAPP_MESSAGE = 'Hola, necesito recuperar el acceso a mi cuenta de Redinmo. Mi teléfono registrado es: ';

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
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#a09bbb' }}>
          Si el dato corresponde a una cuenta de Redinmo, te enviamos un enlace para restablecer tu contraseña. Revisa tu correo (y la carpeta de spam).
        </p>
        <WhatsappFallback />
        <a href="/login" style={{ display: 'inline-block', marginTop: 20, fontSize: 12.5, fontWeight: 600, color: '#6e6a8a' }}>
          ← Volver al login
        </a>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="identifier" style={{ display: 'block', fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6e6a8a', marginBottom: 6 }}>
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
        style={{
          width: '100%',
          height: 44,
          background: '#100d1c',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 9,
          color: 'var(--text)',
          fontSize: 13.5,
          padding: '0 14px',
        }}
      />

      <button
        onClick={() => void submit()}
        disabled={loading || !identifier.trim()}
        style={{
          marginTop: 18,
          width: '100%',
          height: 47,
          borderRadius: 9,
          background: '#2dd4bf',
          color: '#04201c',
          fontWeight: 700,
          fontSize: 14,
          opacity: loading || !identifier.trim() ? 0.7 : 1,
          cursor: loading || !identifier.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Enviando...' : 'Enviarme el enlace'}
      </button>

      <WhatsappFallback />

      <a href="/login" style={{ display: 'inline-block', marginTop: 20, fontSize: 12.5, fontWeight: 600, color: '#6e6a8a' }}>
        ← Volver al login
      </a>
    </div>
  );
}

function WhatsappFallback() {
  if (!SUPPORT_WHATSAPP) return null;
  const url = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
  return (
    <p style={{ marginTop: 16, fontSize: 12, lineHeight: 1.6, color: '#6e6a8a' }}>
      ¿No tienes un correo asociado o no recuerdas cuál usaste?{' '}
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#2dd4bf', fontWeight: 600, textDecoration: 'underline' }}>
        Escríbenos por WhatsApp
      </a>
      .
    </p>
  );
}
