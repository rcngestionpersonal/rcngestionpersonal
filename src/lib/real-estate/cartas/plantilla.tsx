import type { FichaPalette } from '@/lib/real-estate/ficha/palettes';
import { CARTA_BLOQUES, type CartaBloques } from './tipos';

// Plantilla A4 de la carta de presentacion (punto 4). Se dibuja con satori,
// igual que las fichas, para reusar la misma cadena JSX -> SVG -> PNG -> PDF
// y el mismo set de fuentes embebidas.
//
// TIPOGRAFIA (punto 4.3): nada por debajo de 10px y el cuerpo en 13px. Una
// carta se lee de corrido, no se ojea como una ficha: la legibilidad manda
// sobre la densidad, asi que aca sobra el aire y no se comprime nada para
// ganar espacio.

const FONT = 'Plus Jakarta Sans';

export type CartaEncabezado = {
  nombre: string;
  empresa: string | null;
  telefono: string;
  correo: string | null;
  direccion: string | null;
  // Foto de perfil o logo de la empresa, ya resuelta a data URI.
  imagenDataUri: string | null;
  verificado: boolean;
  licencia: string | null;
  // QR al mini-sitio del agente, para el pie (punto 4.2).
  qrDataUri: string | null;
  urlMiniSitio: string | null;
};

export type CartaDestinatarioImpreso = {
  nombre: string;
  cargo: string | null;
};

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function cartaA4Page({
  encabezado,
  destinatario,
  bloques,
  fecha,
  palette,
  width,
  height,
}: {
  encabezado: CartaEncabezado;
  destinatario: CartaDestinatarioImpreso;
  bloques: CartaBloques;
  fecha: string;
  palette: FichaPalette;
  width: number;
  height: number;
}) {
  const marginX = 56;

  const parrafos = CARTA_BLOQUES.map((clave) => bloques[clave]?.trim() ?? '').filter(Boolean);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width,
        height,
        background: palette.bg,
        fontFamily: FONT,
        padding: `44px ${marginX}px 30px`,
      }}
    >
      {/* ---- ENCABEZADO: identidad del agente (punto 4.2) ---- */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          paddingBottom: 18,
          borderBottom: `2px solid ${palette.violetaLine}`,
        }}
      >
        {encabezado.imagenDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={encabezado.imagenDataUri}
            alt=""
            width={64}
            height={64}
            style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              width: 64,
              height: 64,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              background: palette.violetaDim,
              color: palette.violeta,
              fontSize: 22,
              fontWeight: 800,
            }}
          >
            {iniciales(encabezado.nombre)}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          <div style={{ display: 'flex', fontSize: 19, fontWeight: 800, color: palette.text }}>{encabezado.nombre}</div>
          {encabezado.empresa ? (
            <div style={{ display: 'flex', fontSize: 13, fontWeight: 600, color: palette.text2, marginTop: 2 }}>
              {encabezado.empresa}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <div style={{ display: 'flex', fontSize: 11.5, color: palette.text2 }}>{encabezado.telefono}</div>
          {encabezado.correo ? (
            <div style={{ display: 'flex', fontSize: 11.5, color: palette.text2 }}>{encabezado.correo}</div>
          ) : null}
          {encabezado.direccion ? (
            <div style={{ display: 'flex', fontSize: 11.5, color: palette.text3, maxWidth: 250, textAlign: 'right' }}>
              {encabezado.direccion}
            </div>
          ) : null}
        </div>
      </div>

      {/* ---- DESTINATARIO Y FECHA (punto 4.2) ---- */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginTop: 30,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 13, fontWeight: 700, color: palette.text }}>{destinatario.nombre}</div>
          {destinatario.cargo ? (
            <div style={{ display: 'flex', fontSize: 12, color: palette.text2, marginTop: 2 }}>{destinatario.cargo}</div>
          ) : null}
        </div>
        <div style={{ display: 'flex', fontSize: 12, color: palette.text3 }}>{fecha}</div>
      </div>

      {/* ---- CUERPO ---- 13px minimo y 21px de interlineado: es el bloque que
           de verdad se lee, y se le da todo el aire de la pagina. */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26 }}>
        {parrafos.map((texto, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              fontSize: 13,
              lineHeight: 1.62,
              color: palette.text,
              marginBottom: 13,
            }}
          >
            {texto}
          </div>
        ))}
      </div>

      {/* ---- FIRMA (punto 4.2) ---- Va pegada al cuerpo, no al pie: en una
           carta de media pagina, empujarla al fondo deja un hueco que se lee
           como si faltara texto. El espacio sobrante queda debajo. */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 18 }}>
        <div style={{ display: 'flex', fontSize: 13, fontWeight: 700, color: palette.text }}>{encabezado.nombre}</div>
        {encabezado.empresa ? (
          <div style={{ display: 'flex', fontSize: 12, color: palette.text2, marginTop: 2 }}>{encabezado.empresa}</div>
        ) : null}
        {encabezado.licencia ? (
          <div style={{ display: 'flex', fontSize: 11, color: palette.text3, marginTop: 2 }}>
            Lic. Prof.: {encabezado.licencia}
          </div>
        ) : null}
        {encabezado.verificado ? (
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              marginTop: 8,
              padding: '5px 11px',
              borderRadius: 999,
              background: palette.tealDim,
              border: `1px solid ${palette.tealLine}`,
              color: palette.teal,
              fontSize: 10.5,
              fontWeight: 700,
            }}
          >
            Agente verificado en Redinmo.io
          </div>
        ) : null}
      </div>

      {/* Empuja el pie al fondo de la hoja sin arrastrar la firma con el. */}
      <div style={{ display: 'flex', flexGrow: 1 }} />

      {/* ---- PIE: marca discreta + QR al mini-sitio (punto 4.2) ---- */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 20,
          paddingTop: 14,
          borderTop: `1px solid ${palette.line}`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 10.5, fontWeight: 700, color: palette.violeta }}>redinmo.io</div>
          {encabezado.urlMiniSitio ? (
            <div style={{ display: 'flex', fontSize: 10, color: palette.text3, marginTop: 2 }}>
              {encabezado.urlMiniSitio}
            </div>
          ) : null}
        </div>
        {encabezado.qrDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={encabezado.qrDataUri} alt="" width={54} height={54} style={{ width: 54, height: 54 }} />
        ) : null}
      </div>
    </div>
  );
}
