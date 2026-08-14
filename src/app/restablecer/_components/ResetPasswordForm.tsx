'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
      <label htmlFor="new-password" style={labelStyle}>
        Nueva contraseña
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id="new-password"
          type={show ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ ...inputStyle, paddingRight: 64 }}
        />
        <button type="button" onClick={() => setShow((v) => !v)} style={toggleStyle}>
          {show ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      <p style={{ marginTop: 6, fontSize: 11.5, color: meetsMinLength ? '#2dd4bf' : '#6e6a8a' }}>
        {meetsMinLength ? '✓' : '•'} Mínimo 8 caracteres (recomendado: mezcla de letras y números)
      </p>

      <label htmlFor="confirm-password" style={{ ...labelStyle, marginTop: 16 }}>
        Confirmar contraseña
      </label>
      <input
        id="confirm-password"
        type={show ? 'text' : 'password'}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        style={inputStyle}
      />
      {confirm.length > 0 && !passwordsMatch ? (
        <p style={{ marginTop: 6, fontSize: 11.5, color: '#fca5b1' }}>Las contraseñas no coinciden.</p>
      ) : null}

      {error ? (
        <div role="alert" style={{ marginTop: 14, borderRadius: 10, padding: '10px 12px', fontSize: 13, background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.3)', color: '#fca5b1' }}>
          {error}
        </div>
      ) : null}

      <button
        onClick={() => void submit()}
        disabled={!canSubmit}
        style={{
          marginTop: 18,
          width: '100%',
          height: 47,
          borderRadius: 9,
          background: '#2dd4bf',
          color: '#04201c',
          fontWeight: 700,
          fontSize: 14,
          opacity: canSubmit ? 1 : 0.6,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
        }}
      >
        {loading ? 'Guardando...' : 'Guardar y entrar'}
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 9.5,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6e6a8a',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 44,
  background: '#100d1c',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 9,
  color: 'var(--text)',
  fontSize: 13.5,
  padding: '0 14px',
};

const toggleStyle: React.CSSProperties = {
  position: 'absolute',
  right: 12,
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: 11.5,
  fontWeight: 500,
  color: '#6e6a8a',
};
