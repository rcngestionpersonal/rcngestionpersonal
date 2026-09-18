import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { encryptAtRest } from '@/lib/real-estate/payments/encryption';
import {
  cifrarDatos,
  cifrarDocumento,
  cifrarEvidencia,
  cifrarToken,
  coincidenUltimos4,
  descifrarDatos,
  fechaExpiracion,
  generarToken,
  huellaTexto,
  mensajeDigitosIncorrectos,
  MAX_INTENTOS_CEDULA,
  ultimos4,
  type DocumentoCongelado,
} from './aprobacion';
import { sinCambios, type CambiosEntreVersiones } from './clausulas';
import { registrarEvento, type Solicitud } from './eventos';
import {
  camposCambiados,
  estadoDelContrato,
  etapaCompleta,
  parteHabilitada,
  primeraEtapa,
} from './flujo';
import {
  cambiosSinEnviar,
  documentoDeTrabajo,
  esContratoDeFirma,
  etiquetaRol,
  huellaDeCondiciones,
  ultimaVersion,
  type ContratoCompleto,
  type PerfilAgente,
} from './servidor';
import {
  CONTRATO_DEFINICION,
  DECLARACION_APROBACION,
  camposFaltantes,
  correoValido,
  esEditable,
  esTipoArchivado,
  etiquetasEtapas,
  identidadParte,
  ladoRepresentado,
  rolesAdicionales,
  rolesPorEtapa,
  vigenciaPorDefectoHoras,
  type ContratoEstado,
  type ContratoTipo,
  type Etapa,
} from './tipos';

// Versiones de un contrato y su recorrido por las etapas.
//
// Dos reglas de fondo:
//   1. Una versión enviada no cambia nunca. Lo que el agente edite después va a
//      la copia de trabajo y sale como la versión siguiente.
//   2. La contraparte solo recibe una versión que la parte principal ya aprobó,
//      y solo cuando el agente decide enviársela. Nada de esto se confía al
//      navegador: cada acceso de una parte vuelve a comprobarlo aquí.

export type EnlaceParte = {
  parteId: string;
  nombre: string;
  correo: string;
  telefono: string;
  rol: string;
  rolEtiqueta: string;
  etapa: Etapa;
  token: string;
  expiraAt: Date;
};

export type OpcionesEnvio = {
  // A qué etapa va este envío.
  destino: Etapa;
  // Opción avanzada: la principal y la contraparte a la vez. Apagada por defecto.
  simultaneo: boolean;
  // Solo cambian datos de la contraparte: la aprobación de la principal se
  // conserva. El servidor comprueba que sea así.
  correccionMenor: boolean;
  vigenciaHoras: number;
};

type Error = {
  ok: false;
  status: number;
  error: string;
  code: string;
  faltantes?: string[];
  // Dígitos de la cédula que no coinciden: intentos que le quedan a la parte.
  restantes?: number;
  // Este intento fue el que bloqueó el enlace: hay que avisar al agente.
  recienBloqueado?: boolean;
};

export type ResultadoEnvio =
  | {
      ok: true;
      numero: number;
      etapa: Etapa;
      simultaneo: boolean;
      nombreDocumento: string;
      enlaces: EnlaceParte[];
      cambios: CambiosEntreVersiones | null;
      // Corrección menor: qué campos cambiaron y a quién de la principal avisar.
      correccion: { campos: string[]; base: number; avisar: Array<{ nombre: string; correo: string; telefono: string }> } | null;
    }
  | Error;

type VersionFila = ContratoCompleto['versiones'][number];
type ParteFila = ContratoCompleto['partes'][number];

type Aprobador = { rol: string; etapa: Etapa; nombre: string; cedula: string; correo: string; telefono: string };

function fallo(status: number, code: string, error: string, extra: Partial<Error> = {}): Error {
  return { ok: false, status, code, error, ...extra };
}

class ConflictoDeVersion extends globalThis.Error {}

const conflicto = () =>
  fallo(409, 'conflicto', 'El contrato cambió mientras lo enviabas. Recarga y vuelve a intentarlo.');

// Quiénes aprueban en cada etapa, con las demás personas de cada lado. Sale de
// la definición del tipo y de los datos guardados, nunca de lo que mande el
// navegador. El agente no se aprueba a sí mismo: enviar es su conformidad.
function aprobadores(
  tipo: ContratoTipo,
  representa: string | null,
  datos: Record<string, string>,
  etapas: Etapa[],
): { ok: true; lista: Aprobador[] } | Error {
  const roles = rolesPorEtapa(tipo, representa);
  const lista: Aprobador[] = [];
  for (const etapa of etapas) {
    for (const base of roles[etapa]) {
      for (const rol of [base, ...rolesAdicionales(tipo, datos, base)]) {
        const identidad = identidadParte(tipo, datos, rol);
        const { nombre, cedula } = identidad.aprobador;
        const correo = identidad.correo.trim();
        if (!nombre || ultimos4(cedula).length < 4 || (correo && !correoValido(correo))) {
          return fallo(
            400,
            'parte_incompleta',
            `Faltan datos de ${etiquetaRol(tipo, rol).toLowerCase()}, o la cédula o el correo no son válidos.`,
          );
        }
        lista.push({ rol, etapa, nombre, cedula, correo, telefono: identidad.telefono.trim() });
      }
    }
  }
  return { ok: true, lista };
}

function partesDeVersion(contrato: ContratoCompleto, version: VersionFila): ParteFila[] {
  return contrato.partes.filter((p) => p.versionId === version.id);
}

async function crearPartes(
  tx: Prisma.TransactionClient,
  contratoId: string,
  versionId: string,
  lista: Aprobador[],
  expiraAt: Date,
  ahora: Date,
): Promise<Array<{ fila: { id: string }; aprobador: Aprobador; token: string }>> {
  const creadas = [];
  for (const a of lista) {
    const { token, hash } = generarToken();
    const fila = await tx.contratoParte.create({
      data: {
        contratoId,
        versionId,
        rol: a.rol,
        etapa: a.etapa,
        nombre: a.nombre,
        correo: a.correo,
        cedulaCifrada: encryptAtRest(a.cedula),
        cedulaUlt4: ultimos4(a.cedula),
        tokenHash: hash,
        tokenCifrado: cifrarToken(token),
        expiraAt,
        enviadoAt: ahora,
      },
      select: { id: true },
    });
    creadas.push({ fila, aprobador: a, token });
  }
  return creadas;
}

function aEnlaces(tipo: ContratoTipo, creadas: Awaited<ReturnType<typeof crearPartes>>, expiraAt: Date): EnlaceParte[] {
  return creadas.map(({ fila, aprobador, token }) => ({
    parteId: fila.id,
    nombre: aprobador.nombre,
    correo: aprobador.correo,
    telefono: aprobador.telefono,
    rol: aprobador.rol,
    rolEtiqueta: etiquetaRol(tipo, aprobador.rol),
    etapa: aprobador.etapa,
    token,
    expiraAt,
  }));
}

// ---------------------------------------------------------------------------
// Envío
// ---------------------------------------------------------------------------

export async function enviar(
  contrato: ContratoCompleto,
  perfil: PerfilAgente,
  opciones: OpcionesEnvio,
  solicitud: Solicitud,
): Promise<ResultadoEnvio> {
  const tipo = contrato.tipo as ContratoTipo;
  if (esTipoArchivado(tipo)) return fallo(409, 'tipo_archivado', 'Este tipo de contrato fue retirado y ya no se envía.');
  if (esContratoDeFirma(contrato) || !esEditable(contrato.estado, tipo)) {
    return fallo(409, 'no_editable', 'Este contrato ya no admite versiones nuevas.');
  }
  if (!perfil.cedula) {
    return fallo(409, 'agente_sin_cedula', 'Necesitas tu cédula registrada en el perfil para emitir contratos.');
  }

  const trabajo = await documentoDeTrabajo(contrato, perfil);
  const visibles = Object.fromEntries(Object.entries(trabajo.datos).filter(([k]) => !k.startsWith('__')));
  const faltantes = camposFaltantes(tipo, visibles);
  if (faltantes.length > 0) return fallo(400, 'incompleto', 'Faltan datos obligatorios.', { faltantes });

  const anterior = ultimaVersion(contrato);
  const cambios = cambiosSinEnviar(contrato, trabajo.preparado.bloques);
  const ladoActual = ladoRepresentado(tipo, contrato.representa)?.clave ?? null;
  const ladoAnterior = anterior ? (ladoRepresentado(tipo, anterior.representa)?.clave ?? null) : null;
  // Cambiar a quién representa el agente cambia el orden de las etapas: cuenta
  // como cambio aunque el texto sea el mismo.
  const hayCambios = !anterior || !cambios || !sinCambios(cambios) || ladoActual !== ladoAnterior;
  const primera = primeraEtapa(tipo, contrato.representa);
  if (!primera) return fallo(409, 'sin_partes', 'Este documento no tiene partes que aprueben.');

  const etiquetas = etiquetasEtapas(tipo, contrato.representa);
  const ctx = { contrato, perfil, trabajo, visibles, anterior, cambios, opciones, solicitud };

  if (opciones.destino === primera) {
    if (!hayCambios && anterior && (anterior.estado === 'EN_APROBACION' || anterior.estado === 'APROBADA')) {
      return fallo(
        409,
        'sin_cambios',
        `No hay cambios respecto de la versión ${anterior.numero}. Si alguien no recibió el enlace, compártelo o regenéralo desde el recorrido.`,
      );
    }
    return nuevaVersion(ctx, primera);
  }

  // Destino: la contraparte, en un documento que tiene etapa principal.
  if (rolesPorEtapa(tipo, contrato.representa).CONTRAPARTE.length === 0) {
    return fallo(409, 'sin_contraparte', 'Este documento no tiene contraparte: lo aprueba solo tu cliente.');
  }
  if (!anterior) {
    return fallo(409, 'primero_principal', `Primero lo revisa y aprueba ${etiquetas.PRINCIPAL?.toLowerCase() ?? 'tu cliente'}.`);
  }
  if (!hayCambios) return habilitarContraparte(ctx, anterior);
  if (opciones.correccionMenor) return correccionMenor(ctx, anterior);
  return fallo(
    409,
    'requiere_principal',
    `La versión nueva tiene cambios: primero la aprueba ${etiquetas.PRINCIPAL?.toLowerCase() ?? 'tu cliente'}.`,
  );
}

type Contexto = {
  contrato: ContratoCompleto;
  perfil: PerfilAgente;
  trabajo: Awaited<ReturnType<typeof documentoDeTrabajo>>;
  visibles: Record<string, string>;
  anterior: VersionFila | null;
  cambios: CambiosEntreVersiones | null;
  opciones: OpcionesEnvio;
  solicitud: Solicitud;
};

function congelar(ctx: Contexto, numero: number): DocumentoCongelado {
  const p = ctx.trabajo.preparado;
  return {
    formato: 1,
    tipo: ctx.contrato.tipo as ContratoTipo,
    numero,
    nombreDocumento: p.nombreDocumento,
    ciudad: ctx.trabajo.ciudad,
    fechaLarga: ctx.trabajo.fechaLarga,
    plantillaVersion: p.version,
    avisoSinRevisar: p.revisadaPorAbogado ? null : p.avisoSinRevisar,
    bloques: p.bloques,
  };
}

// Cierra la versión que estaba en revisión: queda reemplazada y sus enlaces
// dejan de admitir decisión.
async function reemplazar(tx: Prisma.TransactionClient, version: VersionFila | null, ahora: Date) {
  if (!version || version.estado !== 'EN_APROBACION') return;
  await tx.contratoVersion.update({ where: { id: version.id }, data: { estado: 'REEMPLAZADA', cerradaAt: ahora } });
  await tx.contratoParte.updateMany({ where: { versionId: version.id, estado: { in: ['ENVIADO', 'ABIERTO'] } }, data: { expiraAt: ahora } });
}

// Versión nueva a la primera etapa (y, si el agente lo eligió, también a la
// contraparte).
async function nuevaVersion(ctx: Contexto, primera: Etapa): Promise<ResultadoEnvio> {
  const { contrato, trabajo, opciones } = ctx;
  const tipo = contrato.tipo as ContratoTipo;
  const roles = rolesPorEtapa(tipo, contrato.representa);
  const simultaneo = opciones.simultaneo && primera === 'PRINCIPAL' && roles.CONTRAPARTE.length > 0;
  const etapas: Etapa[] = simultaneo ? ['PRINCIPAL', 'CONTRAPARTE'] : [primera];
  const quienes = aprobadores(tipo, contrato.representa, ctx.visibles, etapas);
  if (!quienes.ok) return quienes;

  const numero = contrato.versionActual + 1;
  const congelado = congelar(ctx, numero);
  const huellaCondiciones = huellaDeCondiciones(contrato, trabajo.datos, ctx.perfil, contrato.representa);
  const ahora = new Date();
  const expira = fechaExpiracion(opciones.vigenciaHoras, ahora);

  try {
    const creadas = await prisma.$transaction(async (tx) => {
      const tomado = await tx.contrato.updateMany({
        where: { id: contrato.id, versionActual: contrato.versionActual, estado: contrato.estado },
        data: {
          estado: primera === 'PRINCIPAL' ? 'EN_REVISION_PRINCIPAL' : 'EN_REVISION_CONTRAPARTE',
          versionActual: numero,
          enviadoAt: ahora,
          aprobadoAt: null,
          vigenciaHoras: opciones.vigenciaHoras,
        },
      });
      if (tomado.count === 0) throw new ConflictoDeVersion();
      await reemplazar(tx, ctx.anterior, ahora);

      const version = await tx.contratoVersion.create({
        data: {
          contratoId: contrato.id,
          numero,
          plantillaVersion: congelado.plantillaVersion,
          documentoCifrado: cifrarDocumento(congelado),
          huella: huellaTexto(contrato.codigoVerificacion, trabajo.preparado.texto),
          huellaCondiciones,
          datosCifrados: cifrarDatos(trabajo.datos),
          representa: ladoRepresentado(tipo, contrato.representa)?.clave ?? null,
          requierePrincipal: roles.PRINCIPAL.length > 0,
          requiereContraparte: roles.CONTRAPARTE.length > 0,
          simultanea: simultaneo,
          contraparteEnviadaAt: simultaneo || primera === 'CONTRAPARTE' ? ahora : null,
          enviadaAt: ahora,
        },
      });
      const partes = await crearPartes(tx, contrato.id, version.id, quienes.lista, expira, ahora);

      await registrarEvento(tx, {
        contratoId: contrato.id,
        tipo: 'ENVIO',
        actor: 'AGENTE',
        etapa: primera,
        versionNumero: numero,
        huella: version.huella,
        solicitud: ctx.solicitud,
        detalle: { vigenciaHoras: opciones.vigenciaHoras, cambios: ctx.anterior ? ctx.cambios : null },
        fecha: ahora,
      });
      if (simultaneo) {
        await registrarEvento(tx, {
          contratoId: contrato.id,
          tipo: 'ENVIO_SIMULTANEO',
          actor: 'AGENTE',
          etapa: 'CONTRAPARTE',
          versionNumero: numero,
          huella: version.huella,
          solicitud: ctx.solicitud,
          detalle: {
            nota: 'El agente eligió enviar a las dos partes a la vez: la contraparte recibió condiciones que la parte principal aún no había aprobado.',
          },
          fecha: ahora,
        });
      }
      return partes;
    });

    return {
      ok: true,
      numero,
      etapa: primera,
      simultaneo,
      nombreDocumento: CONTRATO_DEFINICION[tipo].nombreDocumento,
      cambios: ctx.anterior ? ctx.cambios : null,
      correccion: null,
      enlaces: aEnlaces(tipo, creadas, expira),
    };
  } catch (error) {
    if (error instanceof ConflictoDeVersion || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
      return conflicto();
    }
    throw error;
  }
}

// La principal ya aprobó la versión vigente y el agente decide enviarla a la
// contraparte, sin cambios.
async function habilitarContraparte(ctx: Contexto, version: VersionFila): Promise<ResultadoEnvio> {
  const { contrato, opciones } = ctx;
  const tipo = contrato.tipo as ContratoTipo;
  const partes = partesDeVersion(contrato, version);
  const etiquetas = etiquetasEtapas(tipo, version.representa);

  if (version.estado !== 'EN_APROBACION') {
    return fallo(
      409,
      'version_cerrada',
      version.estado === 'RECHAZADA'
        ? `Pidieron cambios en la versión ${version.numero}: edita el documento y envía la versión siguiente.`
        : `La versión ${version.numero} ya no está en revisión.`,
    );
  }
  if (!etapaCompleta(version, partes, 'PRINCIPAL')) {
    return fallo(
      409,
      'principal_pendiente',
      `${etiquetas.PRINCIPAL ?? 'Tu cliente'} todavía no aprueba la versión ${version.numero}. La contraparte la recibe solo después.`,
    );
  }
  if (partes.some((p) => p.etapa === 'CONTRAPARTE')) {
    return fallo(409, 'contraparte_ya_enviada', 'La contraparte ya recibió esta versión. Si hace falta, comparte o regenera su enlace.');
  }

  const quienes = aprobadores(tipo, version.representa, ctx.visibles, ['CONTRAPARTE']);
  if (!quienes.ok) return quienes;
  const ahora = new Date();
  const expira = fechaExpiracion(opciones.vigenciaHoras, ahora);

  try {
    const creadas = await prisma.$transaction(async (tx) => {
      const habilitada = await tx.contratoVersion.updateMany({
        where: { id: version.id, estado: 'EN_APROBACION', contraparteEnviadaAt: null },
        data: { contraparteEnviadaAt: ahora },
      });
      if (habilitada.count === 0) throw new ConflictoDeVersion();
      const tomado = await tx.contrato.updateMany({
        where: { id: contrato.id, versionActual: version.numero, estado: contrato.estado },
        data: { estado: 'EN_REVISION_CONTRAPARTE', vigenciaHoras: opciones.vigenciaHoras },
      });
      if (tomado.count === 0) throw new ConflictoDeVersion();
      const nuevas = await crearPartes(tx, contrato.id, version.id, quienes.lista, expira, ahora);
      await registrarEvento(tx, {
        contratoId: contrato.id,
        tipo: 'ENVIO',
        actor: 'AGENTE',
        etapa: 'CONTRAPARTE',
        versionNumero: version.numero,
        huella: version.huella,
        solicitud: ctx.solicitud,
        detalle: { vigenciaHoras: opciones.vigenciaHoras },
        fecha: ahora,
      });
      return nuevas;
    });
    return {
      ok: true,
      numero: version.numero,
      etapa: 'CONTRAPARTE',
      simultaneo: false,
      nombreDocumento: CONTRATO_DEFINICION[tipo].nombreDocumento,
      cambios: null,
      correccion: null,
      enlaces: aEnlaces(tipo, creadas, expira),
    };
  } catch (error) {
    if (error instanceof ConflictoDeVersion) return conflicto();
    throw error;
  }
}

// La contraparte pidió cambios en SUS datos y el agente solo corrigió eso. Sale
// una versión nueva directo a la contraparte y la aprobación de la principal se
// conserva, porque la huella del documento con los datos de la contraparte
// tapados es la misma que la de la versión que aprobó.
async function correccionMenor(ctx: Contexto, anterior: VersionFila): Promise<ResultadoEnvio> {
  const { contrato, trabajo, opciones } = ctx;
  const tipo = contrato.tipo as ContratoTipo;
  const partesAnteriores = partesDeVersion(contrato, anterior);
  const etiquetas = etiquetasEtapas(tipo, anterior.representa);
  const rechazo = partesAnteriores.find((p) => p.estado === 'RECHAZADO');

  if (anterior.estado === 'ANULADA' || anterior.estado === 'REEMPLAZADA' || rechazo?.etapa === 'PRINCIPAL') {
    return fallo(409, 'correccion_no_aplica', 'Esta corrección no puede conservar la aprobación anterior: envía la versión a tu cliente.');
  }
  if (!etapaCompleta(anterior, partesAnteriores, 'PRINCIPAL')) {
    return fallo(409, 'principal_pendiente', `${etiquetas.PRINCIPAL ?? 'Tu cliente'} todavía no aprueba la versión ${anterior.numero}.`);
  }
  const huella = huellaDeCondiciones(contrato, trabajo.datos, ctx.perfil, anterior.representa);
  if (!anterior.huellaCondiciones || anterior.huellaCondiciones !== huella) {
    return fallo(
      409,
      'no_es_correccion_menor',
      `Cambiaste algo más que los datos de ${etiquetas.CONTRAPARTE?.toLowerCase() ?? 'la contraparte'}: la versión nueva va primero a ${etiquetas.PRINCIPAL?.toLowerCase() ?? 'tu cliente'}.`,
    );
  }

  const quienes = aprobadores(tipo, anterior.representa, ctx.visibles, ['CONTRAPARTE']);
  if (!quienes.ok) return quienes;

  const numero = contrato.versionActual + 1;
  const base = anterior.principalHeredadaDe ?? anterior.numero;
  const versionBase = contrato.versiones.find((v) => v.numero === base) ?? anterior;
  const campos = camposCambiados(tipo, descifrarDatos(anterior.datosCifrados ?? ''), trabajo.datos);
  const congelado = congelar(ctx, numero);
  const ahora = new Date();
  const expira = fechaExpiracion(opciones.vigenciaHoras, ahora);

  try {
    const creadas = await prisma.$transaction(async (tx) => {
      const tomado = await tx.contrato.updateMany({
        where: { id: contrato.id, versionActual: contrato.versionActual, estado: contrato.estado },
        data: { estado: 'EN_REVISION_CONTRAPARTE', versionActual: numero, enviadoAt: ahora, aprobadoAt: null, vigenciaHoras: opciones.vigenciaHoras },
      });
      if (tomado.count === 0) throw new ConflictoDeVersion();
      await reemplazar(tx, anterior, ahora);
      const version = await tx.contratoVersion.create({
        data: {
          contratoId: contrato.id,
          numero,
          plantillaVersion: congelado.plantillaVersion,
          documentoCifrado: cifrarDocumento(congelado),
          huella: huellaTexto(contrato.codigoVerificacion, trabajo.preparado.texto),
          huellaCondiciones: huella,
          datosCifrados: cifrarDatos(trabajo.datos),
          representa: anterior.representa,
          requierePrincipal: anterior.requierePrincipal,
          requiereContraparte: true,
          simultanea: false,
          principalHeredadaDe: base,
          principalAprobadaAt: versionBase.principalAprobadaAt ?? anterior.principalAprobadaAt,
          contraparteEnviadaAt: ahora,
          enviadaAt: ahora,
        },
      });
      const nuevas = await crearPartes(tx, contrato.id, version.id, quienes.lista, expira, ahora);
      await registrarEvento(tx, {
        contratoId: contrato.id,
        tipo: 'CORRECCION_MENOR',
        actor: 'AGENTE',
        etapa: 'CONTRAPARTE',
        versionNumero: numero,
        huella: version.huella,
        solicitud: ctx.solicitud,
        detalle: {
          campos,
          base,
          nota: `Solo cambiaron datos de la contraparte. Se conserva la aprobación de la parte principal sobre la versión ${base}: las condiciones son las mismas (misma huella de condiciones).`,
        },
        fecha: ahora,
      });
      await registrarEvento(tx, {
        contratoId: contrato.id,
        tipo: 'ENVIO',
        actor: 'AGENTE',
        etapa: 'CONTRAPARTE',
        versionNumero: numero,
        huella: version.huella,
        solicitud: ctx.solicitud,
        detalle: { vigenciaHoras: opciones.vigenciaHoras, cambios: ctx.cambios },
        fecha: ahora,
      });
      return nuevas;
    });

    // Se avisa a quienes aprobaron por la principal en la versión base.
    const avisar = contrato.partes
      .filter((p) => p.versionId === versionBase.id && p.etapa === 'PRINCIPAL' && p.estado === 'APROBADO')
      .map((p) => ({
        nombre: p.nombre,
        correo: p.correo,
        telefono: identidadParte(tipo, trabajo.datos, p.rol).telefono,
      }));

    return {
      ok: true,
      numero,
      etapa: 'CONTRAPARTE',
      simultaneo: false,
      nombreDocumento: CONTRATO_DEFINICION[tipo].nombreDocumento,
      cambios: ctx.cambios,
      correccion: { campos, base, avisar },
      enlaces: aEnlaces(tipo, creadas, expira),
    };
  } catch (error) {
    if (error instanceof ConflictoDeVersion || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
      return conflicto();
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Enlaces: regenerar, reenviar y vencer
// ---------------------------------------------------------------------------

export type ResultadoEnlace =
  | { ok: true; parte: ParteFila; token: string; expiraAt: Date; estado: ContratoEstado }
  | Error;

// Busca una parte pendiente de la versión vigente. Solo el agente dueño llega
// aquí (la ruta ya lo comprobó).
function partePendiente(contrato: ContratoCompleto, parteId: string): { parte: ParteFila; version: VersionFila } | Error {
  const version = ultimaVersion(contrato);
  if (!version || version.estado !== 'EN_APROBACION') {
    return fallo(409, 'sin_version_en_revision', 'No hay una versión en revisión.');
  }
  const parte = contrato.partes.find((p) => p.id === parteId && p.versionId === version.id);
  if (!parte) return fallo(404, 'parte_no_encontrada', 'Parte no encontrada.');
  if (parte.estado === 'APROBADO' || parte.estado === 'RECHAZADO') {
    return fallo(409, 'ya_decidio', 'Esta persona ya decidió sobre la versión.');
  }
  if (!parteHabilitada(parte, version, partesDeVersion(contrato, version))) {
    return fallo(409, 'contraparte_no_habilitada', 'La contraparte todavía no recibe esta versión.');
  }
  return { parte, version };
}

// Enlace nuevo, con vigencia nueva. El anterior deja de servir en el acto: si
// llegó a quien no debía, ya no abre nada.
export async function regenerarEnlace(
  contrato: ContratoCompleto,
  parteId: string,
  vigenciaHoras: number | null,
  solicitud: Solicitud,
): Promise<ResultadoEnlace> {
  const encontrado = partePendiente(contrato, parteId);
  if ('ok' in encontrado) return encontrado;
  const { parte, version } = encontrado;
  const tipo = contrato.tipo as ContratoTipo;
  const horas = vigenciaHoras ?? contrato.vigenciaHoras ?? vigenciaPorDefectoHoras(tipo);
  const { token, hash } = generarToken();
  const ahora = new Date();
  const expiraAt = fechaExpiracion(horas, ahora);

  const estado = await prisma.$transaction(async (tx) => {
    await tx.contratoParte.update({
      where: { id: parte.id },
      // El enlace nuevo empieza sin intentos fallidos ni bloqueo.
      data: { tokenHash: hash, tokenCifrado: cifrarToken(token), expiraAt, estado: 'ENVIADO', enviadoAt: ahora, abiertoAt: null, intentosFallidos: 0, bloqueadoAt: null },
    });
    const partes = await tx.contratoParte.findMany({ where: { versionId: version.id } });
    const nuevo = estadoDelContrato(version, partes);
    await tx.contrato.updateMany({ where: { id: contrato.id, versionActual: version.numero }, data: { estado: nuevo } });
    await registrarEvento(tx, {
      contratoId: contrato.id,
      tipo: 'REGENERACION',
      actor: 'AGENTE',
      parteId: parte.id,
      rol: parte.rol,
      etapa: parte.etapa,
      versionNumero: version.numero,
      huella: version.huella,
      solicitud,
      detalle: { nombre: parte.nombre, vigenciaHoras: horas },
      fecha: ahora,
    });
    return nuevo;
  });
  return { ok: true, parte: { ...parte, expiraAt }, token, expiraAt, estado };
}

// Deja constancia de que el agente volvió a hacer llegar el enlace vigente.
export async function registrarReenvio(
  contrato: ContratoCompleto,
  parteId: string,
  canal: 'whatsapp' | 'correo',
  solicitud: Solicitud,
): Promise<{ ok: true; parte: ParteFila } | Error> {
  const encontrado = partePendiente(contrato, parteId);
  if ('ok' in encontrado) return encontrado;
  const { parte, version } = encontrado;
  if (parte.bloqueadoAt) {
    return fallo(423, 'enlace_bloqueado', 'El enlace se bloqueó por intentos fallidos. Genera uno nuevo para compartirlo.');
  }
  if (parte.expiraAt.getTime() < Date.now()) {
    return fallo(410, 'enlace_vencido', 'El enlace venció. Regenéralo para enviar uno nuevo.');
  }
  await registrarEvento(prisma, {
    contratoId: contrato.id,
    tipo: 'REENVIO',
    actor: 'AGENTE',
    parteId: parte.id,
    rol: parte.rol,
    etapa: parte.etapa,
    versionNumero: version.numero,
    huella: version.huella,
    solicitud,
    detalle: { nombre: parte.nombre, canal },
  });
  return { ok: true, parte };
}

// Un enlace pendiente que venció deja el contrato en VENCIDO. No hay tarea
// programada: se comprueba cada vez que alguien mira el contrato (el agente en
// su panel o la parte al abrir su enlace), y el cambio se registra una vez.
export async function sincronizarVencimiento(contrato: ContratoCompleto): Promise<ContratoEstado> {
  const version = ultimaVersion(contrato);
  const estado = contrato.estado as ContratoEstado;
  if (!version || (estado !== 'EN_REVISION_PRINCIPAL' && estado !== 'EN_REVISION_CONTRAPARTE')) return estado;
  const partes = partesDeVersion(contrato, version);
  const calculado = estadoDelContrato(version, partes);
  if (calculado !== 'VENCIDO') return estado;

  const cambiado = await prisma.contrato.updateMany({
    where: { id: contrato.id, estado, versionActual: version.numero },
    data: { estado: 'VENCIDO' },
  });
  if (cambiado.count > 0) {
    const vencidas = partes.filter((p) => (p.estado === 'ENVIADO' || p.estado === 'ABIERTO') && p.expiraAt.getTime() < Date.now());
    for (const p of vencidas) {
      await registrarEvento(prisma, {
        contratoId: contrato.id,
        tipo: 'VENCIMIENTO',
        actor: 'SISTEMA',
        parteId: p.id,
        rol: p.rol,
        etapa: p.etapa,
        versionNumero: version.numero,
        huella: version.huella,
        detalle: { nombre: p.nombre },
        fecha: p.expiraAt,
      });
    }
  }
  return 'VENCIDO';
}

// ---------------------------------------------------------------------------
// Lo que decide cada parte
// ---------------------------------------------------------------------------

export async function parteDeToken(tokenHash: string) {
  return prisma.contratoParte.findUnique({
    where: { tokenHash },
    include: { version: true, contrato: { include: { partes: true, versiones: { orderBy: { numero: 'asc' } } } } },
  });
}

export type ParteConContexto = NonNullable<Awaited<ReturnType<typeof parteDeToken>>>;

export type MotivoCerrado =
  | 'firma_retirada'
  | 'cancelado'
  | 'no_disponible'
  | 'reemplazada'
  | 'rechazada_por_otra_parte'
  | 'ya_aprobo'
  | 'ya_rechazo'
  | 'bloqueado'
  | 'vencido';

// Por qué un enlace no admite ver ni decidir, o null si lo admite. Una sola
// función para la página, la API y el PDF: nunca dicen cosas distintas.
export function motivoCerrado(p: ParteConContexto, ahora = Date.now()): MotivoCerrado | null {
  if (!p.version) return 'firma_retirada';
  if (p.contrato.estado === 'ANULADO' || p.version.estado === 'ANULADA') return 'cancelado';
  // La contraparte no ve nada que la principal no haya aprobado y el agente no
  // le haya enviado, aunque tenga un enlace en la mano.
  const partes = p.contrato.partes.filter((x) => x.versionId === p.versionId);
  if (!parteHabilitada(p, p.version, partes)) return 'no_disponible';
  if (p.estado === 'APROBADO') return 'ya_aprobo';
  if (p.estado === 'RECHAZADO') return 'ya_rechazo';
  if (p.version.estado === 'REEMPLAZADA') return 'reemplazada';
  if (p.version.estado === 'RECHAZADA') return 'rechazada_por_otra_parte';
  if (p.bloqueadoAt) return 'bloqueado';
  if (p.expiraAt.getTime() < ahora) return 'vencido';
  return null;
}

// El código HTTP de cada motivo, igual para la API y el PDF.
export function statusDeMotivo(motivo: MotivoCerrado): number {
  if (motivo === 'vencido') return 410;
  if (motivo === 'no_disponible') return 403;
  if (motivo === 'bloqueado') return 423;
  return 409;
}

// Unos dígitos que no coinciden: el intento se cuenta y queda en el historial
// con IP, navegador y fecha. Al llegar a MAX_INTENTOS_CEDULA el enlace se
// bloquea. La cuenta vive en la misma fila y se suma con una condición: aunque
// lleguen muchos intentos a la vez, nunca se cuentan más del límite.
async function registrarIntentoFallido(
  p: ParteConContexto,
  version: NonNullable<ParteConContexto['version']>,
  solicitud: Solicitud,
): Promise<{ bloqueado: boolean; recienBloqueado: boolean; restantes: number }> {
  const ahora = new Date();
  const base = {
    contratoId: p.contratoId,
    parteId: p.id,
    rol: p.rol,
    etapa: p.etapa,
    versionNumero: version.numero,
    huella: version.huella,
    fecha: ahora,
  };
  return prisma.$transaction(async (tx) => {
    const sumado = await tx.contratoParte.updateMany({
      where: { id: p.id, bloqueadoAt: null, intentosFallidos: { lt: MAX_INTENTOS_CEDULA } },
      data: { intentosFallidos: { increment: 1 } },
    });
    // Ya estaba bloqueado: otro intento llegó primero al límite.
    if (sumado.count === 0) return { bloqueado: true, recienBloqueado: false, restantes: 0 };
    const fila = await tx.contratoParte.findUnique({ where: { id: p.id }, select: { intentosFallidos: true } });
    const intentos = fila?.intentosFallidos ?? MAX_INTENTOS_CEDULA;
    await registrarEvento(tx, {
      ...base,
      tipo: 'INTENTO_FALLIDO',
      actor: 'PARTE',
      solicitud,
      detalle: { nombre: p.nombre, nota: `Intento ${intentos} de ${MAX_INTENTOS_CEDULA}` },
    });
    if (intentos < MAX_INTENTOS_CEDULA) return { bloqueado: false, recienBloqueado: false, restantes: MAX_INTENTOS_CEDULA - intentos };
    await tx.contratoParte.update({ where: { id: p.id }, data: { bloqueadoAt: ahora } });
    await registrarEvento(tx, {
      ...base,
      tipo: 'BLOQUEO',
      actor: 'SISTEMA',
      detalle: { nombre: p.nombre, nota: `${MAX_INTENTOS_CEDULA} intentos fallidos con los últimos 4 dígitos de la cédula` },
    });
    return { bloqueado: true, recienBloqueado: true, restantes: 0 };
  });
}

// Primer acceso de una parte a su enlace: queda en la constancia y en el
// historial. Nunca bloquea que la página se muestre.
export async function registrarApertura(p: ParteConContexto, solicitud: Solicitud): Promise<void> {
  if (p.abiertoAt || !p.version) return;
  const ahora = new Date();
  const marcada = await prisma.contratoParte.updateMany({
    where: { id: p.id, abiertoAt: null },
    data: { abiertoAt: ahora, estado: 'ABIERTO' },
  });
  if (marcada.count === 0) return;
  await registrarEvento(prisma, {
    contratoId: p.contratoId,
    tipo: 'APERTURA',
    actor: 'PARTE',
    parteId: p.id,
    rol: p.rol,
    etapa: p.etapa,
    versionNumero: p.version.numero,
    huella: p.version.huella,
    solicitud,
    detalle: { nombre: p.nombre },
    fecha: ahora,
  });
}

export type Decision =
  | { accion: 'aprobar'; ultimos4: string; leyoCompleto: boolean; declaracion: boolean; zonaHoraria?: string }
  | { accion: 'rechazar'; ultimos4: string; motivo: string; leyoCompleto: boolean; zonaHoraria?: string };

export type ResultadoDecision =
  | { ok: true; estado: 'APROBADO'; numero: number; etapa: Etapa; etapaCompleta: boolean; final: boolean; contrato: ContratoEstado }
  | { ok: true; estado: 'RECHAZADO'; numero: number; etapa: Etapa; contrato: ContratoEstado }
  | Error;

// La decisión solo se registra si el enlace no está bloqueado EN ESE MOMENTO:
// un intento correcto que llega a la par de los fallidos no se cuela.
const NO_BLOQUEADA = { bloqueadoAt: null, intentosFallidos: { lt: MAX_INTENTOS_CEDULA } };

async function bloqueadaAhora(tx: Prisma.TransactionClient, id: string): Promise<boolean> {
  const fila = await tx.contratoParte.findUnique({ where: { id }, select: { bloqueadoAt: true } });
  return Boolean(fila?.bloqueadoAt);
}

export async function registrarDecision(p: ParteConContexto, decision: Decision, solicitud: Solicitud): Promise<ResultadoDecision> {
  const cerrado = motivoCerrado(p);
  if (cerrado || !p.version) {
    const motivo = cerrado ?? 'firma_retirada';
    return fallo(statusDeMotivo(motivo), motivo, textoCerrado(motivo));
  }
  const version = p.version;

  // Quien decide se identifica con los últimos 4 dígitos de su cédula. Vale
  // también para pedir cambios: el comentario queda con su nombre. Cada fallo
  // se cuenta; al llegar al límite, el enlace se bloquea.
  if (!coincidenUltimos4(decision.ultimos4, p.cedulaUlt4)) {
    const intento = await registrarIntentoFallido(p, version, solicitud);
    if (intento.bloqueado) {
      return fallo(statusDeMotivo('bloqueado'), 'bloqueado', textoCerrado('bloqueado'), { recienBloqueado: intento.recienBloqueado });
    }
    return fallo(403, 'cedula_no_coincide', mensajeDigitosIncorrectos(intento.restantes), { restantes: intento.restantes });
  }
  if (!decision.leyoCompleto) return fallo(400, 'sin_leer', 'Desplace el documento hasta el final antes de decidir.');
  if (decision.accion === 'aprobar' && !decision.declaracion) {
    return fallo(400, 'sin_declaracion', 'Marque la declaración para aprobar esta versión.');
  }

  const ahora = new Date();
  const evidencia = cifrarEvidencia({
    ip: solicitud.ip,
    userAgent: solicitud.userAgent,
    leyoCompleto: true,
    zonaHoraria: decision.zonaHoraria ?? null,
    numeroVersion: version.numero,
    huella: version.huella,
    ...(decision.accion === 'aprobar' ? { declaracion: DECLARACION_APROBACION } : {}),
  });
  const evento = {
    contratoId: p.contratoId,
    actor: 'PARTE' as const,
    parteId: p.id,
    rol: p.rol,
    etapa: p.etapa,
    versionNumero: version.numero,
    huella: version.huella,
    solicitud,
    fecha: ahora,
  };

  if (decision.accion === 'rechazar') {
    const estado = await prisma.$transaction(async (tx) => {
      const marcada = await tx.contratoParte.updateMany({
        where: { id: p.id, estado: { in: ['ENVIADO', 'ABIERTO'] }, ...NO_BLOQUEADA },
        data: { estado: 'RECHAZADO', rechazadoAt: ahora, motivoRechazo: decision.motivo, evidenciaCifrada: evidencia },
      });
      if (marcada.count === 0) return (await bloqueadaAhora(tx, p.id)) ? 'bloqueado' : null;
      await tx.contratoVersion.updateMany({ where: { id: version.id, estado: 'EN_APROBACION' }, data: { estado: 'RECHAZADA', cerradaAt: ahora } });
      // Una versión en la que alguien pide cambios ya no se aprueba: los
      // enlaces de las demás personas dejan de admitir decisión.
      await tx.contratoParte.updateMany({ where: { versionId: version.id, estado: { in: ['ENVIADO', 'ABIERTO'] } }, data: { expiraAt: ahora } });
      const nuevo: ContratoEstado = p.etapa === 'CONTRAPARTE' ? 'CAMBIOS_SOLICITADOS_CONTRAPARTE' : 'CAMBIOS_SOLICITADOS_PRINCIPAL';
      await tx.contrato.updateMany({ where: { id: p.contratoId, versionActual: version.numero, estado: { not: 'ANULADO' } }, data: { estado: nuevo } });
      await registrarEvento(tx, {
        ...evento,
        tipo: 'SOLICITUD_CAMBIOS',
        detalle: { nombre: p.nombre, comentario: decision.motivo, zonaHoraria: decision.zonaHoraria ?? null },
      });
      return nuevo;
    });
    if (estado === 'bloqueado') return fallo(statusDeMotivo('bloqueado'), 'bloqueado', textoCerrado('bloqueado'));
    if (!estado) return fallo(409, 'ya_decidio', textoCerrado('ya_rechazo'));
    return { ok: true, estado: 'RECHAZADO', numero: version.numero, etapa: p.etapa, contrato: estado };
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const marcada = await tx.contratoParte.updateMany({
      where: { id: p.id, estado: { in: ['ENVIADO', 'ABIERTO'] }, ...NO_BLOQUEADA },
      data: { estado: 'APROBADO', aprobadoAt: ahora, evidenciaCifrada: evidencia },
    });
    if (marcada.count === 0) return (await bloqueadaAhora(tx, p.id)) ? 'bloqueado' : null;
    await registrarEvento(tx, {
      ...evento,
      tipo: 'APROBACION',
      detalle: { nombre: p.nombre, zonaHoraria: decision.zonaHoraria ?? null, nota: DECLARACION_APROBACION },
    });

    const partes = await tx.contratoParte.findMany({ where: { versionId: version.id } });
    const etapaLista = etapaCompleta(version, partes, p.etapa);
    const nuevo = estadoDelContrato(version, partes);
    if (p.etapa === 'PRINCIPAL' && etapaLista && !version.principalAprobadaAt) {
      await tx.contratoVersion.update({ where: { id: version.id }, data: { principalAprobadaAt: ahora } });
    }
    // Final: las dos etapas aprobaron ESTA versión, con esta huella.
    if (nuevo === 'APROBADO_FINAL') {
      await tx.contratoVersion.updateMany({ where: { id: version.id, estado: 'EN_APROBACION' }, data: { estado: 'APROBADA', aprobadaAt: ahora } });
    }
    await tx.contrato.updateMany({
      where: { id: p.contratoId, versionActual: version.numero, estado: { not: 'ANULADO' } },
      data: { estado: nuevo, ...(nuevo === 'APROBADO_FINAL' ? { aprobadoAt: ahora } : {}) },
    });
    return { etapaLista, nuevo };
  });
  if (resultado === 'bloqueado') return fallo(statusDeMotivo('bloqueado'), 'bloqueado', textoCerrado('bloqueado'));
  if (!resultado) return fallo(409, 'ya_decidio', textoCerrado('ya_aprobo'));
  return {
    ok: true,
    estado: 'APROBADO',
    numero: version.numero,
    etapa: p.etapa,
    etapaCompleta: resultado.etapaLista,
    final: resultado.nuevo === 'APROBADO_FINAL',
    contrato: resultado.nuevo,
  };
}

export function textoCerrado(motivo: MotivoCerrado): string {
  switch (motivo) {
    case 'firma_retirada':
      return 'Este enlace era de un proceso de firma electrónica que la plataforma ya no ofrece. Contacte con quien se lo envió.';
    case 'cancelado':
      return 'Quien le envió este documento canceló el proceso. No se requiere ninguna acción de su parte.';
    case 'no_disponible':
      return 'Este documento aún está en revisión. Recibirá el enlace cuando esté listo.';
    case 'reemplazada':
      return 'Hay una versión más reciente de este documento. Esta versión ya no se aprueba: espere el enlace de la versión nueva.';
    case 'rechazada_por_otra_parte':
      return 'Se pidieron cambios en esta versión. Recibirá una versión nueva cuando esté lista.';
    case 'ya_aprobo':
      return 'Usted ya aprobó esta versión.';
    case 'ya_rechazo':
      return 'Usted ya indicó que no aprueba esta versión.';
    case 'bloqueado':
      return 'Este enlace se bloqueó por seguridad después de varios intentos con dígitos de la cédula que no coinciden. Pida a quien se lo envió que le haga llegar un enlace nuevo.';
    case 'vencido':
      return 'El enlace venció. Pida a quien se lo envió que le haga llegar uno nuevo: el documento sigue disponible.';
  }
}
