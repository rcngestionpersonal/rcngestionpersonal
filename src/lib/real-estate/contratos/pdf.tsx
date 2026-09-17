import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { PDFDocument } from 'pdf-lib';
import { loadFichaFonts } from '@/lib/real-estate/ficha/fonts';
import { pngPageToJpeg } from '@/lib/real-estate/ficha/photos';
import type { BloqueFinal, LineaFirma } from './clausulas';
import { AVISO_FIRMA_ELECTRONICA, AVISO_REDINMO_NO_ES_PARTE_LEGADO } from './legado-firma';
import { AVISO_APROBACION, AVISO_REDINMO_NO_ES_PARTE, NOTA_ANEXO_SEPARABLE } from './tipos';

// PDF del contrato: A4 sobrio y formal, fondo blanco. Misma cadena
// satori -> resvg -> pdf-lib que las fichas y las cartas, con paginación
// propia: un contrato no cabe en una hoja y satori dibuja lienzos de tamaño
// fijo, así que hay que repartir los bloques en páginas antes de dibujar.
//
// EL CUERPO NO LLEVA MARCA DE LA PLATAFORMA. Ni logotipo, ni nombre, ni pie, ni
// código: el contrato es del agente y de sus clientes. El pie de cada página
// dice solo en qué estado está el borrador y el número de página.
//
// La constancia va aparte, como ANEXO con su propio encabezado y su propia
// numeración: identifica el sistema que registró las aprobaciones (su utilidad
// depende de poder verificarla) y se puede quitar al imprimir para la notaría
// sin que la numeración del contrato quede con huecos.

const FONT = 'Plus Jakarta Sans';
const A4 = { width: 794, height: 1123 };
const RASTER = 1588;
const A4_PT: [number, number] = [595.28, 841.89];

const MARGEN_X = 64;
const MARGEN_ARRIBA = 64;
const MARGEN_ABAJO = 64;
const ANCHO_UTIL = A4.width - MARGEN_X * 2;
// Reserva para el pie de página.
const ALTO_PIE = 44;
const ALTO_UTIL = A4.height - MARGEN_ARRIBA - MARGEN_ABAJO - ALTO_PIE;

// Cuerpo en 12px: un contrato se lee entero, no se ojea.
const CUERPO = 12;
const INTERLINEADO = 1.55;
const ALTO_LINEA = CUERPO * INTERLINEADO;
// Caracteres que entran por línea a este ancho y tamaño, medido sobre el render
// real; se usa para estimar cuánto ocupa cada bloque y paginar.
const CARS_POR_LINEA = Math.floor(ANCHO_UTIL / (CUERPO * 0.5));
// Un párrafo más largo que esto se parte en oraciones para que nunca desborde
// una página.
const MAX_CARS_PARRAFO = 2400;

// ---------------------------------------------------------------------------
// Anexos
// ---------------------------------------------------------------------------

export type ParteConstancia = {
  rol: string;
  nombre: string;
  // Compañía por la que aprueba, si es su representante.
  enNombreDe: string | null;
  cedula: string;
  correo: string;
  enviadoAt: string | null;
  abiertoAt: string | null;
  decision: 'APROBO' | 'NO_APROBO' | 'PENDIENTE' | 'SIN_DECISION';
  decisionAt: string | null;
  motivo: string | null;
  ip: string | null;
  navegador: string | null;
  leyoCompleto: boolean;
};

export type AnexoAprobacion = {
  tipo: 'aprobacion';
  nombreDocumento: string;
  codigo: string;
  urlVerificacion: string;
  numero: number;
  estadoVersion: string;
  enviadaAt: string;
  huella: string;
  enviadaPor: string;
  partes: ParteConstancia[];
  historial: Array<{ numero: number; enviadaAt: string; resultado: string }>;
};

export type FirmanteConstanciaLegado = {
  rol: string;
  nombre: string;
  cedula: string;
  correo: string;
  enviadoAt: string | null;
  abiertoAt: string | null;
  firmadoAt: string | null;
  ip: string | null;
  navegador: string | null;
  leyoCompleto: boolean;
};

export type AnexoFirmaLegado = {
  tipo: 'firma-legado';
  nombreDocumento: string;
  codigo: string;
  urlVerificacion: string;
  hash: string | null;
  firmantes: FirmanteConstanciaLegado[];
  nota: string | null;
};

export type DatosPdfContrato = {
  bloques: BloqueFinal[];
  nombreDocumento: string;
  ciudad: string;
  fechaLarga: string;
  avisoSinRevisar: string | null;
  // "Versión 2 — aprobada por ... el ...", "Borrador sin enviar"...
  pie: string | null;
  anexo: AnexoAprobacion | AnexoFirmaLegado | null;
};

// ---------------------------------------------------------------------------
// Paginación del cuerpo
// ---------------------------------------------------------------------------

type ElementoPagina =
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'aviso'; texto: string }
  // Una cláusula se reparte en tramos, uno por párrafo: solo el primero lleva
  // el encabezado. Así una cláusula larga cruza de página sin cortarse a mitad.
  | { tipo: 'tramo'; encabezado: string | null; texto: string; ultimo: boolean }
  | { tipo: 'ficha'; titulo: string; filas: Array<{ etiqueta: string; valor: string }> }
  | { tipo: 'firmas'; leyenda: string | null; partes: LineaFirma[] };

function lineas(texto: string, factorAncho = 1): number {
  return Math.max(1, Math.ceil(texto.length / (CARS_POR_LINEA * factorAncho)));
}

function altoEstimado(el: ElementoPagina): number {
  switch (el.tipo) {
    case 'titulo':
      return lineas(el.texto, 0.7) * 24 + 40;
    case 'subtitulo':
      return 22 + 18;
    case 'parrafo':
      return lineas(el.texto) * ALTO_LINEA + 12;
    case 'aviso':
      return lineas(el.texto, 0.94) * ALTO_LINEA + 34;
    case 'tramo':
      return (el.encabezado ? 22 : 0) + lineas(el.texto) * ALTO_LINEA + (el.ultimo ? 14 : 6);
    case 'ficha':
      return 26 + el.filas.reduce((alto, f) => alto + Math.max(ALTO_LINEA + 8, lineas(f.valor, 0.62) * ALTO_LINEA + 8), 0) + 14;
    case 'firmas': {
      const filas = Math.ceil(el.partes.length / 2);
      const altoParte = Math.max(...el.partes.map((p) => (p.enRepresentacionDe ? 5 : 3)), 3) * 15 + 70;
      return (el.leyenda ? lineas(el.leyenda) * 16 + 12 : 0) + 30 + filas * altoParte;
    }
  }
}

// Parte un párrafo demasiado largo en oraciones, sin pasar del máximo.
function trocear(parrafo: string): string[] {
  if (parrafo.length <= MAX_CARS_PARRAFO) return [parrafo];
  const oraciones = parrafo.match(/[^.;]+[.;]+\s*|[^.;]+$/g) ?? [parrafo];
  const trozos: string[] = [];
  let actual = '';
  for (const o of oraciones) {
    if (actual && actual.length + o.length > MAX_CARS_PARRAFO) {
      trozos.push(actual.trim());
      actual = '';
    }
    actual += o;
  }
  if (actual.trim()) trozos.push(actual.trim());
  return trozos;
}

function aElementos(bloques: BloqueFinal[]): ElementoPagina[] {
  const salida: ElementoPagina[] = [];
  for (const b of bloques) {
    if (b.tipo === 'clausula') {
      const parrafos = b.texto
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .flatMap(trocear);
      if (parrafos.length === 0) parrafos.push('');
      parrafos.forEach((texto, i) =>
        salida.push({ tipo: 'tramo', encabezado: i === 0 ? b.encabezado : null, texto, ultimo: i === parrafos.length - 1 }),
      );
    } else if (b.tipo === 'firmas') {
      salida.push({ tipo: 'firmas', leyenda: b.leyenda, partes: b.partes });
    } else if (b.tipo === 'ficha') {
      salida.push({ tipo: 'ficha', titulo: b.titulo, filas: b.filas });
    } else {
      for (const texto of trocear(b.texto)) salida.push({ tipo: b.tipo, texto });
    }
  }
  return salida;
}

function paginar(elementos: ElementoPagina[]): ElementoPagina[][] {
  const paginas: ElementoPagina[][] = [];
  let actual: ElementoPagina[] = [];
  let alto = 0;
  elementos.forEach((el, i) => {
    let suyo = altoEstimado(el);
    // Un encabezado de cláusula no se queda solo al pie de una página: viaja
    // con su primer párrafo.
    const siguiente = elementos[i + 1];
    if (el.tipo === 'tramo' && el.encabezado && siguiente?.tipo === 'tramo' && !siguiente.encabezado) {
      suyo = Math.max(suyo, 22 + 3 * ALTO_LINEA);
    }
    if (alto + suyo > ALTO_UTIL && actual.length > 0) {
      paginas.push(actual);
      actual = [];
      alto = 0;
    }
    actual.push(el);
    alto += altoEstimado(el);
  });
  if (actual.length > 0) paginas.push(actual);
  return paginas;
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

function Aviso({ texto, fuerte = false }: { texto: string; fuerte?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        border: '1px solid #b45309',
        background: '#fffbeb',
        borderRadius: 6,
        padding: '10px 12px',
        marginBottom: 12,
        fontSize: fuerte ? 11 : 10.5,
        fontWeight: fuerte ? 600 : 400,
        lineHeight: 1.5,
        color: '#7c3f06',
      }}
    >
      {texto}
    </div>
  );
}

function Firma({ parte }: { parte: LineaFirma }) {
  const dato = { display: 'flex', fontSize: 10, color: '#3d3854', lineHeight: 1.45 } as const;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: (ANCHO_UTIL - 32) / 2, marginBottom: 20 }}>
      {/* Espacio para la firma manuscrita. */}
      <div style={{ display: 'flex', height: 52 }} />
      <div style={{ display: 'flex', borderTop: '1px solid #14121f', marginBottom: 6 }} />
      {parte.enRepresentacionDe ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 11, fontWeight: 700 }}>{parte.enRepresentacionDe.razonSocial}</div>
          <div style={dato}>RUC {parte.enRepresentacionDe.ruc}</div>
          <div style={{ ...dato, marginTop: 2 }}>p. {parte.nombre}</div>
          <div style={dato}>
            {parte.tipoDocumento} {parte.documento} · Representante legal
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 11, fontWeight: 700 }}>{parte.nombre}</div>
          <div style={dato}>
            {parte.tipoDocumento} {parte.documento}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', fontSize: 10, fontWeight: 700, letterSpacing: 0.4, marginTop: 2 }}>{parte.calidad}</div>
    </div>
  );
}

function Pie({ izquierda, derecha }: { izquierda: string | null; derecha: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderTop: '1px solid #e7e3f0',
        paddingTop: 8,
        height: ALTO_PIE,
      }}
    >
      <div style={{ display: 'flex', fontSize: 8.5, color: '#6f6a86', lineHeight: 1.4, maxWidth: ANCHO_UTIL - 110 }}>
        {izquierda ?? ''}
      </div>
      <div style={{ display: 'flex', fontSize: 8.5, color: '#6f6a86' }}>{derecha}</div>
    </div>
  );
}

function marco(children: React.ReactNode[]) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: A4.width,
        height: A4.height,
        background: '#ffffff',
        fontFamily: FONT,
        padding: `${MARGEN_ARRIBA}px ${MARGEN_X}px ${MARGEN_ABAJO}px`,
        color: '#14121f',
      }}
    >
      {children}
    </div>
  );
}

function paginaCuerpo(datos: DatosPdfContrato, elementos: ElementoPagina[], numero: number, total: number) {
  return marco([
      <div key="contenido" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        {elementos.map((el, i) => {
          if (el.tipo === 'titulo') {
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', marginBottom: 20 }}>
                <div style={{ display: 'flex', fontSize: 16, fontWeight: 800, justifyContent: 'center', textAlign: 'center' }}>
                  {el.texto}
                </div>
                <div style={{ display: 'flex', fontSize: 10, color: '#5c5676', justifyContent: 'center', marginTop: 6 }}>
                  {datos.ciudad}, {datos.fechaLarga}
                </div>
              </div>
            );
          }
          if (el.tipo === 'subtitulo') {
            return (
              <div key={i} style={{ display: 'flex', fontSize: 11.5, fontWeight: 800, marginTop: 8, marginBottom: 8, letterSpacing: 0.4 }}>
                {el.texto}
              </div>
            );
          }
          if (el.tipo === 'aviso') return <Aviso key={i} texto={el.texto} />;
          if (el.tipo === 'ficha') {
            return (
              <div
                key={i}
                style={{ display: 'flex', flexDirection: 'column', border: '1px solid #d6cfe8', borderRadius: 6, marginTop: 4, marginBottom: 14 }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.4,
                    padding: '7px 12px',
                    borderBottom: '1px solid #e7e3f0',
                    background: '#faf9fc',
                  }}
                >
                  {el.titulo}
                </div>
                {el.filas.map((f, j) => (
                  <div
                    key={f.etiqueta}
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      padding: '6px 12px',
                      ...(j < el.filas.length - 1 ? { borderBottom: '1px solid #f0edf6' } : {}),
                    }}
                  >
                    <div style={{ display: 'flex', width: 170, fontSize: 10.5, fontWeight: 700, color: '#5c5676' }}>{f.etiqueta}</div>
                    <div style={{ display: 'flex', flexGrow: 1, flexShrink: 1, fontSize: 10.5, lineHeight: 1.45 }}>{f.valor}</div>
                  </div>
                ))}
              </div>
            );
          }
          if (el.tipo === 'tramo') {
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', marginBottom: el.ultimo ? 12 : 6 }}>
                {el.encabezado ? (
                  <div style={{ display: 'flex', fontSize: CUERPO, fontWeight: 700, marginBottom: 4 }}>{el.encabezado}</div>
                ) : null}
                <div style={{ display: 'flex', fontSize: CUERPO, lineHeight: INTERLINEADO, textAlign: 'justify' }}>{el.texto}</div>
              </div>
            );
          }
          if (el.tipo === 'firmas') {
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', marginTop: 22 }}>
                {el.leyenda ? (
                  <div style={{ display: 'flex', fontSize: 10.5, color: '#5c5676', marginBottom: 12 }}>{el.leyenda}</div>
                ) : null}
                <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {el.partes.map((p, j) => (
                    <Firma key={`${p.calidad}-${j}`} parte={p} />
                  ))}
                </div>
              </div>
            );
          }
          return (
            <div key={i} style={{ display: 'flex', fontSize: CUERPO, lineHeight: INTERLINEADO, marginBottom: 10, textAlign: 'justify' }}>
              {el.texto}
            </div>
          );
        })}
      </div>,
      <Pie key="pie" izquierda={datos.pie} derecha={`Página ${numero} de ${total}`} />
  ]);
}

const ETIQUETA = { display: 'flex', fontSize: 8.5, color: '#6f6a86', width: 140, flexShrink: 0 } as const;
const VALOR = { display: 'flex', fontSize: 9, color: '#14121f', flexGrow: 1, flexShrink: 1 } as const;

function Fila({ k, v, pequeno = false }: { k: string; v: string; pequeno?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', marginBottom: 2 }}>
      <div style={ETIQUETA}>{k}</div>
      <div style={{ ...VALOR, ...(pequeno ? { fontSize: 7.5 } : {}) }}>{v}</div>
    </div>
  );
}

function encabezadoAnexo(titulo: string, subtitulo: string) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid #d6cfe8', paddingBottom: 10, marginBottom: 12 }}>
      <div style={{ display: 'flex', fontSize: 9, fontWeight: 800, letterSpacing: 1.2, color: '#6f6a86' }}>ANEXO</div>
      <div style={{ display: 'flex', fontSize: 15, fontWeight: 800, marginTop: 2 }}>{titulo}</div>
      <div style={{ display: 'flex', fontSize: 9.5, color: '#5c5676', marginTop: 3 }}>{subtitulo}</div>
    </div>
  );
}

const DECISION: Record<ParteConstancia['decision'], string> = {
  APROBO: 'Aprobó esta versión',
  NO_APROBO: 'No aprobó esta versión',
  PENDIENTE: 'Pendiente',
  SIN_DECISION: 'Sin decisión: se envió una versión posterior',
};

function paginaAnexoAprobacion(a: AnexoAprobacion, numero: number, total: number) {
  return marco([
      <div key="contenido" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        {encabezadoAnexo('Constancia de aprobación de borrador', `Registro generado por Redinmo.io · ${a.nombreDocumento}`)}

        <div style={{ display: 'flex', fontSize: 9.5, color: '#5c5676', lineHeight: 1.45, marginBottom: 10 }}>{NOTA_ANEXO_SEPARABLE}</div>
        <Aviso texto={AVISO_APROBACION} fuerte />

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 10 }}>
          <Fila k="Identificador" v={a.codigo} />
          <Fila k="Versión" v={`${a.numero} · ${a.estadoVersion}`} />
          <Fila k="Enviada" v={`${a.enviadaAt} por ${a.enviadaPor}`} />
          <Fila k="Huella del texto (SHA-256)" v={a.huella} pequeno />
          <Fila k="Verificación" v={a.urlVerificacion} />
        </div>
        <div style={{ display: 'flex', fontSize: 8.5, color: '#6f6a86', lineHeight: 1.4, marginBottom: 10 }}>
          La huella identifica el texto exacto de esta versión: un texto con una sola letra distinta tiene otra huella.
        </div>

        {a.partes.map((p) => (
          <div
            key={p.rol + p.correo}
            style={{ display: 'flex', flexDirection: 'column', border: '1px solid #d6cfe8', borderRadius: 6, padding: '9px 12px', marginBottom: 8 }}
          >
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
              <div style={{ display: 'flex', fontSize: 10.5, fontWeight: 700 }}>
                {p.nombre} — {p.rol}
                {p.enNombreDe ? ` · por ${p.enNombreDe}` : ''}
              </div>
              <div style={{ display: 'flex', fontSize: 9.5, fontWeight: 700, color: p.decision === 'APROBO' ? '#0b7568' : p.decision === 'NO_APROBO' ? '#b42318' : '#6f6a86' }}>
                {DECISION[p.decision]}
              </div>
            </div>
            <Fila k="Cédula" v={p.cedula} />
            <Fila k="Correo notificado" v={p.correo} />
            <Fila k="Envío del enlace" v={p.enviadoAt ?? '—'} />
            <Fila k="Primer acceso" v={p.abiertoAt ?? '—'} />
            <Fila k={p.decision === 'NO_APROBO' ? 'Decisión registrada' : 'Aprobación registrada'} v={p.decisionAt ?? '—'} />
            {p.motivo ? <Fila k="Motivo indicado" v={p.motivo} /> : null}
            <Fila k="Dirección IP" v={p.ip ?? '—'} />
            <Fila k="Navegador y dispositivo" v={p.navegador ?? '—'} />
            <Fila k="Leyó hasta el final" v={p.decisionAt ? (p.leyoCompleto ? 'Sí' : 'No') : '—'} />
          </div>
        ))}

        {a.historial.length > 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
            <div style={{ display: 'flex', fontSize: 10, fontWeight: 800, marginBottom: 4 }}>Recorrido del documento</div>
            {a.historial.slice(-12).map((h) => (
              <Fila key={h.numero} k={`Versión ${h.numero} · ${h.enviadaAt}`} v={h.resultado} />
            ))}
          </div>
        ) : null}
      </div>,
      <Pie key="pie" izquierda={AVISO_REDINMO_NO_ES_PARTE} derecha={`Anexo · ${numero} de ${total}`} />
  ]);
}

function paginaAnexoFirmaLegado(a: AnexoFirmaLegado, numero: number, total: number) {
  return marco([
      <div key="contenido" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        {encabezadoAnexo('Constancia de firma electrónica', `Registro generado por Redinmo.io · ${a.nombreDocumento}`)}
        <Aviso texto={AVISO_FIRMA_ELECTRONICA} />
        {a.nota ? <Aviso texto={a.nota} fuerte /> : null}
        {a.firmantes.map((f) => (
          <div
            key={f.rol + f.correo}
            style={{ display: 'flex', flexDirection: 'column', border: '1px solid #d6cfe8', borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}
          >
            <div style={{ display: 'flex', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
              {f.nombre} — {f.rol}
            </div>
            <Fila k="Cédula / RUC" v={f.cedula} />
            <Fila k="Correo notificado" v={f.correo} />
            <Fila k="Envío del enlace" v={f.enviadoAt ?? '—'} />
            <Fila k="Primer acceso" v={f.abiertoAt ?? '—'} />
            <Fila k="Firma registrada" v={f.firmadoAt ?? '—'} />
            <Fila k="Dirección IP" v={f.ip ?? '—'} />
            <Fila k="Navegador y dispositivo" v={f.navegador ?? '—'} />
            <Fila k="Leyó el texto hasta el final" v={f.leyoCompleto ? 'Sí' : 'No'} />
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
          <Fila k="Identificador" v={a.codigo} />
          <Fila k="Hash SHA-256" v={a.hash ?? '—'} pequeno />
          <Fila k="Verificación" v={a.urlVerificacion} />
        </div>
      </div>,
      <Pie key="pie" izquierda={AVISO_REDINMO_NO_ES_PARTE_LEGADO} derecha={`Anexo · ${numero} de ${total}`} />
  ]);
}

async function aPng(node: Parameters<typeof satori>[0]): Promise<Buffer> {
  const fonts = loadFichaFonts();
  const svg = await satori(node, { width: A4.width, height: A4.height, fonts });
  return new Resvg(svg, { fitTo: { mode: 'width', value: RASTER }, background: '#ffffff' }).render().asPng();
}

async function agregarPagina(pdf: PDFDocument, node: Parameters<typeof satori>[0]) {
  const jpg = await pngPageToJpeg(await aPng(node));
  const img = await pdf.embedJpg(jpg);
  pdf.addPage(A4_PT).drawImage(img, { x: 0, y: 0, width: A4_PT[0], height: A4_PT[1] });
}

export async function renderContratoPdf(datos: DatosPdfContrato): Promise<Buffer> {
  const elementos = aElementos(datos.bloques);
  // El aviso de plantilla sin revisar se inyecta arriba de todo y NO puede
  // quitarse desde el formulario: viene del archivo de plantilla.
  if (datos.avisoSinRevisar) elementos.unshift({ tipo: 'aviso', texto: datos.avisoSinRevisar });

  const paginas = paginar(elementos);

  const pdf = await PDFDocument.create();
  // Metadatos neutros: el archivo es del agente y de sus clientes.
  pdf.setProducer('');
  pdf.setCreator('');
  pdf.setTitle(datos.nombreDocumento);

  for (let i = 0; i < paginas.length; i += 1) {
    await agregarPagina(pdf, paginaCuerpo(datos, paginas[i], i + 1, paginas.length));
  }

  if (datos.anexo?.tipo === 'aprobacion') await agregarPagina(pdf, paginaAnexoAprobacion(datos.anexo, 1, 1));
  else if (datos.anexo?.tipo === 'firma-legado') await agregarPagina(pdf, paginaAnexoFirmaLegado(datos.anexo, 1, 1));

  return Buffer.from(await pdf.save());
}
