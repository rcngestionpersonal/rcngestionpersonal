import type { CartaEncabezado } from '@/lib/real-estate/cartas/plantilla';
import type { FichaPalette } from '@/lib/real-estate/ficha/palettes';
import { ANCHO_UTIL, Cifra, DocumentoReporte, Parrafo, Seccion } from './plantilla-comun';
import type { DatosTasacion } from './tasacion-datos';
import { ADVERTENCIA_TASACION } from './tipos';

// Reporte de tasacion (punto 1.3). La advertencia del punto 1.4 se imprime
// desde la constante ADVERTENCIA_TASACION: no pasa por ningun dato del
// reporte, asi que no hay forma de que el agente la edite o la quite.

function dinero(v: number): string {
  return `$${Math.round(v).toLocaleString('es-EC')}`;
}

// Grafico de dispersion hecho con cajas absolutas: satori no dibuja SVG
// arbitrario de forma confiable, pero posiciona divs al pixel.
function Dispersion({ datos, palette, ancho, alto }: { datos: DatosTasacion; palette: FichaPalette; ancho: number; alto: number }) {
  const margenIzq = 58;
  const margenAbajo = 22;
  const areaAncho = ancho - margenIzq - 8;
  const areaAlto = alto - margenAbajo - 8;

  const xs = [...datos.puntos.map((p) => p.metraje), datos.inmueble.metraje];
  const ys = [...datos.puntos.map((p) => p.precio), datos.rango.minimo, datos.rango.maximo];
  const xMin = Math.min(...xs) * 0.9;
  const xMax = Math.max(...xs) * 1.1;
  const yMin = Math.min(...ys) * 0.9;
  const yMax = Math.max(...ys) * 1.1;
  const x = (v: number) => margenIzq + ((v - xMin) / (xMax - xMin || 1)) * areaAncho;
  const y = (v: number) => 8 + areaAlto - ((v - yMin) / (yMax - yMin || 1)) * areaAlto;

  const xInmueble = x(datos.inmueble.metraje);
  const yTope = y(datos.rango.maximo);
  const yBase = y(datos.rango.minimo);

  return (
    <div style={{ display: 'flex', position: 'relative', width: ancho, height: alto }}>
      {/* Ejes */}
      <div style={{ display: 'flex', position: 'absolute', left: margenIzq, top: 8, width: 1, height: areaAlto, background: palette.lineStrong }} />
      <div style={{ display: 'flex', position: 'absolute', left: margenIzq, top: 8 + areaAlto, width: areaAncho, height: 1, background: palette.lineStrong }} />
      <div style={{ display: 'flex', position: 'absolute', left: 0, top: 2, width: margenIzq - 6, justifyContent: 'flex-end', fontSize: 10, color: palette.text3 }}>
        {dinero(yMax)}
      </div>
      <div style={{ display: 'flex', position: 'absolute', left: 0, top: areaAlto - 4, width: margenIzq - 6, justifyContent: 'flex-end', fontSize: 10, color: palette.text3 }}>
        {dinero(yMin)}
      </div>
      <div style={{ display: 'flex', position: 'absolute', left: margenIzq, top: alto - 14, fontSize: 10, color: palette.text3 }}>{`${Math.round(xMin)} m²`}</div>
      <div style={{ display: 'flex', position: 'absolute', left: margenIzq + areaAncho - 50, top: alto - 14, width: 50, justifyContent: 'flex-end', fontSize: 10, color: palette.text3 }}>
        {`${Math.round(xMax)} m²`}
      </div>

      {/* Rango sugerido a la altura del metraje del inmueble */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: xInmueble - 9,
          top: yTope,
          width: 18,
          height: Math.max(4, yBase - yTope),
          borderRadius: 9,
          background: palette.tealDim,
          border: `2px solid ${palette.teal}`,
        }}
      />

      {/* Cierres del sector */}
      {datos.puntos.map((p, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            position: 'absolute',
            left: x(p.metraje) - 4,
            top: y(p.precio) - 4,
            width: 8,
            height: 8,
            borderRadius: 4,
            background: palette.violeta,
          }}
        />
      ))}
    </div>
  );
}

export function reporteTasacionPagina({
  encabezado,
  datos,
  emitidoEl,
  palette,
  width,
  height,
}: {
  encabezado: CartaEncabezado;
  datos: DatosTasacion;
  emitidoEl: string;
  palette: FichaPalette;
  width: number;
  height: number;
}) {
  const anchoCifra = Math.floor((ANCHO_UTIL - 20) / 3);
  const sufijo = datos.esArriendo ? ' /mes' : '';
  const col = { tipo: 130, metraje: 90, antiguedad: 150, precio: 150, m2: ANCHO_UTIL - 130 - 90 - 150 - 150 - 24 };

  return (
    <DocumentoReporte
      encabezado={encabezado}
      palette={palette}
      etiqueta="REPORTE DE TASACIÓN · REFERENCIA DE MERCADO"
      titulo={datos.inmueble.titulo}
      subtitulo={`${datos.inmueble.tipo} en ${datos.inmueble.operacion.toLowerCase()} · ${datos.inmueble.sector} · ${datos.inmueble.metraje} m²${datos.inmueble.caracteristicas.length ? ` · ${datos.inmueble.caracteristicas.join(' · ')}` : ''}`}
      fecha={`Emitido el ${emitidoEl}`}
      width={width}
      height={height}
    >
      {/* ---- Advertencia obligatoria (punto 1.4), siempre visible ---- */}
      <div
        style={{
          display: 'flex',
          padding: '9px 12px',
          borderRadius: 10,
          border: `1px solid ${palette.lineStrong}`,
          background: palette.surface2,
          fontSize: 10.5,
          lineHeight: 1.45,
          color: palette.text2,
        }}
      >
        {ADVERTENCIA_TASACION}
      </div>

      {/* ---- Rango sugerido ---- */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Cifra palette={palette} valor={`${dinero(datos.rango.minimo)}${sufijo}`} etiqueta="Rango sugerido: mínimo" ancho={anchoCifra} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: anchoCifra,
            padding: '10px 12px',
            borderRadius: 10,
            background: palette.tealDim,
            border: `1px solid ${palette.tealLine}`,
          }}
        >
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, color: palette.text }}>{`${dinero(datos.rango.central)}${sufijo}`}</div>
          <div style={{ display: 'flex', fontSize: 10.5, color: palette.text2, marginTop: 2 }}>Valor central del sector</div>
        </div>
        <Cifra palette={palette} valor={`${dinero(datos.rango.maximo)}${sufijo}`} etiqueta="Rango sugerido: máximo" ancho={anchoCifra} />
      </div>

      <Seccion palette={palette} titulo="Cómo se calcula">
        <Parrafo palette={palette}>
          {`Precio por m² del sector: ${dinero(datos.precioM2.mediana)} (valor central), según ${datos.cierres} cierres registrados. El rango toma la mitad central de esos cierres, de ${dinero(datos.precioM2.p25)} a ${dinero(datos.precioM2.p75)} por m², multiplicada por el metraje del inmueble.`}
        </Parrafo>
      </Seccion>

      <div style={{ display: 'flex', flexDirection: 'row', gap: 20 }}>
        <Seccion palette={palette} titulo="Cierres del sector por metraje y precio">
          <Dispersion datos={datos} palette={palette} ancho={Math.floor(ANCHO_UTIL * 0.55)} alto={190} />
          <div style={{ display: 'flex', flexDirection: 'row', gap: 14, marginTop: 4, fontSize: 10, color: palette.text3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ display: 'flex', width: 8, height: 8, borderRadius: 4, background: palette.violeta }} />
              Cierre registrado
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ display: 'flex', width: 8, height: 12, borderRadius: 4, border: `2px solid ${palette.teal}` }} />
              Rango para este inmueble
            </div>
          </div>
        </Seccion>
        <div style={{ display: 'flex', flexDirection: 'column', width: ANCHO_UTIL - Math.floor(ANCHO_UTIL * 0.55) - 20 }}>
          {datos.tiempoMercado ? (
            <Seccion palette={palette} titulo="Tiempo en mercado del sector">
              <div style={{ display: 'flex', fontSize: 18, fontWeight: 800, color: palette.text }}>{datos.tiempoMercado}</div>
              <div style={{ display: 'flex', fontSize: 10.5, color: palette.text2, marginTop: 2 }}>Franja más frecuente entre los cierres del sector</div>
            </Seccion>
          ) : null}
          <Seccion palette={palette} titulo="Conclusión">
            <Parrafo palette={palette} angosto>
              {datos.conclusion}
            </Parrafo>
          </Seccion>
        </div>
      </div>

      {/* ---- Comparables anonimos (punto 1.3 y 1.5) ---- */}
      <Seccion palette={palette} titulo="Cierres comparables del sector">
        <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 10, border: `1px solid ${palette.line}` }}>
          <div style={{ display: 'flex', flexDirection: 'row', padding: '7px 12px', background: palette.surface2, fontSize: 10, fontWeight: 800, color: palette.text3 }}>
            <div style={{ display: 'flex', width: col.tipo }}>TIPO</div>
            <div style={{ display: 'flex', width: col.metraje }}>METRAJE</div>
            <div style={{ display: 'flex', width: col.antiguedad }}>ANTIGÜEDAD</div>
            <div style={{ display: 'flex', width: col.precio }}>{datos.esArriendo ? 'CANON MENSUAL' : 'PRECIO'}</div>
            <div style={{ display: 'flex', width: col.m2, justifyContent: 'flex-end' }}>$/M²</div>
          </div>
          {datos.comparables.map((c, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'row', padding: '7px 12px', borderTop: `1px solid ${palette.line}`, fontSize: 12, color: palette.text }}>
              <div style={{ display: 'flex', width: col.tipo }}>{c.tipo}</div>
              <div style={{ display: 'flex', width: col.metraje }}>{`${c.metraje} m²`}</div>
              <div style={{ display: 'flex', width: col.antiguedad }}>{c.antiguedad}</div>
              <div style={{ display: 'flex', width: col.precio, fontWeight: 700 }}>{dinero(c.precio)}</div>
              <div style={{ display: 'flex', width: col.m2, justifyContent: 'flex-end' }}>{dinero(c.precioM2)}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', fontSize: 10, color: palette.text3, marginTop: 5 }}>
          Operaciones anónimas: sin dirección, fecha ni agente. Precios y metrajes redondeados.
        </div>
      </Seccion>

      <div style={{ display: 'flex', flexGrow: 1 }} />
    </DocumentoReporte>
  );
}
