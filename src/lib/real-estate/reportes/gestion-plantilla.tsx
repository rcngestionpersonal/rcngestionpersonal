import type { CartaEncabezado } from '@/lib/real-estate/cartas/plantilla';
import type { FichaPalette } from '@/lib/real-estate/ficha/palettes';
import { ANCHO_UTIL, Cifra, DocumentoReporte, Parrafo, Seccion } from './plantilla-comun';
import { CANAL_IMPRESO, type DatosGestion, type EntradaDifusion } from './tipos';

// Reporte de gestion (punto 2): convierte el trabajo invisible del agente en
// algo que el propietario ve. Una hoja, en el orden en que un propietario lee:
// cuanto movimiento hubo, donde esta publicado, quien vino, que opina el agente.

export type GestionImpresa = {
  datos: DatosGestion;
  difusion: EntradaDifusion[];
  observaciones: string | null;
  periodoTexto: string;
  fechasVisita: string[];
  emitidoEl: string;
  diasPublicado: number;
};

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

function dominio(enlace: string): string {
  try {
    return new URL(enlace).hostname.replace(/^www\./, '');
  } catch {
    return enlace;
  }
}

function formatoDinero(valor: number, moneda: string): string {
  const cifra = Math.round(valor).toLocaleString('es-EC');
  return moneda === 'USD' ? `$${cifra}` : `${cifra} ${moneda}`;
}

const MAX_FECHAS = 14;

export function reporteGestionPagina({
  encabezado,
  gestion,
  palette,
  width,
  height,
}: {
  encabezado: CartaEncabezado;
  gestion: GestionImpresa;
  palette: FichaPalette;
  width: number;
  height: number;
}) {
  const d = gestion.datos;
  const anchoCifra = Math.floor((ANCHO_UTIL - 10 * 3) / 4);
  // Anchos explicitos: en satori una columna sin ancho no envuelve el texto y
  // se sale de la hoja.
  const anchoIzquierda = Math.floor(ANCHO_UTIL * 0.52);
  const anchoDerecha = ANCHO_UTIL - anchoIzquierda - 24;
  const fechas = gestion.fechasVisita.slice(0, MAX_FECHAS);
  const fechasExtra = gestion.fechasVisita.length - fechas.length;
  const partesInteresados = [
    plural(d.interesados.consultas, 'consulta', 'consultas'),
    plural(d.interesados.visitasAgendadas, 'visita agendada', 'visitas agendadas'),
    `${d.interesados.enNegociacion} en negociación`,
  ];

  return (
    <DocumentoReporte
      encabezado={encabezado}
      palette={palette}
      etiqueta={`REPORTE DE GESTIÓN ${d.periodo.periodicidad === 'SEMANAL' ? 'SEMANAL' : 'MENSUAL'}`}
      titulo={d.inmueble.titulo}
      subtitulo={`${d.inmueble.tipo} en ${d.inmueble.operacion.toLowerCase()} · ${d.inmueble.sector} · ${formatoDinero(d.inmueble.precio, d.inmueble.moneda)}`}
      fecha={gestion.periodoTexto}
      width={width}
      height={height}
    >
      {/* ---- Actividad del periodo ---- */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: 10 }}>
        <Cifra palette={palette} valor={String(d.visitas.cantidad)} etiqueta="Visitas realizadas" ancho={anchoCifra} />
        <Cifra palette={palette} valor={String(d.interesados.consultas)} etiqueta="Consultas recibidas" ancho={anchoCifra} />
        <Cifra palette={palette} valor={String(d.actividad.visualizaciones)} etiqueta="Vistas de la ficha en línea" ancho={anchoCifra} />
        <Cifra palette={palette} valor={String(d.actividad.matches)} etiqueta="Compradores compatibles" ancho={anchoCifra} />
      </div>
      <div style={{ display: 'flex', fontSize: 10.5, color: palette.text3, marginTop: 6 }}>
        {`Actividad en la red Redinmo: ${plural(d.actividad.matches, 'pedido compatible detectado', 'pedidos compatibles detectados')} y ${plural(d.actividad.colegasInteresados, 'agente', 'agentes')} con clientes que consultaron por el inmueble.`}
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', gap: 24 }}>
        {/* ---- Columna izquierda ---- */}
        <div style={{ display: 'flex', flexDirection: 'column', width: anchoIzquierda }}>
          <Seccion palette={palette} titulo="Dónde está publicado">
            {gestion.difusion.length === 0 ? (
              <Parrafo palette={palette}>Sin canales registrados en este período.</Parrafo>
            ) : (
              gestion.difusion.map((e, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    borderBottom: i === gestion.difusion.length - 1 ? 'none' : `1px solid ${palette.line}`,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', fontSize: 12.5, fontWeight: 700, color: palette.text }}>{e.nombre}</div>
                    {e.nombre.trim().toLowerCase() !== CANAL_IMPRESO[e.canal].toLowerCase() ? (
                      <div style={{ display: 'flex', fontSize: 10, color: palette.text3 }}>{CANAL_IMPRESO[e.canal]}</div>
                    ) : null}
                  </div>
                  {e.enlace ? <div style={{ display: 'flex', fontSize: 10.5, color: palette.violeta }}>{dominio(e.enlace)}</div> : null}
                </div>
              ))
            )}
          </Seccion>

          <Seccion palette={palette} titulo="Interesados y acercamientos">
            <Parrafo palette={palette}>{partesInteresados.join(' · ')}</Parrafo>
          </Seccion>
        </div>

        {/* ---- Columna derecha ---- */}
        <div style={{ display: 'flex', flexDirection: 'column', width: anchoDerecha }}>
          <Seccion palette={palette} titulo="Visitas del período">
            {fechas.length === 0 ? (
              <Parrafo palette={palette}>Sin visitas en este período.</Parrafo>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: anchoDerecha }}>
                {fechas.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      padding: '4px 9px',
                      borderRadius: 999,
                      background: palette.tealDim,
                      border: `1px solid ${palette.tealLine}`,
                      fontSize: 11,
                      fontWeight: 700,
                      color: palette.teal,
                    }}
                  >
                    {f}
                  </div>
                ))}
                {fechasExtra > 0 ? <div style={{ display: 'flex', fontSize: 11, color: palette.text3, padding: '4px 2px' }}>{`y ${fechasExtra} más`}</div> : null}
              </div>
            )}
          </Seccion>

          {d.comparativo ? (
            <Seccion palette={palette} titulo="Comparativo de mercado">
              {d.comparativo.diasPromedioPublicados !== null ? (
                <Parrafo palette={palette}>
                  {`Los ${d.comparativo.similares} inmuebles similares publicados en el sector llevan en promedio ${plural(d.comparativo.diasPromedioPublicados, 'día', 'días')} en el mercado. Este lleva ${plural(gestion.diasPublicado, 'día', 'días')}.`}
                </Parrafo>
              ) : null}
              {d.comparativo.precioM2Referencia !== null ? (
                <div style={{ display: 'flex', fontSize: 12.5, lineHeight: 1.55, color: palette.text, marginTop: 4 }}>
                  {`Precio de referencia del sector: $${d.comparativo.precioM2Referencia.toLocaleString('es-EC')}/m², según ${d.comparativo.cierresReferencia} cierres registrados.`}
                </div>
              ) : null}
            </Seccion>
          ) : null}
        </div>
      </div>

      {gestion.observaciones ? (
        <Seccion palette={palette} titulo="Análisis y recomendación del agente">
          <div
            style={{
              display: 'flex',
              padding: '10px 12px',
              borderRadius: 10,
              borderLeft: `3px solid ${palette.violeta}`,
              background: palette.surface2,
              fontSize: 12.5,
              lineHeight: 1.55,
              color: palette.text,
            }}
          >
            {gestion.observaciones}
          </div>
        </Seccion>
      ) : null}

      <div style={{ display: 'flex', flexGrow: 1 }} />

      {/* ---- Acumulado ---- */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          marginTop: 14,
          padding: '12px 14px',
          borderRadius: 12,
          background: palette.violetaDim,
          border: `1px solid ${palette.violetaLine}`,
        }}
      >
        <div style={{ display: 'flex', fontSize: 10.5, fontWeight: 800, letterSpacing: 1.1, color: palette.violeta }}>RESUMEN ACUMULADO</div>
        <div style={{ display: 'flex', fontSize: 14, fontWeight: 700, color: palette.text, marginTop: 3 }}>
          {`Van ${plural(d.acumulado.semanas, 'semana', 'semanas')} de gestión, ${plural(d.acumulado.visitas, 'visita total', 'visitas totales')} y ${plural(d.acumulado.consultas, 'consulta', 'consultas')}.`}
        </div>
      </div>
      <div style={{ display: 'flex', fontSize: 10, color: palette.text3, marginTop: 6 }}>{`Emitido el ${gestion.emitidoEl}. Cifras tomadas del sistema al emitir el reporte.`}</div>
    </DocumentoReporte>
  );
}
