import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Soporte | Redinmo',
};

export default function SoportePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 text-center text-text">
      <div className="max-w-sm">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo</p>
        <h1 className="mt-3 text-2xl font-extrabold">En construcción</h1>
        <p className="mt-2 text-sm text-text-2">
          El canal de soporte directo todavía está en construcción. Mientras tanto, escríbenos a{' '}
          <a href="mailto:privacidad@redinmo.io" className="font-bold text-accent hover:underline">
            privacidad@redinmo.io
          </a>{' '}
          y te respondemos lo antes posible.
        </p>
        <a href="/login" className="mt-6 inline-block text-sm font-semibold text-text-3 hover:text-text-2">
          ← Volver al login
        </a>
      </div>
    </main>
  );
}
