import React from 'react';
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { FICHA_FONT_BASE64 } from '@/lib/real-estate/ficha/fonts-data';
import type { BloqueFinal, LineaFirma } from './clausulas';
import { AVISO_FIRMA_ELECTRONICA, AVISO_REDINMO_NO_ES_PARTE_LEGADO } from './legado-firma';
import { AVISO_APROBACION, AVISO_REDINMO_NO_ES_PARTE, NOTA_ANEXO_SEPARABLE } from './tipos';

// PDF del contrato: A4 sobrio y formal, con TEXTO VECTORIAL. Es el lugar común
// de todos los tipos de contrato: encabezado, márgenes, pie y paginación viven
// aquí y en ningún otro lado.
//
// Por qué así: hasta la versión anterior cada página era una imagen JPEG de
// 1588 px de ancho (≈192 ppp, calidad 78) dibujada con satori y resvg. En el
// celular la página se ve reducida y no se nota; en un monitor de escritorio se
// amplía y aparecen el desenfoque y los artefactos del JPEG. Aquí el texto es
// texto: nítido a cualquier zoom, seleccionable y mucho más liviano.
//
// Y la paginación la hace el motor de maquetación, no una estimación de alto
// por caracteres: una cláusula larga se parte entre páginas, el título de una
// cláusula nunca queda solo al pie (va en el mismo bloque que sus primeras
// líneas) y se evitan líneas huérfanas y viudas.
//
// EL CUERPO NO LLEVA MARCA DE LA PLATAFORMA. Ni logotipo, ni nombre, ni código.
// Los avisos para quien revisa (plantilla en revisión, advertencias) se
// muestran en la pantalla de aprobación, no en el documento. Un borrador lleva
// solo la palabra BORRADOR, pequeña y en gris; una versión aprobada, nada.
//
// La constancia va aparte, como ANEXO con su propia numeración: identifica el
// sistema que registró las aprobaciones y se puede quitar al imprimir para la
// notaría sin dejar huecos en la numeración del contrato.

const FUENTE = 'Plus Jakarta Sans';
let fuentesRegistradas = false;

function registrarFuentes() {
  if (fuentesRegistradas) return;
  Font.register({
    family: FUENTE,
    fonts: ([400, 600, 700, 800] as const).map((peso) => ({
      src: `data:font/woff;base64,${FICHA_FONT_BASE64[peso]}`,
      fontWeight: peso,
    })),
  });
  // Sin guiones de corte: el motor usa patrones del inglés y en un contrato en
  // español partiría palabras donde no corresponde.
  Font.registerHyphenationCallback((palabra) => [palabra]);
  fuentesRegistradas = true;
}

// Márgenes A4 estándar: 22,6 mm arriba, 25,4 mm abajo (con el pie dentro del
// margen) y 21,9 mm a los lados.
const MARGEN = { arriba: 64, abajo: 72, lados: 62 };
const CUERPO = 10.5;

const TINTA = '#14121f';
const GRIS = '#5c5676';
const GRIS_CLARO = '#8a8599';
const LINEA = '#d6d3df';

const s = StyleSheet.create({
  pagina: {
    fontFamily: FUENTE,
    fontSize: CUERPO,
    color: TINTA,
    paddingTop: MARGEN.arriba,
    paddingBottom: MARGEN.abajo,
    paddingHorizontal: MARGEN.lados,
    backgroundColor: '#ffffff',
  },
  marca: {
    position: 'absolute',
    top: 30,
    right: MARGEN.lados,
    fontSize: 7.5,
    color: '#a8a4b3',
  },
  titulo: { fontSize: 14, fontWeight: 800, textAlign: 'center', lineHeight: 1.3 },
  fecha: { fontSize: 9.5, color: GRIS, textAlign: 'center', marginTop: 5, marginBottom: 18 },
  // Alineado a la izquierda y no justificado: el motor, para justificar, separa
  // también las letras cuando no le alcanza con los espacios, y esas líneas se
  // ven estiradas.
  cuerpo: { fontSize: CUERPO, lineHeight: 1.5, textAlign: 'left' },
  subtitulo: { fontWeight: 800, letterSpacing: 0.4 },
  encabezado: { fontWeight: 700 },
  pie: {
    position: 'absolute',
    bottom: 30,
    left: MARGEN.lados,
    right: MARGEN.lados,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 0.6,
    borderTopColor: LINEA,
    paddingTop: 6,
  },
  pieTexto: { fontSize: 7.5, color: GRIS_CLARO, lineHeight: 1.35, maxWidth: 360 },
  pieNumero: { fontSize: 7.5, color: GRIS_CLARO },
  ficha: { borderWidth: 0.8, borderColor: LINEA, borderRadius: 4, marginBottom: 14 },
  fichaTitulo: {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 0.4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: '#faf9fc',
    borderBottomWidth: 0.6,
    borderBottomColor: LINEA,
  },
  fichaFila: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 9 },
  fichaEtiqueta: { width: 150, fontSize: 9.5, fontWeight: 700, color: GRIS, paddingRight: 8 },
  fichaValor: { flex: 1, fontSize: 9.5, lineHeight: 1.4 },
  leyenda: { fontSize: 9.5, color: GRIS, marginBottom: 10 },
  firmaFila: { flexDirection: 'row', justifyContent: 'space-between' },
  firma: { width: '47%', marginBottom: 18 },
  firmaEspacio: { height: 46, borderBottomWidth: 0.8, borderBottomColor: TINTA, marginBottom: 5 },
  firmaNombre: { fontSize: 10, fontWeight: 700 },
  firmaDato: { fontSize: 9, color: '#3d3854', lineHeight: 1.4 },
  firmaCalidad: { fontSize: 9, fontWeight: 700, letterSpacing: 0.4, marginTop: 2 },
  // Anexo
  anexoRotulo: { fontSize: 8, fontWeight: 800, color: GRIS_CLARO },
  anexoTitulo: { fontSize: 14, fontWeight: 800, marginTop: 2 },
  anexoSubtitulo: { fontSize: 9, color: GRIS, marginTop: 2 },
  anexoCabecera: { borderBottomWidth: 0.8, borderBottomColor: LINEA, paddingBottom: 8, marginBottom: 10 },
  nota: { fontSize: 8.5, color: GRIS, lineHeight: 1.4, marginBottom: 8 },
  aviso: {
    borderWidth: 0.8,
    borderColor: '#b45309',
    backgroundColor: '#fffbeb',
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
    fontSize: 9.5,
    lineHeight: 1.45,
    color: '#7c3f06',
  },
  fila: { flexDirection: 'row', marginBottom: 1.5 },
  filaEtiqueta: { width: 130, fontSize: 8, color: GRIS_CLARO },
  filaValor: { flex: 1, fontSize: 8.5, lineHeight: 1.35 },
  etapaTitulo: { fontSize: 9.5, fontWeight: 800, marginTop: 6, marginBottom: 5 },
  tarjeta: { borderWidth: 0.8, borderColor: LINEA, borderRadius: 4, padding: 8, marginBottom: 7 },
  tarjetaCabecera: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  tarjetaNombre: { fontSize: 9.5, fontWeight: 700, flex: 1, paddingRight: 8 },
  decision: { fontSize: 8.5, fontWeight: 700 },
});

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

export type ParteConstancia = {
  rol: string;
  nombre: string;
  // Compañía por la que aprueba, si es su representante.
  enNombreDe: string | null;
  cedula: string;
  correo: string;
  etapa: 'PRINCIPAL' | 'CONTRAPARTE';
  enviadoAt: string | null;
  abiertoAt: string | null;
  decision: 'APROBO' | 'NO_APROBO' | 'PENDIENTE' | 'SIN_DECISION';
  decisionAt: string | null;
  motivo: string | null;
  ip: string | null;
  navegador: string | null;
  leyoCompleto: boolean;
  // Aprobación conservada de otra versión con las mismas condiciones.
  enVersion: number | null;
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
  // "Secuencial: primero Vendedor, después Comprador", o la advertencia del
  // envío simultáneo.
  envio: string;
  etapas: Array<{ titulo: string; nota: string | null; partes: ParteConstancia[] }>;
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
  // Todo lo que no es una versión aprobada por todas las partes.
  borrador: boolean;
  // "Versión 2 — aprobada por ... el ...", "Borrador · versión 3, en revisión"...
  pie: string | null;
  anexo: AnexoAprobacion | AnexoFirmaLegado | null;
};

// ---------------------------------------------------------------------------
// Cuerpo
// ---------------------------------------------------------------------------

function parrafos(texto: string): string[] {
  const lista = texto
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return lista.length > 0 ? lista : [''];
}

// Un subtítulo suelto ("CLÁUSULAS") no puede quedar al pie de una página: viaja
// como primera línea del bloque que lo sigue. Va en el mismo texto y sin un
// renglón de separación en letra menor: el motor mide mal ese renglón y corta
// la página antes de tiempo (probado: dejaba 148 pt en blanco).
function Clausula({ bloque, subtitulo }: { bloque: Extract<BloqueFinal, { tipo: 'clausula' }>; subtitulo: string | null }) {
  const [primero, ...resto] = parrafos(bloque.texto);
  return (
    // Sin márgenes en la vista que agrupa la cláusula: con ellos el motor calcula
    // mal el corte y pasa la cláusula entera a la hoja siguiente (probado: 182 pt
    // en blanco). El espacio entre cláusulas va en el propio texto.
    <View>
      {/* Título + primeras líneas en un mismo bloque de texto, con al menos
          tres líneas juntas: el título nunca queda solo al final de la hoja. */}
      <Text orphans={3} widows={2} style={[s.cuerpo, { marginTop: subtitulo ? 14 : 9 }]}>
        {subtitulo ? <Text style={s.subtitulo}>{subtitulo}</Text> : null}
        {subtitulo ? '\n' : null}
        <Text style={s.encabezado}>{bloque.encabezado}</Text>
        {'\n'}
        {primero}
      </Text>
      {resto.map((p, i) => (
        <Text key={i} orphans={2} widows={2} style={[s.cuerpo, { marginTop: 4 }]}>
          {p}
        </Text>
      ))}
    </View>
  );
}

function Parrafo({ texto, subtitulo }: { texto: string; subtitulo: string | null }) {
  return (
    <Text orphans={subtitulo ? 3 : 2} widows={2} style={[s.cuerpo, { marginBottom: 8, marginTop: subtitulo ? 6 : 0 }]}>
      {subtitulo ? <Text style={s.subtitulo}>{subtitulo}</Text> : null}
      {subtitulo ? '\n' : null}
      {texto}
    </Text>
  );
}

function Ficha({ bloque, subtitulo }: { bloque: Extract<BloqueFinal, { tipo: 'ficha' }>; subtitulo: string | null }) {
  const [primera, ...resto] = bloque.filas;
  const fila = (f: { etiqueta: string; valor: string }, ultima: boolean) => (
    <View style={[s.fichaFila, ultima ? {} : { borderBottomWidth: 0.5, borderBottomColor: '#ece9f2' }]}>
      <Text style={s.fichaEtiqueta}>{f.etiqueta}</Text>
      <Text style={s.fichaValor}>{f.valor}</Text>
    </View>
  );
  return (
    <View style={{ marginBottom: 4 }}>
      {/* El título de la ficha viaja con su primera fila. */}
      <View wrap={false}>
        {subtitulo ? <Text style={[s.subtitulo, { marginBottom: 6 }]}>{subtitulo}</Text> : null}
        <View style={[s.ficha, { marginBottom: 0, borderBottomWidth: resto.length > 0 ? 0 : 0.8, borderBottomLeftRadius: resto.length > 0 ? 0 : 4, borderBottomRightRadius: resto.length > 0 ? 0 : 4 }]}>
          <Text style={s.fichaTitulo}>{bloque.titulo}</Text>
          {primera ? fila(primera, resto.length === 0) : null}
        </View>
      </View>
      {resto.length > 0 ? (
        <View style={[s.ficha, { borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
          {resto.map((f, i) => (
            <View key={f.etiqueta} wrap={false}>
              {fila(f, i === resto.length - 1)}
            </View>
          ))}
        </View>
      ) : (
        <View style={{ height: 14 }} />
      )}
    </View>
  );
}

function Firma({ parte }: { parte: LineaFirma }) {
  return (
    <View style={s.firma}>
      {/* Espacio para la firma manuscrita. */}
      <View style={s.firmaEspacio} />
      {parte.enRepresentacionDe ? (
        <>
          <Text style={s.firmaNombre}>{parte.enRepresentacionDe.razonSocial}</Text>
          <Text style={s.firmaDato}>RUC {parte.enRepresentacionDe.ruc}</Text>
          <Text style={[s.firmaDato, { marginTop: 1 }]}>p. {parte.nombre}</Text>
          <Text style={s.firmaDato}>
            {parte.tipoDocumento} {parte.documento} · Representante legal
          </Text>
        </>
      ) : (
        <>
          <Text style={s.firmaNombre}>{parte.nombre}</Text>
          <Text style={s.firmaDato}>
            {parte.tipoDocumento} {parte.documento}
          </Text>
        </>
      )}
      <Text style={s.firmaCalidad}>{parte.calidad}</Text>
    </View>
  );
}

// Una cláusula corta antes de las firmas viaja con ellas: una hoja que solo
// tiene firmas, sin texto del contrato, no debería existir.
const MAX_CARS_CIERRE_CON_FIRMAS = 700;

function Firmas({
  bloque,
  subtitulo,
  cierre,
}: {
  bloque: Extract<BloqueFinal, { tipo: 'firmas' }>;
  subtitulo: string | null;
  cierre: Extract<BloqueFinal, { tipo: 'clausula' }> | null;
}) {
  const pares: LineaFirma[][] = [];
  for (let i = 0; i < bloque.partes.length; i += 2) pares.push(bloque.partes.slice(i, i + 2));
  return (
    <View>
      {pares.map((par, i) => (
        // Cada par de firmas va entero en una página; la leyenda, con el primero.
        <View key={i} wrap={false} style={i === 0 ? { marginTop: cierre ? 9 : 18 } : undefined}>
          {i === 0 && cierre ? (
            <View style={{ marginBottom: 18 }}>
              <Text style={s.cuerpo}>
                <Text style={s.encabezado}>{cierre.encabezado}</Text>
                {'\n'}
                {cierre.texto}
              </Text>
            </View>
          ) : null}
          {i === 0 && subtitulo ? <Text style={[s.subtitulo, { marginBottom: 6 }]}>{subtitulo}</Text> : null}
          {i === 0 && bloque.leyenda ? <Text style={s.leyenda}>{bloque.leyenda}</Text> : null}
          <View style={s.firmaFila}>
            {par.map((p, j) => (
              <Firma key={`${p.calidad}-${j}`} parte={p} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function Cuerpo({ datos }: { datos: DatosPdfContrato }) {
  const salida: React.ReactNode[] = [];
  let subtitulo: string | null = null;
  // Cláusula de cierre que se dibuja junto con las firmas.
  let cierre: Extract<BloqueFinal, { tipo: 'clausula' }> | null = null;
  datos.bloques.forEach((b, i) => {
    switch (b.tipo) {
      case 'titulo':
        salida.push(
          <View key={i}>
            <Text style={s.titulo}>{b.texto}</Text>
            <Text style={s.fecha}>
              {datos.ciudad}, {datos.fechaLarga}
            </Text>
          </View>,
        );
        return;
      case 'subtitulo':
        if (subtitulo) salida.push(<Parrafo key={`st-${i}`} texto="" subtitulo={subtitulo} />);
        subtitulo = b.texto;
        return;
      // Los avisos son para quien revisa, no parte del contrato: se muestran en
      // la pantalla de aprobación.
      case 'aviso':
        return;
      case 'clausula': {
        const siguiente = datos.bloques[i + 1];
        if (!subtitulo && siguiente?.tipo === 'firmas' && !b.texto.includes('\n') && b.texto.length <= MAX_CARS_CIERRE_CON_FIRMAS) {
          cierre = b;
          return;
        }
        salida.push(<Clausula key={i} bloque={b} subtitulo={subtitulo} />);
        break;
      }
      case 'parrafo':
        salida.push(<Parrafo key={i} texto={b.texto} subtitulo={subtitulo} />);
        break;
      case 'ficha':
        salida.push(<Ficha key={i} bloque={b} subtitulo={subtitulo} />);
        break;
      case 'firmas':
        salida.push(<Firmas key={i} bloque={b} subtitulo={subtitulo} cierre={cierre} />);
        cierre = null;
        break;
    }
    subtitulo = null;
  });
  if (subtitulo) salida.push(<Parrafo key="st-final" texto="" subtitulo={subtitulo} />);
  return <>{salida}</>;
}

function Pie({ texto, prefijo }: { texto: string | null; prefijo: string }) {
  return (
    <View fixed style={s.pie}>
      <Text style={s.pieTexto}>{texto ?? ''}</Text>
      <Text
        style={s.pieNumero}
        // Numeración de ESTE bloque de páginas: el contrato cuenta sus páginas
        // y el anexo las suyas.
        render={({ subPageNumber, subPageTotalPages }) => `${prefijo}${subPageNumber} de ${subPageTotalPages}`}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Anexos
// ---------------------------------------------------------------------------

function Fila({ k, v, pequeno = false }: { k: string; v: string; pequeno?: boolean }) {
  return (
    <View style={s.fila}>
      <Text style={s.filaEtiqueta}>{k}</Text>
      <Text style={[s.filaValor, pequeno ? { fontSize: 7 } : {}]}>{v}</Text>
    </View>
  );
}

function CabeceraAnexo({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <View style={s.anexoCabecera}>
      <Text style={s.anexoRotulo}>ANEXO</Text>
      <Text style={s.anexoTitulo}>{titulo}</Text>
      <Text style={s.anexoSubtitulo}>{subtitulo}</Text>
    </View>
  );
}

const DECISION: Record<ParteConstancia['decision'], string> = {
  APROBO: 'Aprobó',
  NO_APROBO: 'Pidió cambios',
  PENDIENTE: 'Pendiente',
  SIN_DECISION: 'Sin decisión: se envió una versión posterior',
};

function TarjetaParte({ p }: { p: ParteConstancia }) {
  const color = p.decision === 'APROBO' ? '#0b7568' : p.decision === 'NO_APROBO' ? '#b42318' : GRIS_CLARO;
  return (
    <View wrap={false} style={s.tarjeta}>
      <View style={s.tarjetaCabecera}>
        <Text style={s.tarjetaNombre}>
          {p.nombre} — {p.rol}
          {p.enNombreDe ? ` · por ${p.enNombreDe}` : ''}
        </Text>
        <Text style={[s.decision, { color }]}>
          {DECISION[p.decision]}
          {p.enVersion ? ` la versión ${p.enVersion}` : ''}
        </Text>
      </View>
      <Fila k="Cédula" v={p.cedula} />
      {p.correo ? <Fila k="Correo" v={p.correo} /> : null}
      <Fila k="Envío del enlace" v={p.enviadoAt ?? '—'} />
      <Fila k="Primer acceso" v={p.abiertoAt ?? '—'} />
      <Fila k={p.decision === 'NO_APROBO' ? 'Pedido de cambios' : 'Aprobación registrada'} v={p.decisionAt ?? '—'} />
      {p.motivo ? <Fila k="Lo que pidió" v={p.motivo} /> : null}
      <Fila k="Dirección IP" v={p.ip ?? '—'} />
      <Fila k="Navegador y dispositivo" v={p.navegador ?? '—'} />
      <Fila k="Leyó hasta el final" v={p.decisionAt ? (p.leyoCompleto ? 'Sí' : 'No') : '—'} />
    </View>
  );
}

function PaginaAnexoAprobacion({ a }: { a: AnexoAprobacion }) {
  return (
    <Page size="A4" style={s.pagina}>
      <CabeceraAnexo titulo="Constancia de aprobación de borrador" subtitulo={`Registro generado por Redinmo.io · ${a.nombreDocumento}`} />
      <Text style={s.nota}>{NOTA_ANEXO_SEPARABLE}</Text>
      <Text style={[s.aviso, { fontWeight: 600 }]}>{AVISO_APROBACION}</Text>
      <View style={{ marginBottom: 8 }}>
        <Fila k="Identificador" v={a.codigo} />
        <Fila k="Versión" v={`${a.numero} · ${a.estadoVersion}`} />
        <Fila k="Enviada" v={`${a.enviadaAt} por ${a.enviadaPor}`} />
        <Fila k="Orden de revisión" v={a.envio} />
        <Fila k="Huella del texto (SHA-256)" v={a.huella} pequeno />
        <Fila k="Verificación" v={a.urlVerificacion} />
      </View>
      <Text style={s.nota}>La huella identifica el texto exacto de esta versión: un texto con una sola letra distinta tiene otra huella.</Text>
      {a.etapas.map((etapa, i) => (
        <View key={i}>
          <Text style={s.etapaTitulo} minPresenceAhead={80}>
            {etapa.titulo}
          </Text>
          {etapa.nota ? <Text style={s.nota}>{etapa.nota}</Text> : null}
          {etapa.partes.map((p, j) => (
            <TarjetaParte key={`${p.rol}-${j}`} p={p} />
          ))}
        </View>
      ))}
      {a.historial.length > 1 ? (
        <View wrap={false} style={{ marginTop: 6 }}>
          <Text style={s.etapaTitulo}>Recorrido del documento</Text>
          {a.historial.slice(-12).map((h) => (
            <Fila key={h.numero} k={`Versión ${h.numero} · ${h.enviadaAt}`} v={h.resultado} />
          ))}
        </View>
      ) : null}
      <Pie texto={AVISO_REDINMO_NO_ES_PARTE} prefijo="Anexo · " />
    </Page>
  );
}

function PaginaAnexoFirmaLegado({ a }: { a: AnexoFirmaLegado }) {
  return (
    <Page size="A4" style={s.pagina}>
      <CabeceraAnexo titulo="Constancia de firma electrónica" subtitulo={`Registro generado por Redinmo.io · ${a.nombreDocumento}`} />
      <Text style={s.aviso}>{AVISO_FIRMA_ELECTRONICA}</Text>
      {a.nota ? <Text style={[s.aviso, { fontWeight: 600 }]}>{a.nota}</Text> : null}
      {a.firmantes.map((f) => (
        <View key={f.rol + f.correo} wrap={false} style={s.tarjeta}>
          <Text style={[s.tarjetaNombre, { marginBottom: 4 }]}>
            {f.nombre} — {f.rol}
          </Text>
          <Fila k="Cédula / RUC" v={f.cedula} />
          <Fila k="Correo notificado" v={f.correo} />
          <Fila k="Envío del enlace" v={f.enviadoAt ?? '—'} />
          <Fila k="Primer acceso" v={f.abiertoAt ?? '—'} />
          <Fila k="Firma registrada" v={f.firmadoAt ?? '—'} />
          <Fila k="Dirección IP" v={f.ip ?? '—'} />
          <Fila k="Navegador y dispositivo" v={f.navegador ?? '—'} />
          <Fila k="Leyó el texto hasta el final" v={f.leyoCompleto ? 'Sí' : 'No'} />
        </View>
      ))}
      <View style={{ marginTop: 6 }}>
        <Fila k="Identificador" v={a.codigo} />
        <Fila k="Hash SHA-256" v={a.hash ?? '—'} pequeno />
        <Fila k="Verificación" v={a.urlVerificacion} />
      </View>
      <Pie texto={AVISO_REDINMO_NO_ES_PARTE_LEGADO} prefijo="Anexo · " />
    </Page>
  );
}

export function DocumentoContrato({ datos }: { datos: DatosPdfContrato }) {
  return (
    // Metadatos neutros: el archivo es del agente y de sus clientes.
    <Document title={datos.nombreDocumento} author="" creator="" producer="" language="es">
      <Page size="A4" style={s.pagina}>
        {datos.borrador ? (
          <Text fixed style={s.marca}>
            BORRADOR
          </Text>
        ) : null}
        <Cuerpo datos={datos} />
        <Pie texto={datos.pie} prefijo="Página " />
      </Page>
      {datos.anexo?.tipo === 'aprobacion' ? <PaginaAnexoAprobacion a={datos.anexo} /> : null}
      {datos.anexo?.tipo === 'firma-legado' ? <PaginaAnexoFirmaLegado a={datos.anexo} /> : null}
    </Document>
  );
}

export async function renderContratoPdf(datos: DatosPdfContrato): Promise<Buffer> {
  registrarFuentes();
  return renderToBuffer(<DocumentoContrato datos={datos} />);
}
