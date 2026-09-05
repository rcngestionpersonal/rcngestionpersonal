import type { Metadata } from 'next';
import ForgotAccessForm from './_components/ForgotAccessForm';

export const metadata: Metadata = {
  title: 'Recuperar acceso | Redinmo.io',
  robots: { index: false, follow: false },
};

export default function RecuperarAccesoPage() {
  return (
    <main className="violet-ambient-bg flex min-h-screen items-center justify-center px-4 py-10 text-text">
      <div className="mx-auto w-full max-w-sm">
        <section className="grain-overlay relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-md backdrop-blur-xl sm:p-7">
          <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-[var(--glow-brand)] blur-2xl" />
          <div className="relative z-10">
            <p className="text-xs font-bold">
              <span className="text-accent">✦</span> <span className="text-text">REDINMO.IO</span>
            </p>
            <h1 className="gradient-text mt-4 text-xl font-extrabold sm:text-2xl">Recuperar acceso</h1>
            <p className="mb-6 mt-2 text-[13.5px] leading-relaxed text-text-2">
              Ingresa el correo o teléfono de tu cuenta y te enviamos un enlace para crear una nueva contraseña.
            </p>
            <ForgotAccessForm />
          </div>
        </section>
      </div>
    </main>
  );
}
