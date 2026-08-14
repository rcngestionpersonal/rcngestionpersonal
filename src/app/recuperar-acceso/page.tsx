import type { Metadata } from 'next';
import ForgotAccessForm from './_components/ForgotAccessForm';

export const metadata: Metadata = {
  title: 'Recuperar acceso | Redinmo',
  robots: { index: false, follow: false },
};

export default function RecuperarAccesoPage() {
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
        <h1 style={{ marginTop: 16, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Recuperar acceso</h1>
        <p style={{ marginTop: 8, marginBottom: 22, fontSize: 13.5, lineHeight: 1.5, color: '#a09bbb' }}>
          Ingresa el correo o teléfono de tu cuenta y te enviamos un enlace para crear una nueva contraseña.
        </p>
        <ForgotAccessForm />
      </div>
    </main>
  );
}
