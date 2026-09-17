import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { encryptAtRest } from '@/lib/real-estate/payments/encryption';
import {
  cifrarDocumento,
  cifrarEvidencia,
  coincidenUltimos4,
  fechaExpiracion,
  generarToken,
  huellaTexto,
  ultimos4,
  type DocumentoCongelado,
} from './aprobacion';
import { sinCambios, type CambiosEntreVersiones } from './clausulas';
import {
  cambiosSinEnviar,
  documentoDeTrabajo,
  etiquetaRol,
  ultimaVersion,
  type ContratoCompleto,
  type PerfilAgente,
} from './servidor';
import {
  CONTRATO_DEFINICION,
  DECLARACION_APROBACION,
  PARTES_POR_TIPO,
  camposFaltantes,
  correoValido,
  esEditable,
  esTipoArchivado,
  identidadParte,
  type ContratoEstado,
  type ContratoTipo,
} from './tipos';

// Versiones de un contrato: enviar, reenviar un enlace y registrar lo que
// decide cada parte.
//
// La regla de fondo: una versión enviada no cambia nunca. Lo que el agente
// edite después va a la copia de trabajo y sale como la versión siguiente. Así
// el historial dice exactamente qué texto aprobó cada parte y cuándo.

export type EnlaceParte = { parteId: string; nombre: string; correo: string; rolEtiqueta: string; token: string };

export type ResultadoEnvio =
  | {
      ok: true;
      numero: number;
      nombreDocumento: string;
      enlaces: EnlaceParte[];
      cambios: CambiosEntreVersiones | null;
      expiraAt: Date;
    }
  | { ok: false; status: number; error: string; code: string; faltantes?: string[] };

// Congela la copia de trabajo como la versión siguiente y genera un enlace por
// cada parte que tiene que aprobarla. Si había una versión en revisión, queda
// reemplazada y sus enlaces dejan de servir.
//
// Devuelve los tokens en claro para que quien llama los mande por correo: no
// se guardan en ninguna parte.
export async function crearVersion(contrato: ContratoCompleto, perfil: PerfilAgente): Promise<ResultadoEnvio> {
  const tipo = contrato.tipo as ContratoTipo;
  if (esTipoArchivado(tipo)) {
    return { ok: false, status: 409, error: 'Este tipo de contrato fue retirado y ya no se envía.', code: 'tipo_archivado' };
  }
  if (!esEditable(contrato.estado as ContratoEstado, tipo)) {
    return { ok: false, status: 409, error: 'Este contrato ya no admite versiones nuevas.', code: 'no_editable' };
  }
  if (!perfil.cedula) {
    return {
      ok: false,
      status: 409,
      error: 'Necesitas tu cédula registrada en el perfil para emitir contratos.',
      code: 'agente_sin_cedula',
    };
  }

  const trabajo = await documentoDeTrabajo(contrato, perfil);
  const visibles = Object.fromEntries(Object.entries(trabajo.datos).filter(([k]) => !k.startsWith('__')));
  const faltantes = camposFaltantes(tipo, visibles);
  if (faltantes.length > 0) {
    return { ok: false, status: 400, error: 'Faltan datos obligatorios.', code: 'incompleto', faltantes };
  }

  // Mandar dos veces el mismo texto mientras la anterior sigue en revisión o
  // ya se aprobó no aporta nada y confunde a las partes: para eso está el
  // reenvío del enlace.
  const anterior = ultimaVersion(contrato);
  const cambios = cambiosSinEnviar(contrato, trabajo.preparado.bloques);
  if (anterior && cambios && sinCambios(cambios) && (anterior.estado === 'EN_APROBACION' || anterior.estado === 'APROBADA')) {
    return {
      ok: false,
      status: 409,
      error: `No hay cambios respecto de la versión ${anterior.numero}. Si alguien no recibió el enlace, reenvíaselo.`,
      code: 'sin_cambios',
    };
  }

  // Quién aprueba sale de la definición del tipo, no de lo que mande el
  // navegador. El agente no se aprueba a sí mismo: enviar es su conformidad.
  const aprobadores: Array<{ rol: string; nombre: string; correo: string; cedula: string }> = [];
  for (const def of PARTES_POR_TIPO[tipo]) {
    if (def.esAgente) continue;
    const identidad = identidadParte(tipo, visibles, def.rol);
    const { nombre, cedula } = identidad.aprobador;
    if (!nombre || ultimos4(cedula).length < 4 || !correoValido(identidad.correo)) {
      return {
        ok: false,
        status: 400,
        error: `Faltan datos de ${def.etiqueta.toLowerCase()}, o la cédula o el correo no son válidos.`,
        code: 'parte_incompleta',
      };
    }
    aprobadores.push({ rol: def.rol, nombre, correo: identidad.correo.trim(), cedula });
  }

  const numero = contrato.versionActual + 1;
  const congelado: DocumentoCongelado = {
    formato: 1,
    tipo,
    numero,
    nombreDocumento: trabajo.preparado.nombreDocumento,
    ciudad: trabajo.ciudad,
    fechaLarga: trabajo.fechaLarga,
    plantillaVersion: trabajo.preparado.version,
    avisoSinRevisar: trabajo.preparado.revisadaPorAbogado ? null : trabajo.preparado.avisoSinRevisar,
    bloques: trabajo.preparado.bloques,
  };
  const ahora = new Date();
  const expira = fechaExpiracion(ahora);
  const tokens = aprobadores.map(() => generarToken());

  try {
    const creadas = await prisma.$transaction(async (tx) => {
      // Si otra pestaña envió una versión en el medio, esta no se crea.
      const tomado = await tx.contrato.updateMany({
        where: { id: contrato.id, versionActual: contrato.versionActual, estado: contrato.estado },
        data: { estado: 'EN_APROBACION', versionActual: numero, enviadoAt: ahora, aprobadoAt: null },
      });
      if (tomado.count === 0) throw new ConflictoDeVersion();

      if (anterior && anterior.estado === 'EN_APROBACION') {
        await tx.contratoVersion.update({ where: { id: anterior.id }, data: { estado: 'REEMPLAZADA', cerradaAt: ahora } });
        await tx.contratoParte.updateMany({
          where: { versionId: anterior.id, estado: { in: ['ENVIADO', 'ABIERTO'] } },
          data: { expiraAt: ahora },
        });
      }

      const version = await tx.contratoVersion.create({
        data: {
          contratoId: contrato.id,
          numero,
          plantillaVersion: congelado.plantillaVersion,
          documentoCifrado: cifrarDocumento(congelado),
          huella: huellaTexto(contrato.codigoVerificacion, trabajo.preparado.texto),
          enviadaAt: ahora,
        },
      });

      const partes = [];
      for (let i = 0; i < aprobadores.length; i += 1) {
        const a = aprobadores[i];
        partes.push(
          await tx.contratoParte.create({
            data: {
              contratoId: contrato.id,
              versionId: version.id,
              rol: a.rol,
              nombre: a.nombre,
              correo: a.correo,
              cedulaCifrada: encryptAtRest(a.cedula),
              cedulaUlt4: ultimos4(a.cedula),
              tokenHash: tokens[i].hash,
              expiraAt: expira,
              enviadoAt: ahora,
            },
          }),
        );
      }
      return partes;
    });

    return {
      ok: true,
      numero,
      nombreDocumento: CONTRATO_DEFINICION[tipo].nombreDocumento,
      cambios: anterior ? cambios : null,
      expiraAt: expira,
      enlaces: creadas.map((p, i) => ({
        parteId: p.id,
        nombre: p.nombre,
        correo: p.correo,
        rolEtiqueta: etiquetaRol(tipo, p.rol),
        token: tokens[i].token,
      })),
    };
  } catch (error) {
    if (error instanceof ConflictoDeVersion || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
      return {
        ok: false,
        status: 409,
        error: 'El contrato cambió mientras lo enviabas. Recarga y vuelve a intentarlo.',
        code: 'conflicto',
      };
    }
    throw error;
  }
}

class ConflictoDeVersion extends Error {}

// Enlace nuevo para una parte que aún no decidió sobre la versión en revisión.
// El token anterior deja de servir en el mismo momento: si el primer correo
// llegó a la bandeja equivocada, ya no abre nada.
export async function regenerarEnlace(parteId: string): Promise<{ token: string; expiraAt: Date }> {
  const { token, hash } = generarToken();
  const expiraAt = fechaExpiracion();
  await prisma.contratoParte.update({
    where: { id: parteId },
    data: { tokenHash: hash, expiraAt, estado: 'ENVIADO', enviadoAt: new Date(), abiertoAt: null },
  });
  return { token, expiraAt };
}

// ---------------------------------------------------------------------------
// Decisión de una parte
// ---------------------------------------------------------------------------

export async function parteDeToken(tokenHash: string) {
  return prisma.contratoParte.findUnique({
    where: { tokenHash },
    include: { version: true, contrato: { include: { partes: true, versiones: { orderBy: { numero: 'asc' } } } } },
  });
}

type ParteConContexto = NonNullable<Awaited<ReturnType<typeof parteDeToken>>>;

export type MotivoCerrado =
  | 'firma_retirada'
  | 'cancelado'
  | 'reemplazada'
  | 'rechazada_por_otra_parte'
  | 'ya_aprobo'
  | 'ya_rechazo'
  | 'vencido';

// Por qué un enlace ya no admite decidir, o null si la admite. Una sola
// función para la página y para la API: nunca dicen cosas distintas.
export function motivoCerrado(p: ParteConContexto, ahora = Date.now()): MotivoCerrado | null {
  if (!p.version) return 'firma_retirada';
  if (p.contrato.estado === 'ANULADO' || p.version.estado === 'ANULADA') return 'cancelado';
  if (p.estado === 'APROBADO') return 'ya_aprobo';
  if (p.estado === 'RECHAZADO') return 'ya_rechazo';
  if (p.version.estado === 'REEMPLAZADA') return 'reemplazada';
  if (p.version.estado === 'RECHAZADA') return 'rechazada_por_otra_parte';
  if (p.expiraAt.getTime() < ahora) return 'vencido';
  return null;
}

export type Decision =
  | { accion: 'aprobar'; ultimos4: string; leyoCompleto: boolean; declaracion: boolean; zonaHoraria?: string }
  | { accion: 'rechazar'; ultimos4: string; motivo: string; leyoCompleto: boolean; zonaHoraria?: string };

export type ResultadoDecision =
  | { ok: true; estado: 'APROBADO'; versionAprobada: boolean; numero: number }
  | { ok: true; estado: 'RECHAZADO'; numero: number }
  | { ok: false; status: number; error: string; code: string };

export async function registrarDecision(
  p: ParteConContexto,
  decision: Decision,
  solicitud: { ip: string | null; navegador: string },
): Promise<ResultadoDecision> {
  const cerrado = motivoCerrado(p);
  if (cerrado || !p.version) {
    return { ok: false, status: cerrado === 'vencido' ? 410 : 409, error: textoCerrado(cerrado ?? 'firma_retirada'), code: cerrado ?? 'firma_retirada' };
  }
  const version = p.version;

  // Quien decide se identifica con los últimos 4 dígitos de su cédula. Vale
  // también para rechazar: el motivo queda en el historial con su nombre.
  if (!coincidenUltimos4(decision.ultimos4, p.cedulaUlt4)) {
    return { ok: false, status: 403, error: 'Los últimos 4 dígitos no coinciden con los registrados.', code: 'cedula_no_coincide' };
  }
  if (!decision.leyoCompleto) {
    return { ok: false, status: 400, error: 'Desplace el documento hasta el final antes de decidir.', code: 'sin_leer' };
  }
  if (decision.accion === 'aprobar' && !decision.declaracion) {
    return { ok: false, status: 400, error: 'Marque la declaración para aprobar esta versión.', code: 'sin_declaracion' };
  }

  const ahora = new Date();
  const evidencia = cifrarEvidencia({
    ip: solicitud.ip,
    userAgent: solicitud.navegador,
    leyoCompleto: true,
    zonaHoraria: decision.zonaHoraria ?? null,
    numeroVersion: version.numero,
    huella: version.huella,
    ...(decision.accion === 'aprobar' ? { declaracion: DECLARACION_APROBACION } : {}),
  });

  if (decision.accion === 'rechazar') {
    const hecho = await prisma.$transaction(async (tx) => {
      const marcada = await tx.contratoParte.updateMany({
        where: { id: p.id, estado: { in: ['ENVIADO', 'ABIERTO'] } },
        data: { estado: 'RECHAZADO', rechazadoAt: ahora, motivoRechazo: decision.motivo, evidenciaCifrada: evidencia },
      });
      if (marcada.count === 0) return false;
      await tx.contratoVersion.updateMany({
        where: { id: version.id, estado: 'EN_APROBACION' },
        data: { estado: 'RECHAZADA', cerradaAt: ahora },
      });
      // Una versión que alguien no aprueba ya no se aprueba: los enlaces de
      // las demás partes dejan de admitir decisión.
      await tx.contratoParte.updateMany({
        where: { versionId: version.id, estado: { in: ['ENVIADO', 'ABIERTO'] } },
        data: { expiraAt: ahora },
      });
      await tx.contrato.updateMany({
        where: { id: p.contratoId, versionActual: version.numero, estado: 'EN_APROBACION' },
        data: { estado: 'RECHAZADO' },
      });
      return true;
    });
    if (!hecho) return { ok: false, status: 409, error: textoCerrado('ya_rechazo'), code: 'ya_decidio' };
    return { ok: true, estado: 'RECHAZADO', numero: version.numero };
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const marcada = await tx.contratoParte.updateMany({
      where: { id: p.id, estado: { in: ['ENVIADO', 'ABIERTO'] } },
      data: { estado: 'APROBADO', aprobadoAt: ahora, evidenciaCifrada: evidencia },
    });
    if (marcada.count === 0) return null;
    const pendientes = await tx.contratoParte.count({ where: { versionId: version.id, estado: { not: 'APROBADO' } } });
    if (pendientes > 0) return { completa: false };
    const cerrada = await tx.contratoVersion.updateMany({
      where: { id: version.id, estado: 'EN_APROBACION' },
      data: { estado: 'APROBADA', aprobadaAt: ahora },
    });
    if (cerrada.count > 0) {
      await tx.contrato.updateMany({
        where: { id: p.contratoId, versionActual: version.numero, estado: 'EN_APROBACION' },
        data: { estado: 'APROBADO', aprobadoAt: ahora },
      });
    }
    return { completa: cerrada.count > 0 };
  });
  if (!resultado) return { ok: false, status: 409, error: textoCerrado('ya_aprobo'), code: 'ya_decidio' };
  return { ok: true, estado: 'APROBADO', versionAprobada: resultado.completa, numero: version.numero };
}

export function textoCerrado(motivo: MotivoCerrado): string {
  switch (motivo) {
    case 'firma_retirada':
      return 'Este enlace era de un proceso de firma electrónica que la plataforma ya no ofrece. Contacte con quien se lo envió.';
    case 'cancelado':
      return 'Quien le envió este documento canceló el proceso. No se requiere ninguna acción de su parte.';
    case 'reemplazada':
      return 'Hay una versión más reciente de este documento. Revise el último correo que recibió: esta versión ya no se aprueba.';
    case 'rechazada_por_otra_parte':
      return 'Otra de las partes pidió cambios en esta versión. Recibirá una versión nueva cuando esté lista.';
    case 'ya_aprobo':
      return 'Usted ya aprobó esta versión.';
    case 'ya_rechazo':
      return 'Usted ya indicó que no aprueba esta versión.';
    case 'vencido':
      return 'El enlace venció. Pida a quien se lo envió que se lo reenvíe: el documento sigue disponible.';
  }
}
