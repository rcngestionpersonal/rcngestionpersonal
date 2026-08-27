import type { Metadata } from 'next';
import { validateResetToken } from '@/lib/real-estate/password-reset';
import ResetPasswordForm from './_components/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Restablecer contraseña | Redinmo',
  robots: { index: false, follow: false },
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className="violet-ambient-bg flex min-h-screen items-center justify-center px-4 py-10 text-text">
      <div className="mx-auto w-full max-w-sm">
        <section className="grain-overlay relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-md backdrop-blur-xl sm:p-7">
          <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-[var(--glow-brand)] blur-2xl" />
          <div className="relative z-10">
            <p className="text-xs font-bold">
              <span className="text-accent">✦</span> <span className="text-text">REDINMO</span>
            </p>
            {children}
          </div>
        </section>
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
      <h1 className="gradient-text mt-4 text-xl font-extrabold sm:text-2xl">Crear nueva contraseña</h1>
      <p className="mb-6 mt-2 text-[13.5px] leading-relaxed text-text-2">Elige una contraseña nueva para tu cuenta de Redinmo.</p>
      <ResetPasswordForm token={token} />
    </Card>
  );
}

function InvalidLinkCard() {
  return (
    <Card>
      <h1 className="gradient-text mt-4 text-xl font-extrabold sm:text-2xl">Este enlace ya no es válido</h1>
      <p className="mb-6 mt-2 text-[13.5px] leading-relaxed text-text-2">
        El enlace venció (dura 30 minutos) o ya fue utilizado. Solicita uno nuevo para continuar.
      </p>
      <a href="/recuperar-acceso" className="gradient-btn block h-[47px] w-full rounded-lg text-center text-sm font-bold leading-[47px] text-grad-contrast">
        Solicitar uno nuevo
      </a>
      <a href="/login" className="mt-[18px] inline-block text-xs font-semibold text-text-3 hover:text-text-2">
        ← Volver al login
      </a>
    </Card>
  );
}
