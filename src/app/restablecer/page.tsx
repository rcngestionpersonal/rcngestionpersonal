import type { Metadata } from 'next';
import { validateResetToken } from '@/lib/real-estate/password-reset';
import ResetPasswordForm from './_components/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Restablecer contraseña | Redinmo',
  robots: { index: false, follow: false },
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', background: '#0d0b16', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: '#191527',
          border: '1px solid rgba(255,255,255,0.08)',
          borderTop: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 16,
          padding: '28px 24px',
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 600 }}>
          <span style={{ color: '#2dd4bf' }}>✦</span> <span style={{ color: 'var(--text)' }}>REDINMO</span>
        </p>
        {children}
      </div>
    </main>
  );
}

export default async function RestablecerPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (!token) {
    return <InvalidLinkCard />;
  }

  const validation = await validateResetToken(token);
  if (!validation.valid) {
    return <InvalidLinkCard />;
  }

  return (
    <Card>
      <h1 style={{ marginTop: 16, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Crear nueva contraseña</h1>
      <p style={{ marginTop: 8, marginBottom: 22, fontSize: 13.5, lineHeight: 1.5, color: '#a09bbb' }}>
        Elige una contraseña nueva para tu cuenta de Redinmo.
      </p>
      <ResetPasswordForm token={token} />
    </Card>
  );
}

function InvalidLinkCard() {
  return (
    <Card>
      <h1 style={{ marginTop: 16, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Este enlace ya no es válido</h1>
      <p style={{ marginTop: 8, marginBottom: 22, fontSize: 13.5, lineHeight: 1.5, color: '#a09bbb' }}>
        El enlace venció (dura 30 minutos) o ya fue utilizado. Solicita uno nuevo para continuar.
      </p>
      <a
        href="/recuperar-acceso"
        style={{
          display: 'block',
          textAlign: 'center',
          width: '100%',
          height: 47,
          lineHeight: '47px',
          borderRadius: 9,
          background: '#2dd4bf',
          color: '#04201c',
          fontWeight: 700,
          fontSize: 14,
          textDecoration: 'none',
        }}
      >
        Solicitar uno nuevo
      </a>
      <a href="/login" style={{ display: 'inline-block', marginTop: 18, fontSize: 12.5, fontWeight: 600, color: '#6e6a8a' }}>
        ← Volver al login
      </a>
    </Card>
  );
}
