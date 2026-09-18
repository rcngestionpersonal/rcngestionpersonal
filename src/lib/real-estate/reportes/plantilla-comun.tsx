import type { ReactNode } from 'react';
import type { CartaEncabezado } from '@/lib/real-estate/cartas/plantilla';
import type { FichaPalette } from '@/lib/real-estate/ficha/palettes';

// Esqueleto comun de los tres reportes (punto 4.1): la marca del agente
// arriba y protagonista, el titulo del reporte, el cuerpo y un pie donde
// Redinmo aparece discreto.
//
// TIPOGRAFIA: nada por debajo de 10px. El propietario puede imprimirlo, y en
// el celular se lee con zoom: un 9px que en pantalla parece aceptable en papel
// es ilegible.
//
// satori exige display:flex en todo contenedor con mas de un hijo. Por eso
// hasta el div mas simple lo declara.

export const FUENTE = 'Plus Jakarta Sans';
const MARGEN = 48;

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function DocumentoReporte({
  encabezado,
  palette,
  etiqueta,
  titulo,
  subtitulo,
  fecha,
  children,
  width,
  height,
}: {
  encabezado: CartaEncabezado;
  palette: FichaPalette;
  etiqueta: string;
  titulo: string;
  subtitulo: string;
  fecha: string;
  children: ReactNode;
  width: number;
  height: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width,
        height,
        background: palette.bg,
        fontFamily: FUENTE,
        padding: `36px ${MARGEN}px 24px`,
      }}
    >
      {/* ---- Marca del agente ---- */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {encabezado.imagenDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={encabezado.imagenDataUri}
            alt=""
            width={56}
            height={56}
            style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              width: 56,
              height: 56,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              background: palette.violetaDim,
              color: palette.violeta,
              fontSize: 20,
              fontWeight: 800,
            }}
          >
            {iniciales(encabezado.nombre)}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          <div style={{ display: 'flex', fontSize: 18, fontWeight: 800, color: palette.text }}>{encabezado.nombre}</div>
          {encabezado.empresa ? (
            <div style={{ display: 'flex', fontSize: 12, fontWeight: 600, color: palette.text2, marginTop: 1 }}>{encabezado.empresa}</div>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <div style={{ display: 'flex', fontSize: 11, color: palette.text2 }}>{encabezado.telefono}</div>
          {encabezado.correo ? <div style={{ display: 'flex', fontSize: 11, color: palette.text2 }}>{encabezado.correo}</div> : null}
          {encabezado.licencia ? (
            <div style={{ display: 'flex', fontSize: 10, color: palette.text3 }}>Lic. Prof.: {encabezado.licencia}</div>
          ) : null}
        </div>
      </div>

      {/* ---- Titulo del reporte ---- */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: 18,
          paddingTop: 14,
          borderTop: `2px solid ${palette.violetaLine}`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 520, flexShrink: 1 }}>
          <div style={{ display: 'flex', fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4, color: palette.violeta }}>{etiqueta}</div>
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 800, color: palette.text, marginTop: 4, lineHeight: 1.2 }}>{titulo}</div>
          <div style={{ display: 'flex', fontSize: 12, color: palette.text2, marginTop: 3 }}>{subtitulo}</div>
        </div>
        <div style={{ display: 'flex', flexShrink: 0, marginLeft: 16, fontSize: 11, color: palette.text3 }}>{fecha}</div>
      </div>

      {/* ---- Cuerpo ---- */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 18, flexGrow: 1 }}>{children}</div>

      {/* ---- Pie: Redinmo discreto ---- */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 14,
          paddingTop: 10,
          borderTop: `1px solid ${palette.line}`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 10, fontWeight: 700, color: palette.text3 }}>Generado con redinmo.io</div>
          {encabezado.urlMiniSitio ? (
            <div style={{ display: 'flex', fontSize: 10, color: palette.text3, marginTop: 1 }}>
              Conoce mi trabajo en {encabezado.urlMiniSitio}
            </div>
          ) : null}
        </div>
        {encabezado.qrDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={encabezado.qrDataUri} alt="" width={46} height={46} style={{ width: 46, height: 46 }} />
        ) : null}
      </div>
    </div>
  );
}

// Bloque con titulo pequeño en mayusculas. Es la unidad de lectura de los tres
// reportes: el propietario escanea los titulos y se detiene en lo que le importa.
export function Seccion({ palette, titulo, children, marginTop = 14 }: { palette: FichaPalette; titulo: string; children: ReactNode; marginTop?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop }}>
      <div style={{ display: 'flex', fontSize: 10.5, fontWeight: 800, letterSpacing: 1.1, color: palette.text3, marginBottom: 6 }}>
        {titulo.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

export function Parrafo({ palette, angosto, children }: { palette: FichaPalette; angosto?: boolean; children: ReactNode }) {
  // Justificado, igual que el cuerpo de los contratos. Solo los párrafos: los
  // títulos, los datos sueltos y las tablas se alinean a la izquierda.
  //
  // "angosto" para los párrafos que viven en media columna: este render no
  // parte palabras, y a ~40 caracteres por línea el justificado abre huecos
  // entre palabras. Ahí se lee mejor alineado a la izquierda.
  return (
    <div style={{ display: 'flex', fontSize: 12.5, lineHeight: 1.55, color: palette.text, textAlign: angosto ? 'left' : 'justify' }}>
      {children}
    </div>
  );
}

// Dato suelto: etiqueta arriba, valor abajo. Para grillas de 2 a 4 columnas.
export function Dato({ palette, etiqueta, valor, ancho }: { palette: FichaPalette; etiqueta: string; valor: string; ancho: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: ancho }}>
      <div style={{ display: 'flex', fontSize: 10, fontWeight: 700, color: palette.text3 }}>{etiqueta}</div>
      <div style={{ display: 'flex', fontSize: 13.5, fontWeight: 700, color: palette.text, marginTop: 2 }}>{valor}</div>
    </div>
  );
}

// Cifra grande con su etiqueta: la unidad del reporte de gestion.
export function Cifra({ palette, valor, etiqueta, ancho }: { palette: FichaPalette; valor: string; etiqueta: string; ancho: number }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: ancho,
        padding: '10px 12px',
        borderRadius: 10,
        background: palette.surface2,
        border: `1px solid ${palette.line}`,
      }}
    >
      <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, color: palette.text }}>{valor}</div>
      <div style={{ display: 'flex', fontSize: 10.5, color: palette.text2, marginTop: 2 }}>{etiqueta}</div>
    </div>
  );
}

export const ANCHO_UTIL = 794 - MARGEN * 2;
