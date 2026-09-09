import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { tieneAccesoPorAgenteId } from '@/lib/real-estate/access-server';
import { propertyTypeLabelEs } from '@/lib/real-estate/labels';
import { zoneLabel } from '@/lib/real-estate/quito-zones';
import { construirDocumento, bloquesATextoPlano } from './documento';
import { descifrarDatos, descifrarEvidencia, fechaConZona } from './firma';
import { hashDocumento, renderContratoPdf, type FirmanteConstancia } from './pdf';
import { CONTRATO_DEFINICION, FIRMANTES_POR_TIPO, type ContratoTipo } from './tipos';
import { obtenerPlantilla } from './plantillas';

// Piezas compartidas por las rutas de contratos: la guarda de sesion + feature
// y el armado del PDF a partir de una fila de la base.

export async function agenteConContratos(
  request: NextRequest,
): Promise<{ error: NextResponse; agentId?: undefined } | { error?: undefined; agentId: string }> {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };
  }
  // Todo contrato guarda cedulas y direcciones de terceros cifradas. Sin
  // clave de cifrado el modulo NO opera: es preferible negarse con un mensaje
  // claro que guardar datos sensibles en claro o reventar con un 500.
  if (!process.env.ENCRYPTION_KEY) {
    return {
      error: NextResponse.json(
        { error: 'El módulo de contratos no está configurado en este entorno.', code: 'sin_cifrado' },
        { status: 503 },
      ),
    };
  }
  if (!(await tieneAccesoPorAgenteId(session.agentId, 'contratos'))) {
    return {
      error: NextResponse.json(
        { error: 'Los contratos son una función del plan Pro.', code: 'feature_locked' },
        { status: 403 },
      ),
    };
  }
  return { agentId: session.agentId };
}

// Un contrato solo lo ve el agente que lo genero (punto 7.1).
export async function contratoDelAgente(id: string, agentId: string) {
  const contrato = await prisma.contrato.findUnique({ where: { id }, include: { firmantes: true } });
  if (!contrato || contrato.agentId !== agentId) return null;
  return contrato;
}

export function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://redinmo.io').replace(/\/$/, '');
}

// Descripcion del inmueble para el documento. Se congela dentro de
// datosCifrados al crear el contrato; esta funcion la arma la primera vez.
export async function describirInmueble(listingId: string | null, agentId: string) {
  if (!listingId) {
    return { descripcion: 'el inmueble descrito por las partes', ubicacion: '—', caracteristicas: '' };
  }
  const l = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      title: true, propertyType: true, city: true, zone: true, areaM2: true,
      bedrooms: true, bathrooms: true, parkingSpaces: true, managingAgentId: true,
    },
  });
  if (!l || l.managingAgentId !== agentId) {
    return { descripcion: 'el inmueble descrito por las partes', ubicacion: '—', caracteristicas: '' };
  }
  const rasgos = [
    l.areaM2 ? `${l.areaM2} m² de área` : null,
    l.bedrooms ? `${l.bedrooms} dormitorios` : null,
    l.bathrooms ? `${l.bathrooms} baños` : null,
    l.parkingSpaces ? `${l.parkingSpaces} estacionamientos` : null,
  ].filter(Boolean);
  return {
    descripcion: `un ${propertyTypeLabelEs(l.propertyType)} denominado "${l.title}"`,
    ubicacion: [zoneLabel(l.zone ?? '', 'es') || l.zone, l.city].filter(Boolean).join(', ') || 'Quito',
    caracteristicas: rasgos.length > 0 ? `El inmueble cuenta con ${rasgos.join(', ')}.` : '',
  };
}

type ContratoConFirmantes = Awaited<ReturnType<typeof contratoDelAgente>>;

// Arma el PDF de un contrato. Es el mismo camino para la vista previa del
// agente, para el borrador que descarga un firmante y para el documento final:
// lo unico que cambia es si ya hay firmas que poner en la constancia.
export async function construirPdf(contrato: NonNullable<ContratoConFirmantes>): Promise<{ buffer: Buffer; texto: string }> {
  const datos = descifrarDatos(contrato.datosCifrados);
  const tipo = contrato.tipo as ContratoTipo;

  const agente = await prisma.agent.findUnique({
    where: { id: contrato.agentId },
    select: {
      fullName: true, company: true, idNumber: true, licenseNumber: true, direccion: true,
      referenciaDireccion: true, ciudad: true, phone: true, email: true, phoneVerifiedAt: true,
    },
  });

  const inmueble = {
    descripcion: datos.__inmuebleDescripcion ?? 'el inmueble descrito por las partes',
    ubicacion: datos.__inmuebleUbicacion ?? '—',
    caracteristicas: datos.__inmuebleCaracteristicas ?? '',
  };

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
    inmueble,
    fecha: contrato.createdAt,
  });

  const firmantes: FirmanteConstancia[] = contrato.firmantes.map((f) => {
    const evidencia = descifrarEvidencia(f.evidenciaCifrada);
    return {
      rol: etiquetaRol(tipo, f.rol),
      nombre: f.nombre,
      // En la constancia la cedula va enmascarada salvo los ultimos 4: el PDF
      // circula por correo y no hace falta repetir el numero completo.
      cedula: `••••${f.cedulaUlt4}`,
      correo: f.correo,
      enviadoAt: fechaConZona(f.enviadoAt),
      abiertoAt: fechaConZona(f.abiertoAt),
      firmadoAt: fechaConZona(f.firmadoAt),
      ip: evidencia?.ip ?? null,
      navegador: evidencia?.userAgent ?? null,
      leyoCompleto: Boolean(evidencia?.leyoCompleto),
    };
  });

  const plantilla = obtenerPlantilla(contrato.plantillaVersion);
  const texto = bloquesATextoPlano(doc.bloques);

  const buffer = await renderContratoPdf({
    bloques: doc.bloques,
    nombreDocumento: CONTRATO_DEFINICION[tipo].nombreDocumento,
    ciudad: agente?.ciudad || 'Quito',
    fechaLarga: contrato.createdAt.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' }),
    agente: {
      nombre: agente?.fullName ?? '—',
      empresa: agente?.company ?? null,
      correo: agente?.email ?? '—',
      telefono: agente?.phone ?? '—',
      verificado: Boolean(agente?.idNumber) && Boolean(agente?.phoneVerifiedAt),
    },
    plantillaVersion: contrato.plantillaVersion,
    avisoSinRevisar: plantilla.revisadaPorAbogado ? null : plantilla.avisoSinRevisar,
    codigoVerificacion: contrato.codigoVerificacion,
    hashDocumento: contrato.hashDocumento,
    firmantes,
    urlVerificacion: `${baseUrl().replace(/^https?:\/\//, '')}/c/${contrato.codigoVerificacion}`,
  });

  return { buffer, texto };
}

export function etiquetaRol(tipo: ContratoTipo, rol: string): string {
  return FIRMANTES_POR_TIPO[tipo].find((f) => f.rol === rol)?.etiqueta ?? rol;
}

// El hash que se sella al completarse la firma: sobre el TEXTO del documento,
// no sobre el PDF. El PDF se rasteriza y su binario puede variar entre
// renders; el texto es lo que las partes aceptaron.
export function calcularHash(texto: string, codigoVerificacion: string): string {
  return hashDocumento(`${codigoVerificacion}\n${texto}`);
}

export function nombreArchivoContrato(tipo: ContratoTipo, codigo: string): string {
  const base = CONTRATO_DEFINICION[tipo].nombreDocumento.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  return `${base}-${codigo}.pdf`;
}
