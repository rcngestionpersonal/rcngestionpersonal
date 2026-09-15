import {
  bloqueDestacado,
  bloqueEnlaceDescarga,
  bloqueResultado,
  cabeceraAgente,
  cierreYFirma,
  documentoCorreo,
  etiquetaInteres,
  firmaTexto,
  lineaSaludo,
  notaAdjunto,
  parrafo,
  pie,
  pieTexto,
  saludo,
  tablaDatos,
  tarjetaInmueble,
  type AgenteCorreo,
  type InmuebleCorreo,
  type NivelInteres,
} from './componentes';
import { diaYMes, esMismoDia, fechaLarga, hora, textoVencimiento, type EntregaCorreo } from './fechas';

// Correo del reporte de visita. El cuerpo es el RESUMEN: lo que el propietario
// necesita saber sin abrir nada. El PDF adjunto es el documento completo.

export type DatosCorreoVisita = {
  agente: AgenteCorreo;
  propietario: string | null;
  inmueble: InmuebleCorreo;
  visitadaAt: Date;
  duracionMinutos: number | null;
  visitante: string;
  acompanantes: string | null;
  reaccion: NivelInteres;
  observaciones: string | null;
  objeciones: string | null;
  proximoPaso: string | null;
  mensaje: string | null;
  conFoto: boolean;
  entrega: EntregaCorreo;
  ahora?: Date;
};

export function asuntoVisita(d: Pick<DatosCorreoVisita, 'inmueble' | 'visitadaAt'>): string {
  return `Reporte de visita · ${d.inmueble.tipo} en ${d.inmueble.sector} · ${diaYMes(d.visitadaAt)}`;
}

function introduccion(d: DatosCorreoVisita): string {
  const cuando = esMismoDia(d.visitadaAt, d.ahora ?? new Date()) ? 'hoy' : `el ${fechaLarga(d.visitadaAt)}`;
  return `Le comparto el detalle de la visita realizada ${cuando} a su inmueble en ${d.inmueble.sector}.`;
}

function filasVisita(d: DatosCorreoVisita): Array<[string, string]> {
  const filas: Array<[string, string]> = [
    ['Fecha y hora', `${fechaLarga(d.visitadaAt)}, ${hora(d.visitadaAt)}`],
  ];
  if (d.duracionMinutos) filas.push(['Duración aproximada', `${d.duracionMinutos} minutos`]);
  // Sin cedula: en el correo solo va el nombre (punto 2.4).
  filas.push(['Visitante', d.visitante]);
  if (d.acompanantes) filas.push(['Acompañantes', d.acompanantes]);
  return filas;
}

// La nota dice exactamente lo que trae el adjunto (punto 3.4).
function textoAdjunto(d: DatosCorreoVisita): string {
  return d.conFoto ? 'El reporte completo, con la constancia fotográfica, va adjunto en PDF.' : 'El reporte completo va adjunto en PDF.';
}

export function correoVisita(d: DatosCorreoVisita): { asunto: string; html: string; texto: string } {
  const asunto = asuntoVisita(d);
  const secciones = [
    cabeceraAgente(d.agente, 'Reporte de visita'),
    saludo(d.propietario),
    parrafo(introduccion(d)),
    d.mensaje ? parrafo(d.mensaje) : '',
    tarjetaInmueble(d.inmueble),
    tablaDatos('Datos de la visita', filasVisita(d)),
    bloqueResultado({ nivel: d.reaccion, observaciones: d.observaciones, comentarios: d.objeciones }),
    d.proximoPaso ? bloqueDestacado('Próximo paso', d.proximoPaso) : '',
    cierreYFirma(d.agente),
    d.entrega.modo === 'adjunto' ? notaAdjunto(textoAdjunto(d)) : bloqueEnlaceDescarga(d.entrega.url, textoVencimiento(d.entrega.venceAt)),
    pie(),
  ].filter(Boolean);

  const texto = [
    lineaSaludo(d.propietario),
    '',
    introduccion(d),
    ...(d.mensaje ? ['', d.mensaje] : []),
    '',
    `INMUEBLE: ${d.inmueble.tipo} en ${d.inmueble.sector}${d.inmueble.referencia ? ` (Ref. ${d.inmueble.referencia})` : ''}${d.inmueble.precio ? ` · ${d.inmueble.precio}` : ''}`,
    '',
    'DATOS DE LA VISITA',
    ...filasVisita(d).map(([e, v]) => `${e}: ${v}`),
    '',
    `RESULTADO: ${etiquetaInteres(d.reaccion)}`,
    ...(d.observaciones ? [d.observaciones] : []),
    ...(d.objeciones ? ['', `Comentarios del visitante: ${d.objeciones}`] : []),
    ...(d.proximoPaso ? ['', `PRÓXIMO PASO: ${d.proximoPaso}`] : []),
    '',
    ...firmaTexto(d.agente),
    '',
    d.entrega.modo === 'adjunto' ? textoAdjunto(d) : `Descargue el reporte completo (PDF): ${d.entrega.url}\n${textoVencimiento(d.entrega.venceAt)}`,
    ...pieTexto(),
  ].join('\n');

  return { asunto, html: documentoCorreo({ asunto, preencabezado: introduccion(d), secciones }), texto };
}
