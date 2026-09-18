import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { descifrarDocumento, fechaLarga, hashToken } from '@/lib/real-estate/contratos/aprobacion';
import { compararDocumentos } from '@/lib/real-estate/contratos/clausulas';
import { solicitudDe } from '@/lib/real-estate/contratos/eventos';
import { etiquetaRol, nombreDeParte, perfilAgente } from '@/lib/real-estate/contratos/servidor';
import { motivoCerrado, parteDeToken, registrarApertura, textoCerrado } from '@/lib/real-estate/contratos/versiones';
import { etiquetasEtapas, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';
import PanelAprobacion from './_components/PanelAprobacion';
import AvisoPagina from './_components/AvisoPagina';

// Página de revisión de una versión. Pública y sin login: la credencial es el
// enlace personal. Server component para que el documento llegue renderizado y
// sea legible antes de que cargue el JavaScript.
//
// Qué se muestra lo decide el servidor en cada visita: una contraparte con un
// enlace en la mano no ve nada que la parte principal no haya aprobado y el
// agente no le haya enviado.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Revisar documento',
  // Un enlace personal no se indexa jamás.
  robots: { index: false, follow: false, nocache: true },
};

const TITULOS: Record<string, string> = {
  firma_retirada: 'Enlace de un proceso retirado',
  cancelado: 'Documento cancelado',
  no_disponible: 'Documento en revisión',
  reemplazada: 'Hay una versión más reciente',
  rechazada_por_otra_parte: 'Esta versión se está corrigiendo',
  ya_aprobo: 'Usted ya aprobó esta versión',
  ya_rechazo: 'Usted pidió cambios en esta versión',
  bloqueado: 'Enlace bloqueado por seguridad',
  vencido: 'El enlace venció',
};

export default async function PaginaAprobacion({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parte = await parteDeToken(hashToken(token));

  if (!parte) {
    return (
      <AvisoPagina
        titulo="Enlace no válido"
        detalle="Este enlace no corresponde a ningún documento. Verifique que lo haya copiado completo desde el mensaje que recibió."
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
          motivo === 'ya_rechazo' && parte.motivoRechazo ? `${textoCerrado(motivo)} Lo que indicó: "${parte.motivoRechazo}".` : textoCerrado(motivo)
        }
        descarga={conDescarga ? { url: `/aprobar/${token}/pdf`, etiqueta: 'Descargar esta versión en PDF' } : undefined}
      />
    );
  }

  const version = parte.version;
  const doc = descifrarDocumento(version.documentoCifrado);
  if (!doc) {
    return <AvisoPagina titulo="No pudimos abrir el documento" detalle="Hubo un problema al preparar esta versión. Contacte con quien se la envió." />;
  }

  // Primer acceso: queda en la constancia y en el historial. Nunca bloquea.
  await registrarApertura(parte, solicitudDe(await headers())).catch(() => {});

  const tipo = parte.contrato.tipo as ContratoTipo;

  // Si esta persona ya revisó una versión anterior (la aprobó o pidió cambios),
  // ve resaltado qué cambió desde entonces, palabra por palabra.
  const decisionPrevia = parte.contrato.partes
    .filter((p) => p.rol === parte.rol && p.versionId !== version.id && (p.estado === 'APROBADO' || p.estado === 'RECHAZADO'))
    .map((p) => ({ p, v: parte.contrato.versiones.find((v) => v.id === p.versionId) }))
    .filter((x): x is { p: typeof x.p; v: NonNullable<typeof x.v> } => Boolean(x.v) && x.v!.numero < version.numero)
    .sort((a, b) => b.v.numero - a.v.numero)[0];
  const docPrevio = decisionPrevia ? descifrarDocumento(decisionPrevia.v.documentoCifrado) : null;

  const remitente = await perfilAgente(parte.contrato.agentId);
  const enNombreDe = nombreDeParte(doc, tipo, parte);
  const etiquetas = etiquetasEtapas(tipo, version.representa);

  // Los avisos para quien revisa (plantilla pendiente de revisión legal y los
  // que traía el documento) se muestran al decidir, no dentro del documento.
  const avisos = [doc.avisoSinRevisar, ...doc.bloques.filter((b) => b.tipo === 'aviso').map((b) => ('texto' in b ? b.texto : ''))].filter(
    (a): a is string => Boolean(a),
  );

  return (
    <PanelAprobacion
      token={token}
      nombreDocumento={doc.nombreDocumento}
      numero={version.numero}
      codigo={parte.contrato.codigoVerificacion}
      ciudad={doc.ciudad}
      fechaLarga={doc.fechaLarga}
      bloques={doc.bloques.filter((b) => b.tipo !== 'aviso')}
      comparacion={
        decisionPrevia && docPrevio
          ? {
              base: decisionPrevia.v.numero,
              decision: decisionPrevia.p.estado === 'APROBADO' ? 'aprobo' : 'pidio_cambios',
              ...compararDocumentos(
                docPrevio.bloques.filter((b) => b.tipo !== 'aviso'),
                doc.bloques.filter((b) => b.tipo !== 'aviso'),
              ),
            }
          : null
      }
      avisos={avisos}
      parte={{
        nombre: parte.nombre,
        rol: etiquetaRol(tipo, parte.rol),
        enNombreDe: enNombreDe !== parte.nombre ? enNombreDe : null,
      }}
      etapa={{
        actual: parte.etapa,
        principal: etiquetas.PRINCIPAL,
        contraparte: etiquetas.CONTRAPARTE,
      }}
      // Solo quienes revisan en la misma etapa: el resto no es asunto suyo aún.
      partes={parte.contrato.partes
        .filter((p) => p.versionId === version.id && p.etapa === parte.etapa)
        .map((p) => ({ nombre: nombreDeParte(doc, tipo, p), rol: etiquetaRol(tipo, p.rol), estado: p.estado, esUsted: p.id === parte.id }))}
      remitente={{ nombre: remitente.nombre, empresa: remitente.empresa, photoUrl: remitente.photoUrl }}
      venceEl={fechaLarga(parte.expiraAt)}
      urlPdf={`/aprobar/${token}/pdf`}
    />
  );
}
