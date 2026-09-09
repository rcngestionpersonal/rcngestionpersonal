import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { fechaConZona } from '@/lib/real-estate/contratos/firma';
import { etiquetaRol } from '@/lib/real-estate/contratos/servidor';
import { AVISO_FIRMA_ELECTRONICA, CONTRATO_DEFINICION, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';

// Verificacion publica de un documento (punto 3.8).
//
// LO QUE MUESTRA: que el documento existe, de qué tipo es, cuándo se firmó,
// quiénes lo firmaron y su hash.
// LO QUE NUNCA MUESTRA: el contenido del contrato, ni cédulas completas, ni
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
      anuladoAt: true,
      // Solo nombre y rol de cada firmante. Ni el correo ni la cédula, ni
      // siquiera los últimos cuatro dígitos: esta página la ve cualquiera.
      firmantes: { select: { rol: true, nombre: true, estado: true, firmadoAt: true } },
    },
  });

  if (!contrato) {
    return (
      <Marco>
        <h1 className="mt-4 text-center text-xl font-bold">Documento no encontrado</h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-text-2">
          El código <span className="font-semibold text-text-2">{codigo}</span> no corresponde a ningún documento
          emitido en Redinmo. Verifique que lo haya copiado completo.
        </p>
      </Marco>
    );
  }

  const tipo = contrato.tipo as ContratoTipo;
  const nombreDocumento = CONTRATO_DEFINICION[tipo].nombreDocumento;
  const firmado = contrato.estado === 'FIRMADO';

  return (
    <Marco>
      <div className="mt-4 rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold leading-tight">{nombreDocumento}</h1>
            <p className="mt-1 text-xs text-text-2">
              Emitido el{' '}
              {contrato.createdAt.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold ${
              firmado
                ? 'border-accent-line bg-accent-dim text-accent'
                : contrato.estado === 'ANULADO' || contrato.estado === 'RECHAZADO'
                  ? 'border-line bg-surface-2 text-text-3'
                  : 'border-line bg-surface-2 text-text-2'
            }`}
          >
            {firmado
              ? 'Firmado'
              : contrato.estado === 'ANULADO'
                ? 'Anulado'
                : contrato.estado === 'RECHAZADO'
                  ? 'Rechazado'
                  : 'Pendiente de firma'}
          </span>
        </div>

        <dl className="mt-5 space-y-3 border-t border-line pt-4 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-text-3">Identificador</dt>
            <dd className="font-semibold tracking-[0.06em]">{contrato.codigoVerificacion}</dd>
          </div>
          {firmado && contrato.firmadoAt ? (
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-text-3">Fecha de firma</dt>
              <dd className="font-semibold">{fechaConZona(contrato.firmadoAt)}</dd>
            </div>
          ) : null}
          {contrato.hashDocumento ? (
            <div>
              <dt className="text-text-3">Hash SHA-256</dt>
              <dd className="mt-1 break-all font-mono text-[11px] leading-relaxed text-text-2">
                {contrato.hashDocumento}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-5 border-t border-line pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Firmantes</p>
          <ul className="mt-2 space-y-2">
            {contrato.firmantes.map((f) => (
              <li key={f.rol + f.nombre} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold">{f.nombre}</span>{' '}
                  <span className="text-text-3">· {etiquetaRol(tipo, f.rol)}</span>
                </span>
                <span className={`text-xs font-semibold ${f.estado === 'FIRMADO' ? 'text-accent' : 'text-text-3'}`}>
                  {f.estado === 'FIRMADO' ? `✓ ${fechaConZona(f.firmadoAt) ?? 'Firmado'}` : f.estado === 'RECHAZADO' ? 'Rechazó' : 'Pendiente'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-[12.5px] leading-relaxed text-text-2">
          Esta página confirma la existencia y el estado del documento. Por privacidad de las partes, no muestra su
          contenido. Para obtener una copia, solicítela a quien se lo envió.
        </p>

        <p className="mt-3 text-[11.5px] leading-relaxed text-text-3">{AVISO_FIRMA_ELECTRONICA}</p>
      </div>
    </Marco>
  );
}
