'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const inputClass =
  'h-11 w-full rounded-lg border border-line-strong bg-input-bg px-3.5 text-[13.5px] font-medium text-text outline-none transition placeholder:font-normal placeholder:text-text-3 focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-dim)]';

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // El token nunca debe quedar visible en la barra de direcciones (ni terminar en
  // un referer de una navegacion posterior) - se limpia apenas monta la pantalla,
  // aunque ya viajo como prop server->client para el submit.
  useEffect(() => {
    window.history.replaceState({}, '', '/restablecer');
  }, []);

  const meetsMinLength = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit = meetsMinLength && passwordsMatch && !loading;

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo actualizar la contraseña.');
      router.replace('/?pwreset=1');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <label htmlFor="new-password" className="mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.06em] text-text-3">
        Nueva contraseña
      </label>
      <div className="relative">
        <input
          id="new-password"
          type={show ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${inputClass} pr-16`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] font-medium text-text-3 hover:text-text-2"
        >
          {show ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      <p className={`mt-1.5 text-[11.5px] ${meetsMinLength ? 'text-accent' : 'text-text-3'}`}>
        {meetsMinLength ? '✓' : '•'} Mínimo 8 caracteres (recomendado: mezcla de letras y números)
      </p>

      <label htmlFor="confirm-password" className="mb-1.5 mt-4 block text-[9.5px] font-semibold uppercase tracking-[0.06em] text-text-3">
        Confirmar contraseña
      </label>
      <input id="confirm-password" type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
      {confirm.length > 0 && !passwordsMatch ? <p className="mt-1.5 text-[11.5px] text-danger">Las contraseñas no coinciden.</p> : null}

      {error ? <div role="alert" className="mt-3.5 rounded-[10px] border border-danger bg-danger-dim px-3 py-2.5 text-sm text-danger">{error}</div> : null}

      <button
        onClick={() => void submit()}
        disabled={!canSubmit}
        className="gradient-btn mt-[18px] h-[47px] w-full rounded-lg text-sm font-bold text-grad-contrast transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Guardando...' : 'Guardar y entrar'}
      </button>
    </div>
  );
}
