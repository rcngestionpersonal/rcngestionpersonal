import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { descifrarDocumento, fechaLarga, hashToken } from '@/lib/real-estate/contratos/aprobacion';
import { compararVersiones } from '@/lib/real-estate/contratos/clausulas';
import { etiquetaRol, nombreDeParte, perfilAgente } from '@/lib/real-estate/contratos/servidor';
import { motivoCerrado, parteDeToken, textoCerrado } from '@/lib/real-estate/contratos/versiones';
import type { ContratoTipo } from '@/lib/real-estate/contratos/tipos';
import PanelAprobacion from './_components/PanelAprobacion';
import AvisoPagina from './_components/AvisoPagina';

// Página de revisión de una versión. Pública y sin login: la credencial es el
// acceso al correo donde llegó el enlace. Server component para que el
// documento llegue renderizado y sea legible antes de que cargue el JavaScript.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Revisar documento | Redinmo.io',
  // Un enlace personal no se indexa jamás.
  robots: { index: false, follow: false, nocache: true },
};

const TITULOS: Record<string, string> = {
  firma_retirada: 'Enlace de un proceso retirado',
  cancelado: 'Documento cancelado',
  reemplazada: 'Hay una versión más reciente',
  rechazada_por_otra_parte: 'Esta versión se está corrigiendo',
  ya_aprobo: 'Usted ya aprobó esta versión',
  ya_rechazo: 'Usted pidió cambios en esta versión',
  vencido: 'El enlace venció',
};

export default async function PaginaAprobacion({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parte = await parteDeToken(hashToken(token));

  if (!parte) {
    return (
      <AvisoPagina
        titulo="Enlace no válido"
        detalle="Este enlace no corresponde a ningún documento. Verifique que lo haya copiado completo desde el correo."
      />
    );
  }

  const cerrado = motivoCerrado(parte);
  if (cerrado || !parte.version) {
    const motivo = cerrado ?? 'firma_retirada';
    // Quien ya decidió conserva el acceso a la versión sobre la que decidió.
    const conDescarga = motivo === 'ya_aprobo' || motivo === 'ya_rechazo';
    return (
      <AvisoPagina
        titulo={TITULOS[motivo]}
        detalle={
          motivo === 'ya_rechazo' && parte.motivoRechazo
            ? `${textoCerrado(motivo)} Lo que indicó: "${parte.motivoRechazo}".`
            : textoCerrado(motivo)
        }
        descarga={conDescarga ? { url: `/aprobar/${token}/pdf`, etiqueta: 'Descargar esta versión en PDF' } : undefined}
      />
    );
  }

  const version = parte.version;
  const doc = descifrarDocumento(version.documentoCifrado);
  if (!doc) {
    return (
      <AvisoPagina
        titulo="No pudimos abrir el documento"
        detalle="Hubo un problema al preparar esta versión. Contacte con quien se la envió."
      />
    );
  }

  // Primer acceso: se registra para la constancia. Nunca bloquea el render.
  if (!parte.abiertoAt) {
    await prisma.contratoParte
      .update({ where: { id: parte.id }, data: { abiertoAt: new Date(), estado: 'ABIERTO' } })
      .catch(() => {});
  }

  const tipo = parte.contrato.tipo as ContratoTipo;
  const previa = parte.contrato.versiones.find((v) => v.numero === version.numero - 1);
  const docPrevio = previa ? descifrarDocumento(previa.documentoCifrado) : null;
  const remitente = await perfilAgente(parte.contrato.agentId);
  const enNombreDe = nombreDeParte(doc, tipo, parte);

  return (
    <PanelAprobacion
      token={token}
      nombreDocumento={doc.nombreDocumento}
      numero={version.numero}
      codigo={parte.contrato.codigoVerificacion}
      bloques={doc.bloques}
      cambios={docPrevio ? compararVersiones(docPrevio.bloques, doc.bloques) : null}
      parte={{
        nombre: parte.nombre,
        rol: etiquetaRol(tipo, parte.rol),
        correo: parte.correo,
        enNombreDe: enNombreDe !== parte.nombre ? enNombreDe : null,
      }}
      partes={parte.contrato.partes
        .filter((p) => p.versionId === version.id)
        .map((p) => ({ nombre: nombreDeParte(doc, tipo, p), rol: etiquetaRol(tipo, p.rol), estado: p.estado }))}
      remitente={{ nombre: remitente.nombre, empresa: remitente.empresa, photoUrl: remitente.photoUrl }}
      venceEl={fechaLarga(parte.expiraAt)}
      urlPdf={`/aprobar/${token}/pdf`}
    />
  );
}
