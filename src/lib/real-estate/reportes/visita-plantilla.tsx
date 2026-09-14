import type { CartaEncabezado } from '@/lib/real-estate/cartas/plantilla';
import type { FichaPalette } from '@/lib/real-estate/ficha/palettes';
import { ANCHO_UTIL, Dato, DocumentoReporte, Parrafo, Seccion } from './plantilla-comun';
import { REACCION_IMPRESA, type ReaccionVisita } from './tipos';

// Reporte de visita (punto 3). Una hoja: que se visito, cuando, quien, como
// reacciono y que sigue. La foto va solo si el visitante autorizo usarla como
// respaldo; sin esa autorizacion ni siquiera existe en la base.

export type VisitaImpresa = {
  inmueble: { titulo: string; tipo: string; operacion: string; sector: string; referencia: string };
  fecha: string;
  hora: string;
  duracion: string | null;
  visitante: string;
  cedulaEnmascarada: string | null;
  acompanantes: string | null;
  reaccion: ReaccionVisita;
  observaciones: string | null;
  objeciones: string | null;
  proximoPaso: string | null;
  fotoDataUri: string | null;
  generadoEl: string;
};

function colorReaccion(reaccion: ReaccionVisita, p: FichaPalette): { fondo: string; borde: string; texto: string } {
  if (reaccion === 'MUY_INTERESADO') return { fondo: p.tealDim, borde: p.tealLine, texto: p.teal };
  if (reaccion === 'INTERESADO_CON_REPAROS') return { fondo: p.violetaDim, borde: p.violetaLine, texto: p.violeta };
  return { fondo: p.surface2, borde: p.lineStrong, texto: p.text2 };
}

export function reporteVisitaPagina({
  encabezado,
  visita,
  palette,
  width,
  height,
}: {
  encabezado: CartaEncabezado;
  visita: VisitaImpresa;
  palette: FichaPalette;
  width: number;
  height: number;
}) {
  const color = colorReaccion(visita.reaccion, palette);
  const conFoto = Boolean(visita.fotoDataUri);
  const anchoFoto = 250;
  const anchoTexto = conFoto ? ANCHO_UTIL - anchoFoto - 24 : ANCHO_UTIL;
  const columnas = visita.duracion ? 3 : 2;
  const anchoDato = Math.floor((ANCHO_UTIL - 16 * (columnas - 1)) / columnas);

  return (
    <DocumentoReporte
      encabezado={encabezado}
      palette={palette}
      etiqueta="REPORTE DE VISITA"
      titulo={visita.inmueble.titulo}
      subtitulo={`${visita.inmueble.tipo} en ${visita.inmueble.operacion.toLowerCase()} · ${visita.inmueble.sector} · Ref. ${visita.inmueble.referencia}`}
      fecha={`Emitido el ${visita.generadoEl}`}
      width={width}
      height={height}
    >
      {/* ---- Cuando ---- */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 16,
          padding: '12px 14px',
          borderRadius: 12,
          background: palette.surface2,
          border: `1px solid ${palette.line}`,
        }}
      >
        <Dato palette={palette} etiqueta="Fecha de la visita" valor={visita.fecha} ancho={anchoDato - 10} />
        <Dato palette={palette} etiqueta="Hora" valor={visita.hora} ancho={anchoDato - 10} />
        {visita.duracion ? <Dato palette={palette} etiqueta="Duración aproximada" valor={visita.duracion} ancho={anchoDato - 10} /> : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', gap: 24, marginTop: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: anchoTexto }}>
          {/* ---- Quien ---- */}
          <Seccion palette={palette} titulo="Visitante">
            <div style={{ display: 'flex', fontSize: 15, fontWeight: 800, color: palette.text }}>{visita.visitante}</div>
            {visita.cedulaEnmascarada ? (
              <div style={{ display: 'flex', fontSize: 11.5, color: palette.text2, marginTop: 2 }}>C.I. {visita.cedulaEnmascarada}</div>
            ) : null}
            {visita.acompanantes ? (
              <div style={{ display: 'flex', fontSize: 11.5, color: palette.text2, marginTop: 2 }}>Acompañado por: {visita.acompanantes}</div>
            ) : null}
          </Seccion>

          {/* ---- Como reacciono ---- */}
          <Seccion palette={palette} titulo="Reacción a la visita">
            <div style={{ display: 'flex' }}>
              <div
                style={{
                  display: 'flex',
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: color.fondo,
                  border: `1px solid ${color.borde}`,
                  color: color.texto,
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {REACCION_IMPRESA[visita.reaccion]}
              </div>
            </div>
          </Seccion>

          {visita.observaciones ? (
            <Seccion palette={palette} titulo="Observaciones">
              <Parrafo palette={palette}>{visita.observaciones}</Parrafo>
            </Seccion>
          ) : null}

          {visita.objeciones ? (
            <Seccion palette={palette} titulo="Objeciones o comentarios del visitante">
              <Parrafo palette={palette}>{visita.objeciones}</Parrafo>
            </Seccion>
          ) : null}

          {visita.proximoPaso ? (
            <Seccion palette={palette} titulo="Próximo paso acordado">
              <div
                style={{
                  display: 'flex',
                  padding: '10px 12px',
                  borderRadius: 10,
                  borderLeft: `3px solid ${palette.teal}`,
                  background: palette.tealDim,
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  color: palette.text,
                }}
              >
                {visita.proximoPaso}
              </div>
            </Seccion>
          ) : null}
        </div>

        {conFoto ? (
          <div style={{ display: 'flex', flexDirection: 'column', width: anchoFoto, marginTop: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={visita.fotoDataUri as string}
              alt=""
              width={anchoFoto}
              height={Math.round(anchoFoto * 1.25)}
              style={{ width: anchoFoto, height: Math.round(anchoFoto * 1.25), borderRadius: 12, objectFit: 'cover' }}
            />
            <div style={{ display: 'flex', fontSize: 10, lineHeight: 1.4, color: palette.text3, marginTop: 6 }}>
              Fotografía tomada en el inmueble con autorización del visitante, como respaldo de la visita.
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexGrow: 1 }} />

      {/* ---- Constancia ---- */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16, paddingTop: 12, borderTop: `1px dashed ${palette.lineStrong}` }}>
        <div style={{ display: 'flex', fontSize: 11.5, lineHeight: 1.5, color: palette.text2 }}>
          {`Visita realizada con el acompañamiento de ${encabezado.nombre}, agente a cargo de la gestión de este inmueble.`}
        </div>
      </div>
    </DocumentoReporte>
  );
}
