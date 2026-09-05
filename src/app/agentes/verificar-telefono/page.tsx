'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type MeAgent = {
  id: string;
  fullName: string;
  phone: string;
  phoneVerifiedAt?: string | null;
};

export default function VerificarTelefonoPage() {
  const router = useRouter();
  const [agent, setAgent] = useState<MeAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/real-estate/agents/me', { cache: 'no-store' });
      if (!res.ok) {
        router.replace('/login');
        return;
      }
      const data = await res.json();
      const me = data.agent as MeAgent;
      setAgent(me);
      if (me.phoneVerifiedAt) {
        router.replace('/agentes/suscripcion');
      }
    } finally {
      setLoading(false);
    }
  }

  async function requestCode() {
    setRequesting(true);
    setError('');
    try {
      const res = await fetch('/api/real-estate/agents/verify-phone/request', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo enviar el código.');
      setDemoCode(data.demoCode ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al solicitar el código.');
    } finally {
      setRequesting(false);
    }
  }

  async function confirmCode() {
    setConfirming(true);
    setError('');
    try {
      const res = await fetch('/api/real-estate/agents/verify-phone/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Código inválido.');
      router.replace('/agentes/suscripcion');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al confirmar el código.');
    } finally {
      setConfirming(false);
    }
  }

  if (loading || !agent) {
    return <main className="min-h-screen bg-bg" />;
  }

  return (
    <main className="violet-ambient-bg min-h-screen px-4 py-10 text-text sm:py-16">
      <div className="mx-auto max-w-md">
        <section className="grain-overlay relative mb-6 overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-violet-600/25 blur-2xl" />
          <div className="relative z-10 space-y-2">
            <p className="inline-flex rounded-full border border-violet-400/40 bg-violet-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
              Paso 1 de 2
            </p>
            <h1 className="gradient-text text-2xl font-bold leading-tight sm:text-3xl">Verifica tu teléfono</h1>
            <p className="max-w-xl text-sm text-text-2">
              Confirma tu número para activar la insignia de confianza y proteger la comunidad de agentes Redinmo.io.
            </p>
          </div>
        </section>

        <section className="glass-card rounded-3xl p-5 sm:p-6">
          <p className="text-sm text-text-2">
            Teléfono: <span className="font-semibold text-text">{agent.phone}</span>
          </p>

          <button
            onClick={requestCode}
            disabled={requesting}
            className="gradient-btn mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-60"
          >
            {requesting ? 'Enviando...' : 'Enviar código de verificación'}
          </button>

          {demoCode ? (
            <p className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2.5 text-xs text-cyan-200">
              Modo demo (sin proveedor SMS configurado), tu código es: <span className="font-bold">{demoCode}</span>
            </p>
          ) : null}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-3 focus:border-violet-400"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Código de 6 dígitos"
            />
            <button
              onClick={confirmCode}
              disabled={confirming || code.trim().length < 4}
              className="rounded-xl bg-grad px-4 py-2.5 text-sm font-semibold text-grad-contrast transition-transform duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {confirming ? 'Confirmando...' : 'Confirmar código'}
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-pink-400/30 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">{error}</div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
