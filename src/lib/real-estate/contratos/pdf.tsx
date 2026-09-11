import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { PDFDocument } from 'pdf-lib';
import crypto from 'crypto';
import { loadFichaFonts } from '@/lib/real-estate/ficha/fonts';
import { pngPageToJpeg } from '@/lib/real-estate/ficha/photos';
import { romano } from './documento';
import type { BloqueDocumento } from './plantillas';
import { AVISO_FIRMA_ELECTRONICA, AVISO_REDINMO_NO_ES_PARTE, NOTA_PIE_PDF } from './tipos';

// PDF del contrato: A4 sobrio y formal, fondo blanco (punto 6.1). Misma cadena
// satori -> resvg -> pdf-lib que las fichas y las cartas, pero con paginacion
// propia: un contrato no cabe en una hoja y satori dibuja lienzos de tamaño
// fijo, asi que hay que repartir los bloques en paginas antes de dibujar.

const FONT = 'Plus Jakarta Sans';
const A4 = { width: 794, height: 1123 };
const RASTER = 1588;
const A4_PT: [number, number] = [595.28, 841.89];

const MARGEN_X = 64;
const MARGEN_ARRIBA = 56;
const MARGEN_ABAJO = 64;
const ANCHO_UTIL = A4.width - MARGEN_X * 2;
const ALTO_UTIL = A4.height - MARGEN_ARRIBA - MARGEN_ABAJO;

// Cuerpo en 12px (punto 6.4 pide 11 como minimo): un contrato se lee entero,
// no se ojea. Con 12px y 1.55 de interlineado entran ~46 lineas por pagina sin
// que la lectura canse.
const CUERPO = 12;
const INTERLINEADO = 1.55;
const ALTO_LINEA = CUERPO * INTERLINEADO;
// Caracteres que entran por linea a este ancho y tamaño. Medido sobre el
// render real; se usa para estimar cuanto ocupa cada bloque y paginar.
const CARS_POR_LINEA = Math.floor(ANCHO_UTIL / (CUERPO * 0.5));

export type FirmanteConstancia = {
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

export type DatosPdfContrato = {
  bloques: BloqueDocumento[];
  nombreDocumento: string;
  ciudad: string;
  fechaLarga: string;
  agente: { nombre: string; empresa: string | null; correo: string; telefono: string; verificado: boolean };
  plantillaVersion: string;
  avisoSinRevisar: string | null;
  // Presentes solo cuando el documento ya esta firmado y sellado.
  codigoVerificacion: string;
  hashDocumento: string | null;
  firmantes: FirmanteConstancia[];
  urlVerificacion: string;
};

type ElementoPagina =
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'clausula'; encabezado: string; texto: string }
  | { tipo: 'aviso'; texto: string }
  | { tipo: 'ficha'; titulo: string; filas: Array<{ etiqueta: string; valor: string }> }
  | { tipo: 'firmas'; nombres: Array<{ rol: string; nombre: string; cedula: string }> };

function altoEstimado(el: ElementoPagina): number {
  const lineas = (texto: string, factorAncho = 1) =>
    Math.max(1, Math.ceil(texto.length / (CARS_POR_LINEA * factorAncho))) * ALTO_LINEA;
  switch (el.tipo) {
    case 'titulo':
      return 34 + 26;
    case 'subtitulo':
      return 22 + 18;
    case 'parrafo':
      return lineas(el.texto) + 12;
    case 'clausula':
      return 18 + lineas(`${el.encabezado} ${el.texto}`) + 16;
    case 'aviso':
      // Recuadro con padding: ocupa mas que su texto.
      return lineas(el.texto, 0.94) + 34;
    case 'ficha':
      // Cada fila es una linea de tabla; el valor puede envolver a dos.
      return 26 + el.filas.reduce((alto, f) => alto + Math.max(ALTO_LINEA + 8, lineas(f.valor, 0.62) + 8), 0) + 12;
    case 'firmas':
      return 60 + el.nombres.length * 78;
  }
}

function aElementos(bloques: BloqueDocumento[], firmantes: FirmanteConstancia[]): ElementoPagina[] {
  let numero = 0;
  const salida: ElementoPagina[] = [];
  for (const bloque of bloques) {
    if (bloque.tipo === 'clausula') {
      numero += 1;
      salida.push({ tipo: 'clausula', encabezado: `${romano(numero)}. ${bloque.titulo}:`, texto: bloque.texto });
    } else if (bloque.tipo === 'firmas') {
      salida.push({
        tipo: 'firmas',
        nombres: firmantes.map((f) => ({ rol: f.rol, nombre: f.nombre, cedula: f.cedula })),
      });
    } else if (bloque.tipo === 'ficha') {
      salida.push({ tipo: 'ficha', titulo: bloque.titulo, filas: bloque.filas });
    } else {
      salida.push({ tipo: bloque.tipo, texto: bloque.texto });
    }
  }
  return salida;
}

function paginar(elementos: ElementoPagina[]): ElementoPagina[][] {
  const paginas: ElementoPagina[][] = [];
  let actual: ElementoPagina[] = [];
  let alto = 0;
  for (const el of elementos) {
    const suyo = altoEstimado(el);
    if (alto + suyo > ALTO_UTIL && actual.length > 0) {
      paginas.push(actual);
      actual = [];
      alto = 0;
    }
    actual.push(el);
    alto += suyo;
  }
  if (actual.length > 0) paginas.push(actual);
  return paginas;
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div
      style={{
        display: 'flex',
        border: '1px solid #b45309',
        background: '#fffbeb',
        borderRadius: 6,
        padding: '10px 12px',
        marginBottom: 12,
        fontSize: 10.5,
        lineHeight: 1.5,
        color: '#7c3f06',
      }}
    >
      {texto}
    </div>
  );
}

function pagina(
  datos: DatosPdfContrato,
  elementos: ElementoPagina[],
  numeroPagina: number,
  totalPaginas: number,
) {
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
      {/* Encabezado con los datos del agente (punto 6.2) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          paddingBottom: 10,
          marginBottom: 18,
          borderBottom: '1px solid #d6cfe8',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 11, fontWeight: 700 }}>{datos.agente.nombre}</div>
          {datos.agente.empresa ? (
            <div style={{ display: 'flex', fontSize: 9.5, color: '#5c5676', marginTop: 1 }}>{datos.agente.empresa}</div>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          {datos.agente.verificado ? (
            <div style={{ display: 'flex', fontSize: 9, fontWeight: 700, color: '#0b7568' }}>
              Agente verificado en Redinmo
            </div>
          ) : null}
          <div style={{ display: 'flex', fontSize: 9, color: '#8983a2', marginTop: 1 }}>
            {datos.agente.telefono} · {datos.agente.correo}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        {elementos.map((el, i) => {
          if (el.tipo === 'titulo') {
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', marginBottom: 18 }}>
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
              <div
                key={i}
                style={{ display: 'flex', fontSize: 11.5, fontWeight: 800, marginTop: 8, marginBottom: 8, letterSpacing: 0.4 }}
              >
                {el.texto}
              </div>
            );
          }
          if (el.tipo === 'aviso') return <Aviso key={i} texto={el.texto} />;
          if (el.tipo === 'ficha') {
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid #d6cfe8',
                  borderRadius: 6,
                  marginTop: 4,
                  marginBottom: 14,
                }}
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
                    <div style={{ display: 'flex', width: 170, fontSize: 10.5, fontWeight: 700, color: '#5c5676' }}>
                      {f.etiqueta}
                    </div>
                    <div style={{ display: 'flex', flexGrow: 1, fontSize: 10.5, lineHeight: 1.45 }}>{f.valor}</div>
                  </div>
                ))}
              </div>
            );
          }
          if (el.tipo === 'clausula') {
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', marginBottom: 12 }}>
                <div style={{ display: 'flex', fontSize: CUERPO, fontWeight: 700, marginBottom: 3 }}>{el.encabezado}</div>
                <div style={{ display: 'flex', fontSize: CUERPO, lineHeight: INTERLINEADO, textAlign: 'justify' }}>
                  {el.texto}
                </div>
              </div>
            );
          }
          if (el.tipo === 'firmas') {
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', marginTop: 26 }}>
                <div style={{ display: 'flex', fontSize: 10.5, color: '#5c5676', marginBottom: 18 }}>
                  Las partes suscriben el presente instrumento mediante firma electrónica, en la fecha y con la
                  constancia que se detalla al final.
                </div>
                {el.nombres.map((f) => (
                  <div key={f.rol} style={{ display: 'flex', flexDirection: 'column', marginBottom: 22 }}>
                    <div style={{ display: 'flex', width: 260, borderTop: '1px solid #14121f', paddingTop: 4 }} />
                    <div style={{ display: 'flex', fontSize: 11, fontWeight: 700 }}>{f.nombre}</div>
                    <div style={{ display: 'flex', fontSize: 10, color: '#5c5676' }}>
                      C.C./RUC {f.cedula} · {f.rol}
                    </div>
                  </div>
                ))}
              </div>
            );
          }
          return (
            <div
              key={i}
              style={{ display: 'flex', fontSize: CUERPO, lineHeight: INTERLINEADO, marginBottom: 10, textAlign: 'justify' }}
            >
              {el.texto}
            </div>
          );
        })}
      </div>

      {/* Pie: marca discreta + numeracion (puntos 6.1 y 6.3).
          La nota va SOLO en la primera y en la ultima pagina. Repetida en las
          siete se lee como descargo de responsabilidad; una vez, como nota
          informativa. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderTop: '1px solid #e7e3f0',
          paddingTop: 8,
          marginTop: 10,
        }}
      >
        {numeroPagina === 1 || numeroPagina === totalPaginas ? (
          <div style={{ display: 'flex', fontSize: 8.5, color: '#8983a2', lineHeight: 1.45 }}>{NOTA_PIE_PDF}</div>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <div style={{ display: 'flex', fontSize: 8.5, color: '#8983a2' }}>
            redinmo.io · doc. {datos.codigoVerificacion} · plantilla {datos.plantillaVersion}
          </div>
          <div style={{ display: 'flex', fontSize: 8.5, color: '#8983a2' }}>
            Página {numeroPagina} de {totalPaginas}
          </div>
        </div>
      </div>
    </div>
  );
}

// Ultima pagina: constancia de firma electronica (punto 3.6).
function paginaConstancia(datos: DatosPdfContrato, numeroPagina: number, totalPaginas: number) {
  const celda = { display: 'flex', fontSize: 9, color: '#14121f', flexGrow: 1 } as const;
  const etiqueta = { display: 'flex', fontSize: 8.5, color: '#8983a2', width: 130 } as const;

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
      <div style={{ display: 'flex', fontSize: 15, fontWeight: 800, marginBottom: 6 }}>
        Constancia de firma electrónica
      </div>
      <div style={{ display: 'flex', fontSize: 10, color: '#5c5676', marginBottom: 14 }}>
        Documento {datos.codigoVerificacion} · {datos.nombreDocumento}
      </div>

      <Aviso texto={AVISO_FIRMA_ELECTRONICA} />

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {datos.firmantes.map((f) => (
          <div
            key={f.rol + f.correo}
            style={{
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #d6cfe8',
              borderRadius: 6,
              padding: '10px 12px',
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
              {f.nombre} — {f.rol}
            </div>
            {[
              ['Cédula / RUC', f.cedula],
              ['Correo notificado', f.correo],
              ['Envío del enlace', f.enviadoAt ?? '—'],
              ['Primer acceso', f.abiertoAt ?? '—'],
              ['Firma registrada', f.firmadoAt ?? '—'],
              ['Dirección IP', f.ip ?? '—'],
              ['Navegador y dispositivo', f.navegador ?? '—'],
              ['Leyó el texto hasta el final', f.leyoCompleto ? 'Sí' : 'No'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'row', marginBottom: 2 }}>
                <div style={etiqueta}>{k}</div>
                <div style={celda}>{v}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'row', marginBottom: 2 }}>
          <div style={etiqueta}>Identificador</div>
          <div style={celda}>{datos.codigoVerificacion}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', marginBottom: 2 }}>
          <div style={etiqueta}>Hash SHA-256</div>
          <div style={{ ...celda, fontSize: 8 }}>{datos.hashDocumento ?? '—'}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <div style={etiqueta}>Verificación</div>
          <div style={celda}>{datos.urlVerificacion}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexGrow: 1 }} />

      <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid #e7e3f0', paddingTop: 8 }}>
        <div style={{ display: 'flex', fontSize: 8.5, color: '#8983a2', lineHeight: 1.45 }}>
          {AVISO_REDINMO_NO_ES_PARTE}
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <div style={{ display: 'flex', fontSize: 8.5, color: '#8983a2' }}>{NOTA_PIE_PDF}</div>
          <div style={{ display: 'flex', fontSize: 8.5, color: '#8983a2' }}>
            Página {numeroPagina} de {totalPaginas}
          </div>
        </div>
      </div>
    </div>
  );
}

async function aPng(node: Parameters<typeof satori>[0]): Promise<Buffer> {
  const fonts = loadFichaFonts();
  const svg = await satori(node, { width: A4.width, height: A4.height, fonts });
  return new Resvg(svg, { fitTo: { mode: 'width', value: RASTER }, background: '#ffffff' }).render().asPng();
}

export async function renderContratoPdf(datos: DatosPdfContrato): Promise<Buffer> {
  const elementos = aElementos(datos.bloques, datos.firmantes);
  // El aviso de plantilla sin revisar se inyecta arriba de todo y NO puede
  // quitarse desde el formulario: viene del archivo de plantilla.
  if (datos.avisoSinRevisar) elementos.unshift({ tipo: 'aviso', texto: datos.avisoSinRevisar });

  const paginas = paginar(elementos);
  const hayConstancia = datos.firmantes.some((f) => f.firmadoAt);
  const total = paginas.length + (hayConstancia ? 1 : 0);

  const pdf = await PDFDocument.create();
  pdf.setProducer('Redinmo.io');
  pdf.setCreator('Redinmo.io');
  pdf.setTitle(`${datos.nombreDocumento} - ${datos.codigoVerificacion}`);

  for (let i = 0; i < paginas.length; i += 1) {
    const png = await aPng(pagina(datos, paginas[i], i + 1, total));
    const jpg = await pngPageToJpeg(png);
    const img = await pdf.embedJpg(jpg);
    pdf.addPage(A4_PT).drawImage(img, { x: 0, y: 0, width: A4_PT[0], height: A4_PT[1] });
  }

  if (hayConstancia) {
    const png = await aPng(paginaConstancia(datos, total, total));
    const jpg = await pngPageToJpeg(png);
    const img = await pdf.embedJpg(jpg);
    pdf.addPage(A4_PT).drawImage(img, { x: 0, y: 0, width: A4_PT[0], height: A4_PT[1] });
  }

  return Buffer.from(await pdf.save());
}

export function hashDocumento(texto: string): string {
  return crypto.createHash('sha256').update(texto, 'utf8').digest('hex');
}
