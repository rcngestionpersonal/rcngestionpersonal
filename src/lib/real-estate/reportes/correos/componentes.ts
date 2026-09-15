import { resolverSaludo } from '@/lib/real-estate/cartas/saludo';

// Piezas de los correos de reportes. Los tres reportes (visita, gestion,
// tasacion) se arman con estas mismas piezas, asi que la cabecera, la firma y el
// pie se cambian en UN lugar y los tres quedan iguales.
//
// REGLAS QUE NO SE ROMPEN (un cliente de correo no es un navegador):
//   - Maquetacion con <table>. Outlook dibuja con el motor de Word y no conoce
//     flexbox ni grid.
//   - CSS en el atributo style. Gmail descarta buena parte de <style>.
//   - 600px de ancho maximo, centrado, y legible a 320px.
//   - Colores planos, sin degradados ni sombras, pila Helvetica/Arial.
//   - Imagenes con URL absoluta, alt y dimensiones. Nada depende de ellas: con
//     las imagenes bloqueadas el correo se lee completo.
//   - Fondo claro siempre.
//
// VOZ: la del agente, en primera persona. Nunca "se ha generado", "mensaje
// automatico" ni "el sistema registro": es correspondencia entre un agente y su
// cliente, no una notificacion.

export const COLOR = {
  violeta: '#6d4aff',
  violetaSuave: '#e9e3ff',
  teal: '#0d9488',
  tealTenue: '#e6f4f2',
  texto: '#14121f',
  texto2: '#5a5673',
  borde: '#e6e3ef',
  tenue: '#f8f7fb',
  blanco: '#ffffff',
  ambar: '#f3d27a',
  ambarTexto: '#3b2a00',
  gris: '#e6e3ef',
} as const;

const FUENTE = 'Helvetica, Arial, sans-serif';

export type AgenteCorreo = {
  nombre: string;
  empresa: string | null;
  telefono: string | null;
  correo: string;
  imagenUrl: string | null;
  verificado: boolean;
  urlMiniSitio: string | null;
};

export function escapar(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

// Cada seccion es una fila de la tabla principal con el mismo margen lateral.
function fila(contenido: string, relleno = '0 24px 20px'): string {
  return `<tr><td style="padding:${relleno};font-family:${FUENTE};">${contenido}</td></tr>`;
}

// ---- Documento ----------------------------------------------------------------

export function documentoCorreo({ asunto, preencabezado, secciones }: { asunto: string; preencabezado: string; secciones: string[] }): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapar(asunto)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLOR.blanco};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLOR.blanco};">${escapar(preencabezado)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${COLOR.blanco};">
  <tr>
    <td align="center" style="padding:16px 8px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background-color:${COLOR.blanco};border:1px solid ${COLOR.borde};">
        ${secciones.join('\n        ')}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ---- Cabecera del agente (2.1) --------------------------------------------------

export function cabeceraAgente(agente: AgenteCorreo, etiqueta: string): string {
  // Sin imagen, o con imagenes bloqueadas, queda un cuadro con las iniciales. El
  // alt son las iniciales, no el nombre: un nombre completo no cabe en 48px y se
  // ve roto.
  const imagen = agente.imagenUrl
    ? `<img src="${escapar(agente.imagenUrl)}" alt="${escapar(iniciales(agente.nombre))}" width="48" height="48"
            style="display:block;width:48px;height:48px;border:0;border-radius:8px;background-color:#8b70ff;color:${COLOR.blanco};font-family:${FUENTE};font-size:16px;font-weight:bold;line-height:48px;text-align:center;" />`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="48"><tr>
         <td width="48" height="48" align="center" valign="middle" style="width:48px;height:48px;border-radius:8px;background-color:#8b70ff;color:${COLOR.blanco};font-family:${FUENTE};font-size:16px;font-weight:bold;">${escapar(iniciales(agente.nombre))}</td>
       </tr></table>`;

  return `<tr><td bgcolor="${COLOR.violeta}" style="background-color:${COLOR.violeta};padding:18px 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td width="48" valign="middle" style="width:48px;">${imagen}</td>
      <td valign="middle" style="padding-left:12px;font-family:${FUENTE};">
        <div style="font-size:17px;line-height:1.25;font-weight:bold;color:${COLOR.blanco};">${escapar(agente.nombre)}</div>
        ${agente.empresa ? `<div style="font-size:13px;line-height:1.4;color:${COLOR.violetaSuave};padding-top:2px;">${escapar(agente.empresa)}</div>` : ''}
      </td>
      <td align="right" valign="middle" style="padding-left:8px;font-family:${FUENTE};font-size:12px;color:${COLOR.violetaSuave};">${escapar(etiqueta)}</td>
    </tr></table>
  </td></tr>`;
}

// ---- Texto ----------------------------------------------------------------------

// "Estimada Ing. Gabriela Muñoz," con las mismas reglas de las cartas: genero
// solo con certeza. Sin nombre, un saludo neutro que no invente uno.
export function lineaSaludo(nombre: string | null | undefined): string {
  const limpio = nombre?.trim();
  return limpio ? resolverSaludo(limpio).texto : 'Reciba un cordial saludo,';
}

export function saludo(nombre: string | null | undefined): string {
  return fila(`<p style="margin:0;font-size:16px;line-height:1.5;font-weight:bold;color:${COLOR.texto};">${escapar(lineaSaludo(nombre))}</p>`, '24px 24px 14px');
}

export function parrafo(texto: string): string {
  return fila(`<p style="margin:0;font-size:15px;line-height:1.6;color:${COLOR.texto2};">${escapar(texto)}</p>`, '0 24px 18px');
}

export function tituloSeccion(texto: string): string {
  return `<div style="font-size:11px;letter-spacing:1px;font-weight:bold;color:${COLOR.texto2};padding-bottom:8px;">${escapar(texto.toUpperCase())}</div>`;
}

// ---- Tarjeta del inmueble (2.3) -------------------------------------------------

export type InmuebleCorreo = { fotoUrl: string | null; tipo: string; sector: string; referencia: string | null; precio: string | null };

export function tarjetaInmueble(i: InmuebleCorreo): string {
  const foto = i.fotoUrl
    ? `<td width="96" valign="top" style="width:96px;padding-right:14px;">
         <img src="${escapar(i.fotoUrl)}" alt="Foto del inmueble" width="96" height="72"
              style="display:block;width:96px;height:72px;border:0;border-radius:6px;object-fit:cover;background-color:${COLOR.borde};font-family:${FUENTE};font-size:11px;color:${COLOR.texto2};" />
       </td>`
    : '';
  return fila(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${COLOR.tenue};border:1px solid ${COLOR.borde};border-radius:8px;">
      <tr><td style="padding:14px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          ${foto}
          <td valign="top" style="font-family:${FUENTE};">
            <div style="font-size:15px;line-height:1.35;font-weight:bold;color:${COLOR.texto};">${escapar(i.tipo)} en ${escapar(i.sector)}</div>
            ${i.referencia ? `<div style="font-size:12px;line-height:1.5;color:${COLOR.texto2};padding-top:3px;">Ref. ${escapar(i.referencia)}</div>` : ''}
            ${i.precio ? `<div style="font-size:15px;line-height:1.4;font-weight:bold;color:${COLOR.violeta};padding-top:6px;">${escapar(i.precio)}</div>` : ''}
          </td>
        </tr></table>
      </td></tr>
    </table>`);
}

// ---- Tabla etiqueta / valor (2.4) -----------------------------------------------

export function tablaDatos(titulo: string, filas: Array<[string, string]>): string {
  const cuerpo = filas
    .map(
      ([etiqueta, valor], i) => `<tr>
        <td valign="top" width="40%" style="width:40%;padding:9px 12px 9px 0;${i > 0 ? `border-top:1px solid ${COLOR.borde};` : ''}font-family:${FUENTE};font-size:13px;line-height:1.45;color:${COLOR.texto2};">${escapar(etiqueta)}</td>
        <td valign="top" style="padding:9px 0;${i > 0 ? `border-top:1px solid ${COLOR.borde};` : ''}font-family:${FUENTE};font-size:14px;line-height:1.45;font-weight:bold;color:${COLOR.texto};">${escapar(valor)}</td>
      </tr>`,
    )
    .join('');
  return fila(`${tituloSeccion(titulo)}<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${cuerpo}</table>`);
}

// ---- Resultado de la visita (2.5) -----------------------------------------------

export type NivelInteres = 'MUY_INTERESADO' | 'INTERESADO_CON_REPAROS' | 'NO_INTERESADO';

const CHIP: Record<NivelInteres, { fondo: string; texto: string; etiqueta: string }> = {
  MUY_INTERESADO: { fondo: COLOR.teal, texto: COLOR.blanco, etiqueta: 'Muy interesado' },
  INTERESADO_CON_REPAROS: { fondo: COLOR.ambar, texto: COLOR.ambarTexto, etiqueta: 'Interesado, con reparos' },
  NO_INTERESADO: { fondo: COLOR.gris, texto: COLOR.texto, etiqueta: 'No interesado' },
};

export function etiquetaInteres(nivel: NivelInteres): string {
  return CHIP[nivel].etiqueta;
}

// El chip lleva texto, no solo color: con el color quitado (modo alto
// contraste, impresion en blanco y negro) el nivel se sigue leyendo.
export function chipInteres(nivel: NivelInteres): string {
  const c = CHIP[nivel];
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td bgcolor="${c.fondo}" style="background-color:${c.fondo};border-radius:14px;padding:6px 14px;font-family:${FUENTE};font-size:14px;font-weight:bold;color:${c.texto};">${escapar(c.etiqueta)}</td>
  </tr></table>`;
}

export function bloqueResultado({ nivel, observaciones, comentarios }: { nivel: NivelInteres; observaciones: string | null; comentarios: string | null }): string {
  const obs = observaciones
    ? `<p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:${COLOR.texto};">${escapar(observaciones)}</p>`
    : '';
  const com = comentarios
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:14px;"><tr>
         <td style="padding:12px 14px;background-color:${COLOR.tenue};border:1px solid ${COLOR.borde};border-radius:8px;font-family:${FUENTE};">
           <div style="font-size:11px;letter-spacing:1px;font-weight:bold;color:${COLOR.texto2};">COMENTARIOS DEL VISITANTE</div>
           <div style="font-size:14px;line-height:1.55;color:${COLOR.texto};padding-top:5px;">${escapar(comentarios)}</div>
         </td>
       </tr></table>`
    : '';
  return fila(`${tituloSeccion('Resultado de la visita')}${chipInteres(nivel)}${obs}${com}`);
}

// ---- Proximo paso (2.6) ---------------------------------------------------------

export function bloqueDestacado(etiqueta: string, texto: string): string {
  return fila(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td bgcolor="${COLOR.tealTenue}" style="background-color:${COLOR.tealTenue};border-left:4px solid ${COLOR.teal};padding:12px 14px;font-family:${FUENTE};">
        <div style="font-size:11px;letter-spacing:1px;font-weight:bold;color:${COLOR.teal};">${escapar(etiqueta.toUpperCase())}</div>
        <div style="font-size:15px;line-height:1.55;font-weight:bold;color:${COLOR.texto};padding-top:4px;">${escapar(texto)}</div>
      </td>
    </tr></table>`);
}

// ---- Cifras (gestion y tasacion) ------------------------------------------------

export function cifras(titulo: string, items: Array<{ valor: string; etiqueta: string; destacado?: boolean }>): string {
  // Dos por fila: a 320px cuatro columnas no se leen.
  const filas: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const par = items.slice(i, i + 2);
    filas.push(`<tr>${par
      .map(
        (it, j) => `<td width="50%" valign="top" style="width:50%;padding:${j === 0 ? '0 5px 10px 0' : '0 0 10px 5px'};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td style="padding:12px;border:1px solid ${it.destacado ? COLOR.teal : COLOR.borde};background-color:${it.destacado ? COLOR.tealTenue : COLOR.tenue};border-radius:8px;font-family:${FUENTE};">
              <div style="font-size:20px;line-height:1.2;font-weight:bold;color:${COLOR.texto};">${escapar(it.valor)}</div>
              <div style="font-size:12px;line-height:1.4;color:${COLOR.texto2};padding-top:3px;">${escapar(it.etiqueta)}</div>
            </td>
          </tr></table>
        </td>`,
      )
      .join('')}${par.length === 1 ? '<td width="50%" style="width:50%;"></td>' : ''}</tr>`);
  }
  return fila(`${tituloSeccion(titulo)}<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${filas.join('')}</table>`, '0 24px 10px');
}

export function bloqueTexto(titulo: string, texto: string): string {
  return fila(`${tituloSeccion(titulo)}<p style="margin:0;font-size:15px;line-height:1.6;color:${COLOR.texto};">${escapar(texto)}</p>`);
}

export function notaDiscreta(texto: string): string {
  return fila(`<p style="margin:0;font-size:12px;line-height:1.55;color:${COLOR.texto2};">${escapar(texto)}</p>`, '0 24px 18px');
}

// ---- Cierre y firma (2.7) -------------------------------------------------------

// "Quedo atento" o "atenta" segun el agente, solo si se sabe con certeza. Si no,
// una formula sin genero: equivocarse con el genero del propio remitente seria
// peor que no marcarlo.
export function fraseCierre(nombreAgente: string): string {
  const trato = resolverSaludo(nombreAgente).trato;
  if (trato === 'femenino') return 'Quedo atenta a cualquier consulta.';
  if (trato === 'masculino') return 'Quedo atento a cualquier consulta.';
  return 'Quedo a su disposición para cualquier consulta.';
}

export function cierreYFirma(agente: AgenteCorreo): string {
  const contacto = [agente.telefono, agente.correo].filter(Boolean).map((x) => escapar(x as string)).join(' &middot; ');
  const sitio = agente.urlMiniSitio
    ? `<tr><td style="padding-top:10px;font-family:${FUENTE};font-size:13px;">
         <a href="${escapar(agente.urlMiniSitio)}" style="color:${COLOR.violeta};font-weight:bold;text-decoration:none;">Ver mi perfil profesional</a>
       </td></tr>`
    : '';
  return `${fila(`<p style="margin:0;font-size:15px;line-height:1.6;color:${COLOR.texto2};">${escapar(fraseCierre(agente.nombre))}</p>`, '4px 24px 16px')}
  ${fila(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid ${COLOR.borde};">
      <tr><td style="padding-top:14px;font-family:${FUENTE};font-size:15px;font-weight:bold;color:${COLOR.texto};">${escapar(agente.nombre)}</td></tr>
      ${agente.empresa ? `<tr><td style="font-family:${FUENTE};font-size:13px;line-height:1.5;color:${COLOR.texto2};">${escapar(agente.empresa)}</td></tr>` : ''}
      <tr><td style="padding-top:2px;font-family:${FUENTE};font-size:13px;line-height:1.5;color:${COLOR.texto2};">${contacto}</td></tr>
      ${agente.verificado ? `<tr><td style="padding-top:8px;font-family:${FUENTE};font-size:12px;font-weight:bold;color:${COLOR.teal};">&#10003; Agente verificado en Redinmo</td></tr>` : ''}
      ${sitio}
    </table>`)}`;
}

// ---- Adjunto (2.8) --------------------------------------------------------------

export function notaAdjunto(texto: string): string {
  return fila(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td style="padding:11px 14px;background-color:${COLOR.tenue};border:1px solid ${COLOR.borde};border-radius:8px;font-family:${FUENTE};font-size:13px;line-height:1.5;color:${COLOR.texto2};">&#128206; ${escapar(texto)}</td>
    </tr></table>`);
}

// Cuando el PDF supera el limite y el agente eligio mandar un enlace.
export function bloqueEnlaceDescarga(url: string, venceTexto: string): string {
  return fila(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td style="padding:14px;background-color:${COLOR.tenue};border:1px solid ${COLOR.borde};border-radius:8px;font-family:${FUENTE};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="${COLOR.violeta}" style="background-color:${COLOR.violeta};border-radius:6px;">
            <a href="${escapar(url)}" style="display:inline-block;padding:11px 18px;font-family:${FUENTE};font-size:14px;font-weight:bold;color:${COLOR.blanco};text-decoration:none;">Descargar el reporte completo (PDF)</a>
          </td>
        </tr></table>
        <div style="font-size:12px;line-height:1.5;color:${COLOR.texto2};padding-top:8px;">${escapar(venceTexto)}</div>
      </td>
    </tr></table>`);
}

// ---- Pie (2.9) --------------------------------------------------------------------

// Sin "darse de baja" ni lenguaje de newsletter: no es un envio masivo.
export function pie(): string {
  return `<tr><td style="padding:14px 24px 18px;border-top:1px solid ${COLOR.borde};font-family:${FUENTE};font-size:11px;line-height:1.5;color:#9a96ad;">Enviado a través de Redinmo.io</td></tr>`;
}

// ---- Texto plano ------------------------------------------------------------------

export function firmaTexto(agente: AgenteCorreo): string[] {
  const lineas = [fraseCierre(agente.nombre), '', agente.nombre];
  if (agente.empresa) lineas.push(agente.empresa);
  if (agente.telefono) lineas.push(agente.telefono);
  lineas.push(agente.correo);
  if (agente.verificado) lineas.push('✓ Agente verificado en Redinmo');
  if (agente.urlMiniSitio) lineas.push(`Mi perfil profesional: ${agente.urlMiniSitio}`);
  return lineas;
}

export function pieTexto(): string[] {
  return ['', '—', 'Enviado a través de Redinmo.io'];
}
