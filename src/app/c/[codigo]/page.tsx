import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { descifrarDocumento, fechaConZona } from '@/lib/real-estate/contratos/aprobacion';
import { AVISO_FIRMA_ELECTRONICA } from '@/lib/real-estate/contratos/legado-firma';
import { etiquetaRol, nombreDeParte } from '@/lib/real-estate/contratos/servidor';
import { AVISO_APROBACION, CONTRATO_DEFINICION, esEstadoDeFirmaLegado, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';

// Verificación pública de un documento: el registro de sus versiones y de quién
// aprobó cada una.
//
// LO QUE MUESTRA: que el documento existe, de qué tipo es, qué versiones se
// enviaron, quiénes aprobaron cada una y cuándo, y la huella de cada texto.
// LO QUE NUNCA MUESTRA: el contenido del contrato, ni cédulas, ni correos, ni
// direcciones, ni montos. Cualquiera puede llegar acá con solo el código, así
// que todo lo que se pinte es, por definición, público.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verificación de documento | Redinmo.io',
  robots: { index: false, follow: false },
};

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-12 text-text">
      <div className="w-full max-w-lg">
        <p className="text-center text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo.io</p>
        {children}
        <p className="mt-8 text-center text-[11.5px] text-text-3">
          <Link href="/" className="hover:underline">
            redinmo.io
          </Link>
        </p>
      </div>
    </main>
  );
}

const ESTADO_CONTRATO: Record<string, string> = {
  BORRADOR: 'Borrador',
  EN_APROBACION: 'En revisión',
  APROBADO: 'Versión aprobada',
  RECHAZADO: 'Con cambios pedidos',
  ANULADO: 'Anulado',
  PENDIENTE_FIRMA: 'Firma no concluida',
  FIRMADO: 'Firmado',
};

const ESTADO_VERSION: Record<string, string> = {
  EN_APROBACION: 'En revisión',
  APROBADA: 'Aprobada',
  RECHAZADA: 'No aprobada',
  REEMPLAZADA: 'Reemplazada',
  ANULADA: 'Anulada',
};

export default async function VerificacionPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;

  const contrato = await prisma.contrato.findUnique({
    where: { codigoVerificacion: codigo.toUpperCase() },
    select: {
      tipo: true,
      estado: true,
      codigoVerificacion: true,
      hashDocumento: true,
      firmadoAt: true,
      createdAt: true,
      versiones: {
        orderBy: { numero: 'desc' },
        select: { id: true, numero: true, estado: true, enviadaAt: true, aprobadaAt: true, huella: true, documentoCifrado: true },
      },
      // Solo nombre, rol y decisión de cada parte. Ni el correo ni la cédula,
      // ni siquiera los últimos cuatro dígitos: esta página la ve cualquiera.
      partes: { select: { versionId: true, rol: true, nombre: true, estado: true, firmadoAt: true, aprobadoAt: true } },
    },
  });

  if (!contrato) {
    return (
      <Marco>
        <h1 className="mt-4 text-center text-xl font-bold">Documento no encontrado</h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-text-2">
          El código <span className="font-semibold text-text-2">{codigo}</span> no corresponde a ningún documento registrado en
          Redinmo. Verifique que lo haya copiado completo.
        </p>
      </Marco>
    );
  }

  const tipo = contrato.tipo as ContratoTipo;
  const nombreDocumento = CONTRATO_DEFINICION[tipo].nombreDocumento;
  const deFirma = esEstadoDeFirmaLegado(contrato.estado) || contrato.partes.some((p) => !p.versionId);
  const insignia = ESTADO_CONTRATO[contrato.estado] ?? contrato.estado;
  const destacada = contrato.estado === 'APROBADO' || contrato.estado === 'FIRMADO';

  return (
    <Marco>
      <div className="mt-4 rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold leading-tight">{nombreDocumento}</h1>
            <p className="mt-1 text-xs text-text-2">
              Generado el {contrato.createdAt.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold ${
              destacada ? 'border-accent-line bg-accent-dim text-accent' : 'border-line bg-surface-2 text-text-2'
            }`}
          >
            {insignia}
          </span>
        </div>

        <dl className="mt-5 space-y-3 border-t border-line pt-4 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-text-3">Identificador</dt>
            <dd className="font-semibold tracking-[0.06em]">{contrato.codigoVerificacion}</dd>
          </div>
        </dl>

        {deFirma ? (
          <>
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Firmantes</p>
              <ul className="mt-2 space-y-2">
                {contrato.partes
                  .filter((p) => !p.versionId)
                  .map((f) => (
                    <li key={f.rol + f.nombre} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="min-w-0">
                        <span className="font-semibold">{f.nombre}</span> <span className="text-text-3">· {etiquetaRol(tipo, f.rol)}</span>
                      </span>
                      <span className={`text-xs font-semibold ${f.estado === 'FIRMADO' ? 'text-accent' : 'text-text-3'}`}>
                        {f.estado === 'FIRMADO' ? `✓ ${fechaConZona(f.firmadoAt) ?? 'Firmado'}` : 'Sin firma'}
                      </span>
                    </li>
                  ))}
              </ul>
              {contrato.hashDocumento ? (
                <div className="mt-4">
                  <p className="text-xs text-text-3">Hash SHA-256</p>
                  <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-text-2">{contrato.hashDocumento}</p>
                </div>
              ) : null}
            </div>
            <p className="mt-5 text-[12.5px] leading-relaxed text-text-2">{AVISO_FIRMA_ELECTRONICA}</p>
          </>
        ) : (
          <>
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Versiones</p>
              {contrato.versiones.length === 0 ? (
                <p className="mt-2 text-sm text-text-2">Todavía no se envió ninguna versión para revisión.</p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {contrato.versiones.map((v) => {
                    const doc = descifrarDocumento(v.documentoCifrado);
                    const partes = contrato.partes.filter((p) => p.versionId === v.id);
                    return (
                      <li key={v.id} className="rounded-xl border border-line p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-bold">Versión {v.numero}</span>
                          <span className={`text-xs font-semibold ${v.estado === 'APROBADA' ? 'text-accent' : 'text-text-3'}`}>
                            {ESTADO_VERSION[v.estado] ?? v.estado}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-text-3">Enviada el {fechaConZona(v.enviadaAt)}</p>
                        <ul className="mt-2 space-y-1">
                          {partes.map((p) => (
                            <li key={p.rol} className="flex flex-wrap justify-between gap-2 text-[13px]">
                              <span className="min-w-0">
                                <span className="font-semibold">{nombreDeParte(doc, tipo, p)}</span>{' '}
                                <span className="text-text-3">· {etiquetaRol(tipo, p.rol)}</span>
                              </span>
                              <span className={`text-xs ${p.estado === 'APROBADO' ? 'font-semibold text-accent' : 'text-text-3'}`}>
                                {p.estado === 'APROBADO'
                                  ? `✓ Aprobó el ${fechaConZona(p.aprobadoAt)}`
                                  : p.estado === 'RECHAZADO'
                                    ? 'Pidió cambios'
                                    : 'Sin decisión'}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-[11px] text-text-3">Huella del texto (SHA-256)</p>
                        <p className="break-all font-mono text-[10.5px] leading-relaxed text-text-2">{v.huella}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] leading-relaxed text-text">
              {AVISO_APROBACION}
            </p>
          </>
        )}

        <p className="mt-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-[12.5px] leading-relaxed text-text-2">
          Esta página confirma la existencia y el recorrido del documento. Por privacidad de las partes, no muestra su contenido.
          Para obtener una copia, solicítela a quien se lo envió.
        </p>
      </div>
    </Marco>
  );
}
