import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { tieneAccesoPorAgenteId } from '@/lib/real-estate/access-server';
import { propertyTypeLabelEs } from '@/lib/real-estate/labels';
import { zoneLabel } from '@/lib/real-estate/quito-zones';
import { prepararDocumento, type DatosAgenteDocumento, type DocumentoPreparado, type EntradaDocumento } from './documento';
import {
  descifrarDatos,
  descifrarDocumento,
  descifrarEvidencia,
  fechaConZona,
  fechaLarga,
  type DocumentoCongelado,
} from './aprobacion';
import { compararVersiones, sinCambios, type BloqueFinal, type CambiosEntreVersiones, type LineaFirma } from './clausulas';
import { LEYENDA_FIRMAS_ELECTRONICAS, NOTA_FIRMA_RETIRADA } from './legado-firma';
import { renderContratoPdf, type AnexoAprobacion, type ParteConstancia } from './pdf';
import { CONTRATO_DEFINICION, PARTES_POR_TIPO, esEstadoDeFirmaLegado, esTipoArchivado, type ContratoTipo } from './tipos';

// Piezas compartidas por las rutas de contratos: la guarda de sesión + feature,
// el documento de trabajo, las versiones congeladas y el armado de los PDF.

// Toda negativa y todo fallo del módulo deja una línea en el log del servidor,
// con el motivo y el agente afectado. Nunca se registra el valor de un secreto
// ni dato de una parte: solo el motivo, el agente y, cuando hay excepción, su
// mensaje.
export function logContratos(
  motivo: string,
  datos: { agentId?: string; contratoId?: string; error?: unknown } = {},
): void {
  const partes = [`[contratos] ${motivo}`];
  if (datos.agentId) partes.push(`agente=${datos.agentId}`);
  if (datos.contratoId) partes.push(`contrato=${datos.contratoId}`);
  if (datos.error !== undefined) {
    const e = datos.error;
    partes.push(`error=${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
  }
  console.error(partes.join(' | '));
  if (datos.error instanceof Error && datos.error.stack) console.error(datos.error.stack);
}

export async function agenteConContratos(
  request: NextRequest,
): Promise<{ error: NextResponse; agentId?: undefined } | { error?: undefined; agentId: string }> {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };
  }
  // Todo contrato guarda cédulas y direcciones de terceros cifradas. Sin
  // clave de cifrado el módulo NO opera: es preferible negarse con un mensaje
  // claro que guardar datos sensibles en claro o reventar con un 500.
  if (!process.env.ENCRYPTION_KEY) {
    logContratos('ENCRYPTION_KEY no está definida en este entorno: el módulo se niega a operar', {
      agentId: session.agentId,
    });
    return {
      error: NextResponse.json(
        {
          error:
            'El módulo de contratos no está configurado en este entorno. Falta la clave de cifrado con la que se protegen los datos de las partes.',
          code: 'sin_cifrado',
        },
        { status: 503 },
      ),
    };
  }
  if (!(await tieneAccesoPorAgenteId(session.agentId, 'contratos'))) {
    logContratos('acceso denegado: la función es del plan Pro', { agentId: session.agentId });
    return {
      error: NextResponse.json(
        { error: 'Los contratos son una función del plan Pro.', code: 'feature_locked' },
        { status: 403 },
      ),
    };
  }
  return { agentId: session.agentId };
}

// Un contrato solo lo ve el agente que lo generó.
export async function contratoDelAgente(id: string, agentId: string) {
  const contrato = await prisma.contrato.findUnique({
    where: { id },
    include: { partes: { orderBy: { enviadoAt: 'asc' } }, versiones: { orderBy: { numero: 'asc' } } },
  });
  if (!contrato || contrato.agentId !== agentId) return null;
  return contrato;
}

export type ContratoCompleto = NonNullable<Awaited<ReturnType<typeof contratoDelAgente>>>;
type VersionFila = ContratoCompleto['versiones'][number];
type ParteFila = ContratoCompleto['partes'][number];

export function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://redinmo.io').replace(/\/$/, '');
}

// Descripción del inmueble para el documento. Se congela dentro de
// datosCifrados al crear el contrato; esta función la arma la primera vez.
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

// ---------------------------------------------------------------------------
// Agente y documento de trabajo
// ---------------------------------------------------------------------------

export type PerfilAgente = {
  documento: DatosAgenteDocumento;
  nombre: string;
  empresa: string | null;
  correo: string | null;
  cedula: string | null;
  photoUrl: string | null;
};

export async function perfilAgente(agentId: string): Promise<PerfilAgente> {
  const a = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      fullName: true, company: true, idNumber: true, licenseNumber: true, direccion: true,
      referenciaDireccion: true, ciudad: true, phone: true, email: true, photoUrl: true,
    },
  });
  return {
    documento: {
      nombre: a?.fullName ?? '—',
      cedula: a?.idNumber ?? '—',
      ruc: null,
      licencia: a?.licenseNumber ?? null,
      direccion: [a?.direccion, a?.referenciaDireccion, a?.ciudad].filter(Boolean).join(', ') || 'Quito',
      telefono: a?.phone ?? '—',
      correo: a?.email ?? '—',
      ciudad: a?.ciudad || 'Quito',
    },
    nombre: a?.fullName ?? 'Su agente',
    empresa: a?.company ?? null,
    correo: a?.email ?? null,
    cedula: a?.idNumber ?? null,
    photoUrl: a?.photoUrl ?? null,
  };
}

export function entradaDocumento(
  contrato: { tipo: string; plantillaVersion: string; createdAt: Date },
  datos: Record<string, string>,
  perfil: PerfilAgente,
): EntradaDocumento {
  return {
    tipo: contrato.tipo as ContratoTipo,
    version: contrato.plantillaVersion,
    datos,
    agente: perfil.documento,
    inmueble: {
      descripcion: datos.__inmuebleDescripcion ?? 'el inmueble descrito por las partes',
      ubicacion: datos.__inmuebleUbicacion ?? '—',
      caracteristicas: datos.__inmuebleCaracteristicas ?? '',
    },
    fecha: contrato.createdAt,
  };
}

export type DocumentoDeTrabajo = {
  preparado: DocumentoPreparado;
  datos: Record<string, string>;
  perfil: PerfilAgente;
  ciudad: string;
  fechaLarga: string;
};

// La copia de trabajo: lo que el agente está editando, con las ediciones de
// cláusulas aplicadas. Es lo que se congela al enviar la versión siguiente.
export async function documentoDeTrabajo(contrato: ContratoCompleto, perfil?: PerfilAgente): Promise<DocumentoDeTrabajo> {
  const datos = descifrarDatos(contrato.datosCifrados);
  const p = perfil ?? (await perfilAgente(contrato.agentId));
  return {
    preparado: prepararDocumento(entradaDocumento(contrato, datos, p)),
    datos,
    perfil: p,
    ciudad: p.documento.ciudad,
    fechaLarga: fechaLarga(contrato.createdAt),
  };
}

export function ultimaVersion(contrato: ContratoCompleto): VersionFila | null {
  return contrato.versiones.find((v) => v.numero === contrato.versionActual) ?? null;
}

export function congelada(version: VersionFila): DocumentoCongelado | null {
  return descifrarDocumento(version.documentoCifrado);
}

// Qué cambió en la copia de trabajo desde la última versión enviada. null si
// nunca se envió.
export function cambiosSinEnviar(contrato: ContratoCompleto, bloques: BloqueFinal[]): CambiosEntreVersiones | null {
  const ultima = ultimaVersion(contrato);
  const doc = ultima ? congelada(ultima) : null;
  return doc ? compararVersiones(doc.bloques, bloques) : null;
}

// Un contrato de la etapa de firma electrónica: se reimprime con su leyenda y
// su constancia de firma, tal como se firmó.
export function esContratoDeFirma(contrato: ContratoCompleto): boolean {
  return esEstadoDeFirmaLegado(contrato.estado) || contrato.partes.some((p) => !p.versionId);
}

// ---------------------------------------------------------------------------
// Partes y rótulos
// ---------------------------------------------------------------------------

export function etiquetaRol(tipo: ContratoTipo, rol: string): string {
  return PARTES_POR_TIPO[tipo]?.find((f) => f.rol === rol)?.etiqueta ?? rol;
}

// Compañía por la que aprueba una parte, leída del documento congelado: la
// fila guarda a la persona que aprueba, la línea de firma sabe por quién.
function enNombreDe(doc: DocumentoCongelado | null, tipo: ContratoTipo, rol: string): string | null {
  const firmas = doc?.bloques.find((b): b is Extract<BloqueFinal, { tipo: 'firmas' }> => b.tipo === 'firmas');
  const calidad = etiquetaRol(tipo, rol).toUpperCase();
  return firmas?.partes.find((p) => p.calidad === calidad)?.enRepresentacionDe?.razonSocial ?? null;
}

export function nombreDeParte(doc: DocumentoCongelado | null, tipo: ContratoTipo, parte: { rol: string; nombre: string }): string {
  return enNombreDe(doc, tipo, parte.rol) ?? parte.nombre;
}

function unirNombres(nombres: string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? '';
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

const RESULTADO_VERSION: Record<string, string> = {
  EN_APROBACION: 'En revisión',
  APROBADA: 'Aprobada por todas las partes',
  RECHAZADA: 'No aprobada',
  REEMPLAZADA: 'Reemplazada por una versión posterior',
  ANULADA: 'Anulada',
};

// El pie de cada página del cuerpo: en qué estado está esa versión. Nunca marca
// de la plataforma.
export function pieDeVersion(contrato: ContratoCompleto, version: VersionFila, doc: DocumentoCongelado | null): string {
  const partes = contrato.partes.filter((p) => p.versionId === version.id);
  if (version.estado === 'APROBADA' && version.aprobadaAt) {
    const nombres = partes.map((p) => nombreDeParte(doc, contrato.tipo as ContratoTipo, p));
    return `Versión ${version.numero} — aprobada por ${unirNombres(nombres)} el ${fechaLarga(version.aprobadaAt)}`;
  }
  if (version.estado === 'EN_APROBACION') return `Borrador · versión ${version.numero}, en revisión por las partes`;
  if (version.estado === 'RECHAZADA') return `Borrador · versión ${version.numero}, no aprobada`;
  if (version.estado === 'REEMPLAZADA') return `Borrador · versión ${version.numero}, reemplazada por una versión posterior`;
  return `Borrador · versión ${version.numero}, anulada`;
}

export function nombreArchivoContrato(
  tipo: ContratoTipo,
  codigo: string,
  opciones: { version?: number; extension?: 'pdf' | 'docx' } = {},
): string {
  const base = CONTRATO_DEFINICION[tipo].nombreDocumento
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]+/g, '-')
    .replace(/^-|-$/g, '');
  const version = opciones.version ? `-v${opciones.version}` : '';
  return `${base}-${codigo}${version}.${opciones.extension ?? 'pdf'}`;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

// PDF de una versión enviada, con la constancia de aprobación como anexo.
export async function pdfDeVersion(contrato: ContratoCompleto, numero: number): Promise<Buffer | null> {
  const version = contrato.versiones.find((v) => v.numero === numero);
  if (!version) return null;
  const doc = congelada(version);
  if (!doc) {
    logContratos('no se pudo descifrar el documento congelado de una versión', { contratoId: contrato.id });
    return null;
  }
  const tipo = contrato.tipo as ContratoTipo;
  const perfil = await perfilAgente(contrato.agentId);

  const partes: ParteConstancia[] = contrato.partes
    .filter((p) => p.versionId === version.id)
    .map((p) => constanciaDeParte(p, version, doc, tipo));

  const anexo: AnexoAprobacion = {
    tipo: 'aprobacion',
    nombreDocumento: doc.nombreDocumento,
    codigo: contrato.codigoVerificacion,
    urlVerificacion: `${baseUrl().replace(/^https?:\/\//, '')}/c/${contrato.codigoVerificacion}`,
    numero: version.numero,
    estadoVersion: RESULTADO_VERSION[version.estado] ?? version.estado,
    enviadaAt: fechaConZona(version.enviadaAt) ?? '—',
    enviadaPor: perfil.nombre,
    huella: version.huella,
    partes,
    historial: contrato.versiones
      .filter((v) => v.numero <= version.numero)
      .map((v) => ({
        numero: v.numero,
        enviadaAt: fechaLarga(v.enviadaAt),
        resultado: resultadoDeVersion(contrato, v),
      })),
  };

  return renderContratoPdf({
    bloques: doc.bloques,
    nombreDocumento: doc.nombreDocumento,
    ciudad: doc.ciudad,
    fechaLarga: doc.fechaLarga,
    avisoSinRevisar: doc.avisoSinRevisar,
    pie: pieDeVersion(contrato, version, doc),
    anexo,
  });
}

function constanciaDeParte(p: ParteFila, version: VersionFila, doc: DocumentoCongelado, tipo: ContratoTipo): ParteConstancia {
  const evidencia = descifrarEvidencia(p.evidenciaCifrada);
  const decision: ParteConstancia['decision'] =
    p.estado === 'APROBADO'
      ? 'APROBO'
      : p.estado === 'RECHAZADO'
        ? 'NO_APROBO'
        : version.estado === 'EN_APROBACION'
          ? 'PENDIENTE'
          : 'SIN_DECISION';
  return {
    rol: etiquetaRol(tipo, p.rol),
    nombre: p.nombre,
    enNombreDe: enNombreDe(doc, tipo, p.rol),
    // Enmascarada: el PDF circula por correo y el número completo ya está en
    // el cuerpo del contrato.
    cedula: `••••${p.cedulaUlt4}`,
    correo: p.correo,
    enviadoAt: fechaConZona(p.enviadoAt),
    abiertoAt: fechaConZona(p.abiertoAt),
    decision,
    decisionAt: fechaConZona(p.aprobadoAt ?? p.rechazadoAt),
    motivo: p.motivoRechazo,
    ip: evidencia?.ip ?? null,
    navegador: evidencia?.userAgent ?? null,
    leyoCompleto: Boolean(evidencia?.leyoCompleto),
  };
}

// Una línea del recorrido: qué pasó con esa versión y quién decidió qué.
export function resultadoDeVersion(contrato: ContratoCompleto, version: VersionFila): string {
  const doc = congelada(version);
  const tipo = contrato.tipo as ContratoTipo;
  const partes = contrato.partes.filter((p) => p.versionId === version.id);
  if (version.estado === 'APROBADA') {
    return `Aprobada por ${unirNombres(partes.map((p) => nombreDeParte(doc, tipo, p)))}`;
  }
  if (version.estado === 'RECHAZADA') {
    const quien = partes.find((p) => p.estado === 'RECHAZADO');
    return quien ? `No aprobada por ${nombreDeParte(doc, tipo, quien)}: "${quien.motivoRechazo ?? ''}"` : 'No aprobada';
  }
  return RESULTADO_VERSION[version.estado] ?? version.estado;
}

// PDF de la copia de trabajo, sin anexo: todavía no hay nada que constar.
export async function pdfDeTrabajo(contrato: ContratoCompleto): Promise<Buffer> {
  const trabajo = await documentoDeTrabajo(contrato);
  const pie =
    contrato.versionActual === 0
      ? 'Borrador sin enviar'
      : `Borrador con cambios sobre la versión ${contrato.versionActual}, sin enviar`;
  return renderContratoPdf({
    bloques: trabajo.preparado.bloques,
    nombreDocumento: trabajo.preparado.nombreDocumento,
    ciudad: trabajo.ciudad,
    fechaLarga: trabajo.fechaLarga,
    avisoSinRevisar: trabajo.preparado.revisadaPorAbogado ? null : trabajo.preparado.avisoSinRevisar,
    pie,
    anexo: null,
  });
}

// Contratos de la etapa de firma electrónica: el cuerpo sin marca, como todos,
// pero con sus firmantes, su leyenda y su constancia de firma tal como fueron.
export async function pdfDeFirmaLegado(contrato: ContratoCompleto): Promise<Buffer> {
  const tipo = contrato.tipo as ContratoTipo;
  const datos = descifrarDatos(contrato.datosCifrados);
  const perfil = await perfilAgente(contrato.agentId);
  const firmantes = contrato.partes.filter((p) => !p.versionId);

  const lineas: LineaFirma[] = firmantes.map((f) => ({
    calidad: etiquetaRol(tipo, f.rol),
    nombre: f.nombre,
    documento: `••••${f.cedulaUlt4}`,
    tipoDocumento: 'C.C./RUC',
    enRepresentacionDe: null,
  }));
  const preparado = prepararDocumento(entradaDocumento(contrato, datos, perfil), {
    leyenda: firmantes.length > 0 ? LEYENDA_FIRMAS_ELECTRONICAS : null,
    partes: lineas,
  });

  const hayFirmas = firmantes.some((f) => f.firmadoAt);
  return renderContratoPdf({
    bloques: preparado.bloques,
    nombreDocumento: preparado.nombreDocumento,
    ciudad: perfil.documento.ciudad,
    fechaLarga: fechaLarga(contrato.createdAt),
    avisoSinRevisar: preparado.revisadaPorAbogado ? null : preparado.avisoSinRevisar,
    pie:
      contrato.estado === 'FIRMADO' && contrato.firmadoAt
        ? `Documento firmado electrónicamente el ${fechaLarga(contrato.firmadoAt)}`
        : contrato.estado === 'PENDIENTE_FIRMA'
          ? 'Firma electrónica no concluida'
          : null,
    anexo: hayFirmas
      ? {
          tipo: 'firma-legado',
          nombreDocumento: preparado.nombreDocumento,
          codigo: contrato.codigoVerificacion,
          urlVerificacion: `${baseUrl().replace(/^https?:\/\//, '')}/c/${contrato.codigoVerificacion}`,
          hash: contrato.hashDocumento,
          nota: contrato.estado === 'FIRMADO' ? null : NOTA_FIRMA_RETIRADA,
          firmantes: firmantes.map((f) => {
            const evidencia = descifrarEvidencia(f.evidenciaCifrada);
            return {
              rol: etiquetaRol(tipo, f.rol),
              nombre: f.nombre,
              cedula: `••••${f.cedulaUlt4}`,
              correo: f.correo,
              enviadoAt: fechaConZona(f.enviadoAt),
              abiertoAt: fechaConZona(f.abiertoAt),
              firmadoAt: fechaConZona(f.firmadoAt),
              ip: evidencia?.ip ?? null,
              navegador: evidencia?.userAgent ?? null,
              leyoCompleto: Boolean(evidencia?.leyoCompleto),
            };
          }),
        }
      : null,
  });
}

// Lo que baja el agente cuando pide "el PDF" sin decir cuál: si la copia de
// trabajo coincide con la última versión enviada, esa versión con su constancia;
// si tiene cambios sin enviar, el borrador.
export async function pdfPredeterminado(contrato: ContratoCompleto): Promise<{ buffer: Buffer; version: number | null }> {
  if (esContratoDeFirma(contrato) || esTipoArchivado(contrato.tipo)) {
    return { buffer: await pdfDeFirmaLegado(contrato), version: null };
  }
  if (contrato.versionActual > 0) {
    const trabajo = await documentoDeTrabajo(contrato);
    const cambios = cambiosSinEnviar(contrato, trabajo.preparado.bloques);
    if (cambios && sinCambios(cambios)) {
      const buffer = await pdfDeVersion(contrato, contrato.versionActual);
      if (buffer) return { buffer, version: contrato.versionActual };
    }
  }
  return { buffer: await pdfDeTrabajo(contrato), version: null };
}
