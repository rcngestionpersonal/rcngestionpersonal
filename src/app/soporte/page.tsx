import type { Metadata } from 'next';
import EncabezadoSecundario from '@/components/navegacion/EncabezadoSecundario';

export const metadata: Metadata = {
  title: 'Soporte | Redinmo.io',
};

export default function SoportePage() {
  return (
    <>
      <EncabezadoSecundario padre="/login" titulo="Soporte" />
      <main className="flex min-h-screen items-center justify-center bg-bg px-4 text-center text-text">
        <div className="max-w-sm">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo.io</p>
          <h1 className="mt-3 text-2xl font-extrabold">En construcción</h1>
          <p className="mt-2 text-sm text-text-2">
            El canal de soporte directo todavía está en construcción. Mientras tanto, escríbenos a{' '}
            <a href="mailto:privacidad@redinmo.io" className="font-bold text-accent hover:underline">
              privacidad@redinmo.io
            </a>{' '}
            y te respondemos lo antes posible.
          </p>
        </div>
      </main>
    </>
  );
}
