import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-center text-white">
      <div>
        <h1 className="gradient-text text-3xl font-bold">404</h1>
        <p className="mt-2 text-sm text-white/60">Pagina no encontrada.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-violet-300 underline">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
