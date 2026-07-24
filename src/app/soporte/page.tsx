import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Soporte | Redinmo',
};

export default function SoportePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0d14] px-4 text-center text-white">
      <div className="max-w-sm">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#2dd4bf]">✦ Redinmo</p>
        <h1 className="mt-3 text-2xl font-extrabold">En construcción</h1>
        <p className="mt-2 text-sm text-[#9296b0]">
          El canal de soporte directo todavía está en construcción. Mientras tanto, escríbenos a{' '}
          <a href="mailto:notificaciones@redinmo.io" className="font-bold text-[#2dd4bf] hover:underline">
            notificaciones@redinmo.io
          </a>{' '}
          y te respondemos lo antes posible.
        </p>
        <a href="/login" className="mt-6 inline-block text-sm font-semibold text-[#62667f] hover:text-[#9296b0]">
          ← Volver al login
        </a>
      </div>
    </main>
  );
}
