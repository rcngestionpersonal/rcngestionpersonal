import {
  bloqueEnlaceDescarga,
  bloqueTexto,
  cabeceraAgente,
  cierreYFirma,
  cifras,
  documentoCorreo,
  firmaTexto,
  lineaSaludo,
  notaAdjunto,
  notaDiscreta,
  parrafo,
  pie,
  pieTexto,
  saludo,
  tarjetaInmueble,
  type AgenteCorreo,
  type InmuebleCorreo,
} from './componentes';
import { rangoDias, textoVencimiento, type EntregaCorreo } from './fechas';

// Correo del reporte de gestion: las cifras del periodo y el analisis del
// agente. Difusion, fechas de visita y comparativo quedan en el PDF.

export type DatosCorreoGestion = {
  agente: AgenteCorreo;
  propietario: string | null;
  inmueble: InmuebleCorreo;
  periodicidad: 'SEMANAL' | 'MENSUAL';
  desde: Date;
  hasta: Date;
  visitas: number;
  consultas: number;
  vistas: number;
  compradores: number;
  agendadas: number;
  enNegociacion: number;
  observaciones: string | null;
  acumulado: { semanas: number; visitas: number; consultas: number };
  mensaje: string | null;
  entrega: EntregaCorreo;
};

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

export function asuntoGestion(d: Pick<DatosCorreoGestion, 'inmueble' | 'desde' | 'hasta'>): string {
  return `Reporte de gestión · ${d.inmueble.tipo} en ${d.inmueble.sector} · ${rangoDias(d.desde, d.hasta)}`;
}

function introduccion(d: DatosCorreoGestion): string {
  return `Le comparto el reporte ${d.periodicidad === 'SEMANAL' ? 'semanal' : 'mensual'} de la gestión de su inmueble en ${d.inmueble.sector}, del ${rangoDias(d.desde, d.hasta)}.`;
}

function acumulado(d: DatosCorreoGestion): string {
  return `Van ${plural(d.acumulado.semanas, 'semana', 'semanas')} de gestión, ${plural(d.acumulado.visitas, 'visita', 'visitas')} y ${plural(d.acumulado.consultas, 'consulta', 'consultas')} en total.`;
}

function acercamientos(d: DatosCorreoGestion): string {
  // Las consultas ya estan en su tarjeta: aqui solo lo que viene despues.
  return `Acercamientos: ${plural(d.agendadas, 'visita agendada', 'visitas agendadas')} · ${d.enNegociacion} en negociación`;
}

const TEXTO_ADJUNTO = 'El reporte completo del período va adjunto en PDF.';

export function correoGestion(d: DatosCorreoGestion): { asunto: string; html: string; texto: string } {
  const asunto = asuntoGestion(d);
  const secciones = [
    cabeceraAgente(d.agente, 'Reporte de gestión'),
    saludo(d.propietario),
    parrafo(introduccion(d)),
    d.mensaje ? parrafo(d.mensaje) : '',
    tarjetaInmueble(d.inmueble),
    cifras('Actividad del período', [
      { valor: String(d.visitas), etiqueta: 'Visitas realizadas', destacado: true },
      { valor: String(d.consultas), etiqueta: 'Consultas recibidas' },
      { valor: String(d.vistas), etiqueta: 'Vistas de la ficha en línea' },
      { valor: String(d.compradores), etiqueta: 'Compradores compatibles' },
    ]),
    notaDiscreta(acercamientos(d)),
    d.observaciones ? bloqueTexto('Mi análisis y recomendación', d.observaciones) : '',
    notaDiscreta(acumulado(d)),
    cierreYFirma(d.agente),
    d.entrega.modo === 'adjunto' ? notaAdjunto(TEXTO_ADJUNTO) : bloqueEnlaceDescarga(d.entrega.url, textoVencimiento(d.entrega.venceAt)),
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
    'ACTIVIDAD DEL PERÍODO',
    `Visitas realizadas: ${d.visitas}`,
    `Consultas recibidas: ${d.consultas}`,
    `Vistas de la ficha en línea: ${d.vistas}`,
    `Compradores compatibles: ${d.compradores}`,
    acercamientos(d),
    ...(d.observaciones ? ['', 'MI ANÁLISIS Y RECOMENDACIÓN', d.observaciones] : []),
    '',
    acumulado(d),
    '',
    ...firmaTexto(d.agente),
    '',
    d.entrega.modo === 'adjunto' ? TEXTO_ADJUNTO : `Descargue el reporte completo (PDF): ${d.entrega.url}\n${textoVencimiento(d.entrega.venceAt)}`,
    ...pieTexto(),
  ].join('\n');

  return { asunto, html: documentoCorreo({ asunto, preencabezado: introduccion(d), secciones }), texto };
}
