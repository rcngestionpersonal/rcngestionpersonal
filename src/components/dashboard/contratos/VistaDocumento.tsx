import type { BloqueFinal } from '@/lib/real-estate/contratos/clausulas';

// El documento para leerlo en pantalla, igual que lo verán las partes: sin
// marca, con sus cláusulas numeradas, la ficha y quiénes firmarán.
export default function VistaDocumento({ bloques, ciudad, fechaLarga }: { bloques: BloqueFinal[]; ciudad: string; fechaLarga: string }) {
  return (
    <article className="rounded-xl border border-line bg-surface-2 p-4 sm:p-6">
      {bloques.map((b, i) => {
        if (b.tipo === 'titulo') {
          return (
            <div key={i} className="mb-5 text-center">
              <h4 className="text-[15px] font-extrabold leading-snug">{b.texto}</h4>
              <p className="mt-1 text-xs text-text-3">
                {ciudad}, {fechaLarga}
              </p>
            </div>
          );
        }
        if (b.tipo === 'subtitulo') {
          return (
            <p key={i} className="mb-3 mt-5 text-[13px] font-extrabold tracking-[0.04em]">
              {b.texto}
            </p>
          );
        }
        if (b.tipo === 'clausula') {
          return (
            <div key={i} className="mb-4">
              <p className="text-[13.5px] font-bold">{b.encabezado}</p>
              {b.texto
                .split(/\n+/)
                .filter((t) => t.trim())
                .map((t, j) => (
                  <p key={j} className="mt-1 break-words text-[13.5px] leading-relaxed text-text-2">
                    {t}
                  </p>
                ))}
            </div>
          );
        }
        if (b.tipo === 'ficha') {
          return (
            <div key={i} className="my-4 overflow-hidden rounded-lg border border-line">
              <p className="border-b border-line px-3 py-2 text-[11.5px] font-extrabold tracking-[0.06em] text-text-2">{b.titulo}</p>
              <dl className="divide-y divide-line">
                {b.filas.map((f) => (
                  <div key={f.etiqueta} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-4">
                    <dt className="text-[12.5px] font-semibold text-text-2 sm:w-44 sm:shrink-0">{f.etiqueta}</dt>
                    <dd className="min-w-0 break-words text-[13px] text-text">{f.valor}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        }
        if (b.tipo === 'firmas') {
          return (
            <div key={i} className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
              {b.partes.map((p, j) => (
                <div key={j} className="text-[12.5px] leading-relaxed">
                  <div className="mb-1 h-8 border-b border-text-3" />
                  {p.enRepresentacionDe ? (
                    <>
                      <p className="font-bold text-text">{p.enRepresentacionDe.razonSocial}</p>
                      <p className="text-text-2">RUC {p.enRepresentacionDe.ruc}</p>
                      <p className="text-text-2">
                        p. {p.nombre} · {p.tipoDocumento} {p.documento}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-text">{p.nombre}</p>
                      <p className="text-text-2">
                        {p.tipoDocumento} {p.documento}
                      </p>
                    </>
                  )}
                  <p className="font-bold tracking-[0.04em] text-text-2">{p.calidad}</p>
                </div>
              ))}
            </div>
          );
        }
        return (
          <p key={i} className="mb-3 break-words text-[13.5px] leading-relaxed text-text-2">
            {b.texto}
          </p>
        );
      })}
    </article>
  );
}
