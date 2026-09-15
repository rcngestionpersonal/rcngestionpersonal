import { ADVERTENCIA_TASACION } from '../tipos';
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
import { diaYMes, textoVencimiento, type EntregaCorreo } from './fechas';

// Correo del reporte de tasacion: el rango y la conclusion. Los comparables y el
// grafico quedan en el PDF. La advertencia de que no es un avaluo va tambien en
// el cuerpo: el propietario que solo lee el correo no puede quedarse con la
// idea de que recibio un avaluo.

export type DatosCorreoTasacion = {
  agente: AgenteCorreo;
  propietario: string | null;
  inmueble: InmuebleCorreo;
  emitidoAt: Date;
  minimo: string;
  central: string;
  maximo: string;
  conclusion: string;
  cierres: number;
  mensaje: string | null;
  entrega: EntregaCorreo;
};

export function asuntoTasacion(d: Pick<DatosCorreoTasacion, 'inmueble' | 'emitidoAt'>): string {
  return `Referencia de mercado · ${d.inmueble.tipo} en ${d.inmueble.sector} · ${diaYMes(d.emitidoAt)}`;
}

function introduccion(d: DatosCorreoTasacion): string {
  return `Le comparto una referencia de mercado para su inmueble en ${d.inmueble.sector}, basada en ${d.cierres} cierres reales registrados en el sector.`;
}

const TEXTO_ADJUNTO = 'El análisis completo, con los cierres comparables y el gráfico, va adjunto en PDF.';

export function correoTasacion(d: DatosCorreoTasacion): { asunto: string; html: string; texto: string } {
  const asunto = asuntoTasacion(d);
  const secciones = [
    cabeceraAgente(d.agente, 'Referencia de mercado'),
    saludo(d.propietario),
    parrafo(introduccion(d)),
    d.mensaje ? parrafo(d.mensaje) : '',
    tarjetaInmueble(d.inmueble),
    cifras('Rango sugerido', [
      { valor: d.central, etiqueta: 'Valor central del sector', destacado: true },
      { valor: `${d.minimo} – ${d.maximo}`, etiqueta: 'Rango sugerido' },
    ]),
    bloqueTexto('Conclusión', d.conclusion),
    notaDiscreta(ADVERTENCIA_TASACION),
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
    `INMUEBLE: ${d.inmueble.tipo} en ${d.inmueble.sector}${d.inmueble.precio ? ` · ${d.inmueble.precio}` : ''}`,
    '',
    'RANGO SUGERIDO',
    `Valor central del sector: ${d.central}`,
    `Rango: ${d.minimo} – ${d.maximo}`,
    '',
    'CONCLUSIÓN',
    d.conclusion,
    '',
    ADVERTENCIA_TASACION,
    '',
    ...firmaTexto(d.agente),
    '',
    d.entrega.modo === 'adjunto' ? TEXTO_ADJUNTO : `Descargue el análisis completo (PDF): ${d.entrega.url}\n${textoVencimiento(d.entrega.venceAt)}`,
    ...pieTexto(),
  ].join('\n');

  return { asunto, html: documentoCorreo({ asunto, preencabezado: introduccion(d), secciones }), texto };
}
