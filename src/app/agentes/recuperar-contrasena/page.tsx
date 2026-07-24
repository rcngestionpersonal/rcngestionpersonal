import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Recuperar contraseña | Redinmo',
};

export default function RecuperarContrasenaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0d14] px-4 text-center text-white">
      <div className="max-w-sm">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#2dd4bf]">✦ Redinmo</p>
        <h1 className="mt-3 text-2xl font-extrabold">En construcción</h1>
        <p className="mt-2 text-sm text-[#9296b0]">
          La recuperación de contraseña por este medio todavía no está disponible. Mientras tanto,
          escríbenos y te ayudamos a recuperar el acceso a tu cuenta.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2">
          <a href="/soporte" className="text-sm font-bold text-[#2dd4bf] hover:underline">
            Escríbenos →
          </a>
          <a href="/login" className="text-sm font-semibold text-[#62667f] hover:text-[#9296b0]">
            ← Volver al login
          </a>
        </div>
      </div>
    </main>
  );
}
