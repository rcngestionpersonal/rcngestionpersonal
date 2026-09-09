import Link from 'next/link';

// Pantalla neutra para los estados en los que no hay nada que firmar: enlace
// vencido, documento cancelado, rechazado o ya firmado (punto 3.9). Siempre
// explica QUE paso y QUE puede hacer la persona; nunca un 404 seco.
export default function AvisoPagina({
  titulo,
  detalle,
  descarga,
}: {
  titulo: string;
  detalle: string;
  descarga?: { url: string; etiqueta: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-12 text-text">
      <div className="w-full max-w-md text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo.io</p>
        <h1 className="mt-3 text-xl font-bold">{titulo}</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-2">{detalle}</p>
        {descarga ? (
          <a
            href={descarga.url}
            className="mt-6 inline-flex min-h-[44px] items-center rounded-xl border border-accent-line bg-accent-dim px-5 text-sm font-bold text-accent"
          >
            {descarga.etiqueta}
          </a>
        ) : null}
        <p className="mt-8 text-[11.5px] text-text-3">
          <Link href="/" className="hover:underline">
            redinmo.io
          </Link>
        </p>
      </div>
    </main>
  );
}
