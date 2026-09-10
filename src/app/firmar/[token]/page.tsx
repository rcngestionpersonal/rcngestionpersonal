import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { bloquesATextoPlano, construirDocumento, romano } from '@/lib/real-estate/contratos/documento';
import { descifrarDatos, hashToken } from '@/lib/real-estate/contratos/firma';
import { etiquetaRol } from '@/lib/real-estate/contratos/servidor';
import { CONTRATO_DEFINICION, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';
import { obtenerPlantilla } from '@/lib/real-estate/contratos/plantillas';
import PanelFirma, { type BloqueVista } from './_components/PanelFirma';
import AvisoPagina from './_components/AvisoPagina';

// Pagina de firma. Publica y sin login: la credencial es el acceso al correo
// donde llego el enlace (punto 3.4). Server component para que el documento
// llegue renderizado y sea legible incluso antes de que cargue el JavaScript.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Firmar documento | Redinmo.io',
  // Un enlace de firma no se indexa jamas.
  robots: { index: false, follow: false, nocache: true },
};

export default async function PaginaFirma({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const firmante = await prisma.contratoFirmante.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { contrato: { include: { firmantes: true } } },
  });

  if (!firmante) {
    return (
      <AvisoPagina
        titulo="Enlace no válido"
        detalle="Este enlace de firma no corresponde a ningún documento. Verifica que lo hayas copiado completo desde el correo."
      />
    );
  }

  const contrato = firmante.contrato;
  const tipo = contrato.tipo as ContratoTipo;
  const nombreDocumento = CONTRATO_DEFINICION[tipo].nombreDocumento;

  if (contrato.estado === 'ANULADO') {
    return (
      <AvisoPagina
        titulo="Documento cancelado"
        detalle="Quien le envió este documento canceló el proceso de firma. No se requiere ninguna acción de su parte."
      />
    );
  }

  if (contrato.estado === 'RECHAZADO' && firmante.estado !== 'RECHAZADO') {
    return (
      <AvisoPagina
        titulo="Proceso detenido"
        detalle="Una de las partes rechazó este documento, por lo que el proceso de firma se detuvo. Contacte con quien se lo envió."
      />
    );
  }

  // Un enlace ya usado no vuelve a pedir firma: muestra el estado y deja
  // descargar el documento (punto 3.9).
  if (firmante.estado === 'FIRMADO') {
    return (
      <AvisoPagina
        titulo="Ya firmó este documento"
        detalle={`Su aceptación quedó registrada. El documento es ${nombreDocumento}, identificador ${contrato.codigoVerificacion}.`}
        descarga={{ url: `/firmar/${token}/pdf`, etiqueta: 'Descargar el documento en PDF' }}
      />
    );
  }

  if (firmante.estado === 'RECHAZADO') {
    return (
      <AvisoPagina
        titulo="Usted rechazó este documento"
        detalle={firmante.motivoRechazo ? `Motivo registrado: ${firmante.motivoRechazo}` : 'El rechazo quedó registrado.'}
      />
    );
  }

  if (firmante.expiraAt.getTime() < Date.now()) {
    return (
      <AvisoPagina
        titulo="El enlace venció"
        detalle="Por seguridad, los enlaces de firma caducan. Solicite a quien se lo envió que le reenvíe uno nuevo: el documento sigue disponible."
      />
    );
  }

  // Primer acceso: se registra para la constancia (punto 3.5). Nunca bloquea
  // el render, es una metrica probatoria y no una condicion.
  if (!firmante.abiertoAt) {
    await prisma.contratoFirmante
      .update({ where: { id: firmante.id }, data: { abiertoAt: new Date(), estado: 'ABIERTO' } })
      .catch(() => {});
  }

  const datos = descifrarDatos(contrato.datosCifrados);
  const agente = await prisma.agent.findUnique({
    where: { id: contrato.agentId },
    select: {
      fullName: true, company: true, photoUrl: true, idNumber: true, direccion: true,
      referenciaDireccion: true, ciudad: true, phone: true, email: true,
    },
  });

  const doc = construirDocumento({
    tipo,
    version: contrato.plantillaVersion,
    datos,
    agente: {
      nombre: agente?.fullName ?? '—',
      cedula: agente?.idNumber ?? '—',
      ruc: null,
      direccion: [agente?.direccion, agente?.referenciaDireccion, agente?.ciudad].filter(Boolean).join(', ') || 'Quito',
      telefono: agente?.phone ?? '—',
      correo: agente?.email ?? '—',
      ciudad: agente?.ciudad || 'Quito',
    },
    inmueble: {
      descripcion: datos.__inmuebleDescripcion ?? '',
      ubicacion: datos.__inmuebleUbicacion ?? '',
      caracteristicas: datos.__inmuebleCaracteristicas ?? '',
    },
    fecha: contrato.createdAt,
  });

  const plantilla = obtenerPlantilla(tipo, contrato.plantillaVersion);

  // Se convierte a una forma serializable: el componente de cliente no puede
  // recibir funciones.
  let numero = 0;
  const bloques: BloqueVista[] = [];
  if (!plantilla.revisadaPorAbogado) bloques.push({ tipo: 'aviso', texto: plantilla.avisoSinRevisar });
  for (const b of doc.bloques) {
    if (b.tipo === 'clausula') {
      numero += 1;
      bloques.push({ tipo: 'clausula', encabezado: `${romano(numero)}. ${b.titulo}`, texto: b.texto });
    } else if (b.tipo === 'firmas') {
      bloques.push({
        tipo: 'firmas',
        partes: contrato.firmantes.map((f) => ({
          nombre: f.nombre,
          rol: etiquetaRol(tipo, f.rol),
          firmado: f.estado === 'FIRMADO',
        })),
      });
    } else if (b.tipo === 'ficha') {
      bloques.push({ tipo: 'ficha', titulo: b.titulo, filas: b.filas });
    } else {
      bloques.push({ tipo: b.tipo, texto: b.texto });
    }
  }

  return (
    <PanelFirma
      token={token}
      nombreDocumento={nombreDocumento}
      codigo={contrato.codigoVerificacion}
      bloques={bloques}
      firmante={{ nombre: firmante.nombre, rol: etiquetaRol(tipo, firmante.rol), correo: firmante.correo }}
      remitente={{
        nombre: agente?.fullName ?? 'Su agente',
        empresa: agente?.company ?? null,
        photoUrl: agente?.photoUrl ?? null,
      }}
      venceEl={firmante.expiraAt.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}
      // Solo para depuracion de longitud; el texto plano no se expone.
      largoDocumento={bloquesATextoPlano(doc.bloques).length}
      urlPdf={`/firmar/${token}/pdf`}
    />
  );
}

// Evita el warning de headers() sin uso en algunos builds: la pagina es
// dinamica y depende de la solicitud.
export async function generateViewport() {
  await headers();
  return { width: 'device-width', initialScale: 1 };
}
