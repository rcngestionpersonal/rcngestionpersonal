import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/real-estate/contratos/aprobacion';
import { CONTRATO_DEFINICION, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';
import AvisoPagina from '@/app/aprobar/[token]/_components/AvisoPagina';

// Enlaces del flujo de firma electrónica, retirado el 2026-09-16.
//
// Ya no se firma nada aquí: el módulo registra aprobaciones de borrador y la
// firma es presencial. Estos enlaces siguen respondiendo para que quien los
// abra entienda qué pasó, y quien llegó a firmar pueda descargar su copia.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Documento | Redinmo.io',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PaginaFirmaRetirada({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parte = await prisma.contratoParte.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { versionId: true, estado: true, contrato: { select: { tipo: true, estado: true, codigoVerificacion: true } } },
  });

  if (!parte) {
    return (
      <AvisoPagina
        titulo="Enlace no válido"
        detalle="Este enlace no corresponde a ningún documento. Verifique que lo haya copiado completo desde el correo."
      />
    );
  }

  // Un enlace de aprobación que llegó por esta ruta: se lleva a la suya.
  if (parte.versionId) redirect(`/aprobar/${token}`);

  const nombreDocumento = CONTRATO_DEFINICION[parte.contrato.tipo as ContratoTipo]?.nombreDocumento ?? 'el documento';

  if (parte.estado === 'FIRMADO') {
    return (
      <AvisoPagina
        titulo="Usted ya firmó"
        detalle={`Su firma quedó registrada. Se trata de ${nombreDocumento}, identificador ${parte.contrato.codigoVerificacion}.`}
        descarga={{ url: `/firmar/${token}/pdf`, etiqueta: 'Descargar el documento en PDF' }}
      />
    );
  }

  return (
    <AvisoPagina
      titulo="Este enlace ya no admite firmas"
      detalle="La plataforma dejó de ofrecer firma electrónica: los contratos se firman personalmente y, cuando corresponde, se legalizan ante notario. Contacte con quien le envió el documento para acordar cómo continuar."
    />
  );
}
