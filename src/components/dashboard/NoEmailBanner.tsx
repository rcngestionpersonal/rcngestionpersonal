'use client';

import { useEffect, useState } from 'react';

// Nudge no bloqueante, se muestra UNA vez por agente (persistido en localStorage,
// mismo patron que el nudge de foto del carnet en RankingTab.tsx) para que los
// agentes que se registraron antes de que el correo fuera obligatorio puedan
// agregarlo - sin el, no pueden recuperar su cuenta si olvidan la contrasena.
export default function NoEmailBanner({ agentId, onSaved }: { agentId: string; onSaved: () => void }) {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `redinmo_no_email_nudge_${agentId}`;
    if (!window.localStorage.getItem(key)) {
      setVisible(true);
      window.localStorage.setItem(key, '1');
    }
  }, [agentId]);

  if (!visible) return null;

  async function submit() {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Ingresa un correo válido.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/real-estate/agents/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar tu correo.');
      setSaved(true);
      onSaved();
      setTimeout(() => setVisible(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando correo');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fade-up mb-6 rounded-2xl border border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.08)] px-4 py-3.5">
      {saved ? (
        <p className="text-sm font-semibold text-[#2dd4bf]">✓ Correo guardado. Ya puedes recuperar tu cuenta si olvidas tu contraseña.</p>
      ) : (
        <>
          <p className="text-sm font-semibold text-[#f0f1f7]">Agrega tu correo para poder recuperar tu cuenta si olvidas la contraseña</p>
          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="tucorreo@ejemplo.com"
              className="min-w-0 flex-1 rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[rgba(45,212,191,0.4)] focus:outline-none"
            />
            <button
              onClick={() => void submit()}
              disabled={saving || !email.trim()}
              className="shrink-0 rounded-[10px] bg-[#2dd4bf] px-4 py-2 text-sm font-bold text-[#04201c] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => setVisible(false)}
              className="shrink-0 rounded-[10px] px-3 py-2 text-sm font-semibold text-[#9296b0] transition-colors hover:text-white"
            >
              Ahora no
            </button>
          </div>
          {error ? <p className="mt-1.5 text-xs text-[#fca5b1]">{error}</p> : null}
        </>
      )}
    </div>
  );
}
