import {
  CONTRATO_DEFINICION,
  rolesPorEtapa,
  type ContratoEstado,
  type ContratoTipo,
  type Etapa,
} from './tipos';

// El flujo secuencial de aprobación, como reglas puras: sin Prisma ni Next, para
// que el servidor, la pantalla y las pruebas apliquen exactamente lo mismo.
//
//   1. El agente envía la versión SOLO a la parte principal (su cliente).
//   2. La contraparte no ve nada hasta que la principal aprueba y el agente
//      decide enviársela. Se valida en el servidor en cada acceso.
//   3. Aprobado final = las dos etapas aprobaron la MISMA versión.
//
// El estado del contrato no se guarda "a mano" en cada acción: se recalcula de
// la versión vigente y de lo que decidió cada parte. Así no hay combinación de
// acciones que lo deje desfasado.

export type ParteEnFlujo = { etapa: Etapa; estado: string; expiraAt: Date | string };

export type VersionEnFlujo = {
  estado: string;
  requierePrincipal: boolean;
  requiereContraparte: boolean;
  // Corrección menor: la aprobación de la etapa principal se conserva de la
  // versión N, que tenía las mismas condiciones (misma huella de condiciones).
  principalHeredadaDe: number | null;
  simultanea: boolean;
  contraparteEnviadaAt: Date | string | null;
};

export function estaPendiente(p: { estado: string }): boolean {
  return p.estado === 'ENVIADO' || p.estado === 'ABIERTO';
}

export function estaVencida(p: { estado: string; expiraAt: Date | string }, ahora = Date.now()): boolean {
  return estaPendiente(p) && new Date(p.expiraAt).getTime() < ahora;
}

// Una etapa está completa cuando TODAS sus personas aprobaron esta versión (o
// cuando el documento no tiene esa etapa).
export function etapaCompleta(version: VersionEnFlujo, partes: ParteEnFlujo[], etapa: Etapa): boolean {
  if (etapa === 'PRINCIPAL') {
    if (!version.requierePrincipal) return true;
    if (version.principalHeredadaDe !== null) return true;
  } else if (!version.requiereContraparte) {
    return true;
  }
  const deEtapa = partes.filter((p) => p.etapa === etapa);
  return deEtapa.length > 0 && deEtapa.every((p) => p.estado === 'APROBADO');
}

export function estadoDelContrato(version: VersionEnFlujo | null, partes: ParteEnFlujo[], ahora = Date.now()): ContratoEstado {
  if (!version) return 'BORRADOR';
  if (version.estado === 'ANULADA') return 'ANULADO';
  if (version.estado === 'RECHAZADA') {
    const quien = partes.find((p) => p.estado === 'RECHAZADO');
    return quien?.etapa === 'CONTRAPARTE' ? 'CAMBIOS_SOLICITADOS_CONTRAPARTE' : 'CAMBIOS_SOLICITADOS_PRINCIPAL';
  }
  const principal = etapaCompleta(version, partes, 'PRINCIPAL');
  const contraparte = etapaCompleta(version, partes, 'CONTRAPARTE');
  if (principal && contraparte) return 'APROBADO_FINAL';
  if (partes.some((p) => estaVencida(p, ahora))) return 'VENCIDO';
  if (!principal) return 'EN_REVISION_PRINCIPAL';
  if (!partes.some((p) => p.etapa === 'CONTRAPARTE')) return 'APROBADO_PRINCIPAL';
  return 'EN_REVISION_CONTRAPARTE';
}

// ¿Puede la contraparte ver y decidir sobre esta versión? Solo si el agente se
// la envió después de que la principal aprobara, o si eligió a sabiendas el
// envío simultáneo.
export function contraparteHabilitada(version: VersionEnFlujo, partes: ParteEnFlujo[]): boolean {
  if (version.simultanea) return true;
  return version.contraparteEnviadaAt !== null && etapaCompleta(version, partes, 'PRINCIPAL');
}

export function parteHabilitada(parte: { etapa: Etapa }, version: VersionEnFlujo, partes: ParteEnFlujo[]): boolean {
  return parte.etapa === 'PRINCIPAL' || contraparteHabilitada(version, partes);
}

// La primera etapa que recibe el documento: la principal, salvo que ese lado
// no comparezca (el arrendador en la reserva de arrendamiento).
export function primeraEtapa(tipo: ContratoTipo, representa: string | null | undefined): Etapa | null {
  const roles = rolesPorEtapa(tipo, representa);
  if (roles.PRINCIPAL.length > 0) return 'PRINCIPAL';
  if (roles.CONTRAPARTE.length > 0) return 'CONTRAPARTE';
  return null;
}

// ---------------------------------------------------------------------------
// Corrección menor
//
// Si la contraparte pide cambios y el agente solo corrige SUS datos (cédula,
// domicilio, correo), la versión no vuelve a la principal: su aprobación se
// conserva porque las condiciones no cambiaron. Para comprobarlo sin confiar en
// lo que diga el navegador, se arma el documento con los datos de la
// contraparte tapados y se compara su huella con la de la versión aprobada.
// Cualquier otra diferencia (una cláusula, un monto, el inmueble, los datos de
// la principal) cambia esa huella y obliga a volver a la principal.
// ---------------------------------------------------------------------------
export const MARCA_DATO_CONTRAPARTE = '‹dato de la contraparte›';

// Qué no se tapa aunque sea de la contraparte: pasar de persona a compañía o
// sumar una persona al lado cambia quién se obliga, no es una corrección.
const ESTRUCTURALES = new Set(['tipoPersona', 'personas']);

export function datosConContraparteTapada(
  tipo: ContratoTipo,
  representa: string | null | undefined,
  datos: Record<string, string>,
): Record<string, string> {
  const roles = rolesPorEtapa(tipo, representa).CONTRAPARTE;
  if (roles.length === 0) return { ...datos };
  const patron = new RegExp(`^(${roles.join('|')})(_\\d+)?_(.+)$`);
  const salida = { ...datos };
  // Se tapan TODOS los campos de la contraparte que define el tipo, estén o no
  // escritos: agregar un correo que faltaba es una corrección, y no puede
  // cambiar la huella por haber pasado de vacío a lleno.
  for (const campo of CONTRATO_DEFINICION[tipo].secciones.flatMap((s) => s.campos)) {
    const m = campo.clave.match(patron);
    if (m && !ESTRUCTURALES.has(m[3])) salida[campo.clave] = MARCA_DATO_CONTRAPARTE;
  }
  return salida;
}

// Etiquetas de los campos que cambiaron entre dos juegos de datos, para el
// historial y el aviso a la principal. Nunca los valores.
export function camposCambiados(tipo: ContratoTipo, antes: Record<string, string>, despues: Record<string, string>): string[] {
  const salida: string[] = [];
  for (const seccion of CONTRATO_DEFINICION[tipo].secciones) {
    for (const campo of seccion.campos) {
      if ((antes[campo.clave] ?? '').trim() !== (despues[campo.clave] ?? '').trim()) {
        salida.push(`${seccion.titulo}: ${campo.etiqueta}`);
      }
    }
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Mensaje para compartir el enlace
// ---------------------------------------------------------------------------

// Neutro y sin marca: lo manda el agente desde su WhatsApp, a su cliente.
export function mensajeParaCompartir(input: { nombre: string; tipoDocumento: string; referencia: string; enlace: string }): string {
  const primerNombre = input.nombre.trim().split(/\s+/)[0] || input.nombre.trim();
  return `Hola ${primerNombre}, te comparto el borrador de ${input.tipoDocumento} del inmueble ${input.referencia} para tu revisión. Por favor revísalo y apruébalo o indícame cambios: ${input.enlace}`;
}

// wa.me con el número en formato internacional. Un número local ecuatoriano
// (09…) se completa con el 593; si no se puede leer, el enlace abre WhatsApp
// sin destinatario y el agente elige el chat.
export function enlaceWhatsApp(telefono: string, mensaje: string): string {
  let digitos = telefono.replace(/\D/g, '');
  if (digitos.startsWith('0') && digitos.length === 10) digitos = `593${digitos.slice(1)}`;
  const texto = encodeURIComponent(mensaje);
  return digitos.length >= 10 ? `https://wa.me/${digitos}?text=${texto}` : `https://wa.me/?text=${texto}`;
}

// ---------------------------------------------------------------------------
// Indicador de etapa para el panel: "1. Vendedor → 2. Comprador → Listo para
// notaría"
// ---------------------------------------------------------------------------

export type PasoIndicador = { clave: Etapa | 'NOTARIA'; etiqueta: string; estado: 'hecho' | 'actual' | 'pendiente' };

export function indicadorEtapas(input: {
  etiquetas: Record<Etapa, string | null>;
  estado: ContratoEstado;
  // Para un VENCIDO: si la etapa principal ya estaba completa, lo vencido es
  // de la contraparte.
  principalCompleta: boolean;
}): PasoIndicador[] {
  const { etiquetas, estado } = input;
  const etapas = (['PRINCIPAL', 'CONTRAPARTE'] as Etapa[]).filter((e) => etiquetas[e]);
  const enContraparte =
    estado === 'APROBADO_PRINCIPAL' ||
    estado === 'EN_REVISION_CONTRAPARTE' ||
    estado === 'CAMBIOS_SOLICITADOS_CONTRAPARTE' ||
    (estado === 'VENCIDO' && input.principalCompleta);
  const final = estado === 'APROBADO_FINAL';
  const pasos: PasoIndicador[] = etapas.map((e) => {
    let paso: PasoIndicador['estado'] = 'pendiente';
    if (final) paso = 'hecho';
    else if (estado !== 'BORRADOR' && estado !== 'ANULADO') {
      if (e === 'PRINCIPAL') paso = enContraparte ? 'hecho' : 'actual';
      else paso = enContraparte || !etiquetas.PRINCIPAL ? 'actual' : 'pendiente';
    }
    return { clave: e, etiqueta: etiquetas[e] as string, estado: paso };
  });
  pasos.push({ clave: 'NOTARIA', etiqueta: 'Listo para notaría', estado: final ? 'hecho' : 'pendiente' });
  return pasos;
}
