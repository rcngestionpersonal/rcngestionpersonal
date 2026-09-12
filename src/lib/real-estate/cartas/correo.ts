import { CARTA_BLOQUES, type CartaBloques } from './tipos';

// Cuerpo del correo con el que viaja la carta.
//
// POR QUE ESTA ESCRITO ASI, y no como el resto de la interfaz: un cliente de
// correo no es un navegador. Outlook renderiza con el motor de Word y no
// soporta flexbox ni grid; Gmail descarta las hojas de estilo y buena parte de
// lo que hay en <style>. Por eso aqui hay tablas anidadas y CSS en linea, que
// en 2026 sigue siendo la unica forma de que un correo se vea igual en todas
// partes.
//
// REGLAS QUE NO SE ROMPEN:
//   - Maquetacion con <table>, nunca flex ni grid.
//   - Todo el CSS en el atributo style, nunca en <style> ni en hojas externas.
//   - 600px de ancho maximo, centrado, y legible a 320px.
//   - Colores planos: sin degradados, sin sombras, sin fuentes descargadas.
//   - Imagenes con URL absoluta y alt. El diseño NO puede depender de ellas:
//     muchos clientes las bloquean por defecto y el correo tiene que leerse
//     igual de bien.
//   - Fondo claro siempre. Un correo de fondo oscuro se vuelve ilegible cuando
//     el cliente le aplica su propia inversion de modo oscuro.

const VIOLETA = '#6d4aff';
const TEAL = '#0d9488';
const TEXTO = '#14121f';
const TEXTO_2 = '#635a80';
const TEXTO_3 = '#8b83a6';
const LINEA = '#e6e1f2';
const FONDO = '#f6f4fb';

// Pila de fuentes segura: las tres existen en Windows, macOS, Android e iOS.
const FUENTE = "Helvetica, Arial, sans-serif";

export type DatosCorreoCarta = {
  agente: {
    nombre: string;
    empresa: string | null;
    telefono: string | null;
    correo: string;
    imagenUrl: string | null;
    verificado: boolean;
  };
  destinatario: { nombre: string; cargo?: string | null };
  bloques: CartaBloques;
  // Nota que el agente escribio al enviar, si la hay. Va antes de la carta.
  mensaje?: string | null;
  // Solo cuando el mini-sitio esta publicado Y el agente dejo el enlace activo.
  urlMiniSitio: string | null;
  nombreAdjunto: string;
};

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Cada bloque es un parrafo. Se respetan ademas los saltos de linea que el
// agente haya metido al editar: si partio un bloque en dos, se ve partido en
// dos, y no pegado en un ladrillo.
function parrafos(bloques: CartaBloques): string[] {
  const salida: string[] = [];
  for (const clave of CARTA_BLOQUES) {
    // El saludo va aparte, en su propia linea destacada.
    if (clave === 'saludo') continue;
    const texto = bloques[clave].trim();
    if (!texto) continue;
    for (const parte of texto.split(/\n{1,}/)) {
      const limpio = parte.trim();
      if (limpio) salida.push(limpio);
    }
  }
  return salida;
}

// Iniciales para el circulo del encabezado. Es lo que se ve cuando el cliente
// bloquea las imagenes, y por eso se dibuja con texto y color de fondo, no con
// una imagen de respaldo.
function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function cuerpoHtmlCarta(d: DatosCorreoCarta): string {
  const saludo = d.bloques.saludo.trim() || `Estimado/a ${d.destinatario.nombre}:`;
  const cuerpo = parrafos(d.bloques);
  const empresa = d.agente.empresa ? escapar(d.agente.empresa) : null;

  const avatar = d.agente.imagenUrl
    ? // El alt son las INICIALES, no el nombre: cuando el cliente bloquea la
      // imagen, el texto alternativo se dibuja dentro de un cuadro de 56px y un
      // nombre completo se desborda y parece rota. Dos letras caben.
      `<img src="${escapar(d.agente.imagenUrl)}" alt="${escapar(iniciales(d.agente.nombre))}" width="56" height="56"
           style="display:block;width:56px;height:56px;border-radius:28px;object-fit:cover;border:0;background-color:${FONDO};font-family:${FUENTE};font-size:16px;font-weight:bold;color:${VIOLETA};text-align:center;line-height:56px;" />`
    : // Sin imagen, o con imagenes bloqueadas, queda el circulo con iniciales.
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="56" style="width:56px;">
         <tr><td align="center" valign="middle" height="56"
                 style="height:56px;background-color:${VIOLETA};border-radius:28px;color:#ffffff;font-family:${FUENTE};font-size:20px;font-weight:bold;">
           ${escapar(iniciales(d.agente.nombre))}
         </td></tr>
       </table>`;

  const sello = d.agente.verificado
    ? `<tr><td style="padding-top:6px;font-family:${FUENTE};font-size:12px;color:${TEAL};font-weight:bold;">
         &#10003; Agente verificado en Redinmo
       </td></tr>`
    : '';

  const botonMiniSitio = d.urlMiniSitio
    ? `<tr><td style="padding:8px 0 4px;">
         <table role="presentation" cellpadding="0" cellspacing="0" border="0">
           <tr><td align="center" bgcolor="${VIOLETA}" style="border-radius:6px;">
             <a href="${escapar(d.urlMiniSitio)}"
                style="display:inline-block;padding:12px 22px;font-family:${FUENTE};font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">
               Ver mi perfil profesional
             </a>
           </td></tr>
         </table>
       </td></tr>
       <tr><td style="padding-bottom:4px;font-family:${FUENTE};font-size:12px;color:${TEXTO_3};word-break:break-all;">
         ${escapar(d.urlMiniSitio.replace(/^https?:\/\//, ''))}
       </td></tr>`
    : '';

  const contacto = [
    d.agente.telefono ? escapar(d.agente.telefono) : null,
    escapar(d.agente.correo),
  ]
    .filter(Boolean)
    .join(' &middot; ');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapar(saludo)}</title>
</head>
<body style="margin:0;padding:0;background-color:${FONDO};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${FONDO};">
  <tr>
    <td align="center" style="padding:24px 12px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
             style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid ${LINEA};border-radius:12px;">

        <!-- Franja superior: quien escribe -->
        <tr>
          <td style="padding:20px 24px;border-bottom:1px solid ${LINEA};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="56" valign="top" style="width:56px;padding-right:14px;">${avatar}</td>
                <td valign="middle" style="font-family:${FUENTE};">
                  <div style="font-size:17px;font-weight:bold;color:${TEXTO};line-height:1.3;">${escapar(d.agente.nombre)}</div>
                  ${empresa ? `<div style="font-size:13px;color:${TEXTO_2};padding-top:2px;">${empresa}</div>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- La carta -->
        <tr>
          <td style="padding:24px;font-family:${FUENTE};">
            <p style="margin:0 0 16px;font-size:16px;font-weight:bold;color:${TEXTO};line-height:1.4;">${escapar(saludo)}</p>
            ${
              d.mensaje
                ? `<p style="margin:0 0 16px;font-size:15px;color:${TEXTO_2};line-height:1.65;">${escapar(d.mensaje)}</p>`
                : ''
            }
            ${cuerpo
              .map(
                (p) =>
                  `<p style="margin:0 0 14px;font-size:15px;color:${TEXTO_2};line-height:1.65;">${escapar(p)}</p>`,
              )
              .join('\n            ')}
          </td>
        </tr>

        <!-- Firma -->
        <tr>
          <td style="padding:0 24px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                   style="border-top:1px solid ${LINEA};">
              <tr><td style="padding-top:16px;font-family:${FUENTE};font-size:15px;font-weight:bold;color:${TEXTO};">
                ${escapar(d.agente.nombre)}
              </td></tr>
              ${empresa ? `<tr><td style="font-family:${FUENTE};font-size:13px;color:${TEXTO_2};padding-top:2px;">${empresa}</td></tr>` : ''}
              <tr><td style="font-family:${FUENTE};font-size:13px;color:${TEXTO_2};padding-top:4px;">${contacto}</td></tr>
              ${sello}
            </table>
          </td>
        </tr>

        <!-- Perfil profesional -->
        ${
          botonMiniSitio
            ? `<tr><td style="padding:0 24px 16px;">
                 <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${botonMiniSitio}</table>
               </td></tr>`
            : ''
        }

        <!-- El adjunto -->
        <tr>
          <td style="padding:0 24px 22px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                   style="background-color:${FONDO};border-radius:8px;">
              <tr><td style="padding:12px 14px;font-family:${FUENTE};font-size:13px;color:${TEXTO_2};line-height:1.5;">
                La carta completa va adjunta en PDF: <strong style="color:${TEXTO};">${escapar(d.nombreAdjunto)}</strong>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Pie -->
        <tr>
          <td style="padding:14px 24px 18px;border-top:1px solid ${LINEA};font-family:${FUENTE};">
            <div style="font-size:12px;color:${TEXTO_3};line-height:1.5;">
              Enviado con <span style="color:${VIOLETA};font-weight:bold;">Redinmo.io</span>.
              Puede responder directamente a este correo para contactar con ${escapar(d.agente.nombre)}.
            </div>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

// Version de texto plano. Tiene que sostenerse SOLA: es lo que ve quien lee en
// un cliente sin HTML, y nunca dice "abre esto en tu navegador". Lleva la carta
// entera con su firma.
export function cuerpoTextoCarta(d: DatosCorreoCarta): string {
  const lineas = [d.bloques.saludo.trim() || `Estimado/a ${d.destinatario.nombre}:`, ''];
  if (d.mensaje) lineas.push(d.mensaje.trim(), '');
  lineas.push(parrafos(d.bloques).join('\n\n'), '', '—', d.agente.nombre);
  if (d.agente.empresa) lineas.push(d.agente.empresa);
  if (d.agente.telefono) lineas.push(d.agente.telefono);
  lineas.push(d.agente.correo);
  if (d.agente.verificado) lineas.push('✓ Agente verificado en Redinmo');
  if (d.urlMiniSitio) lineas.push('', `Perfil profesional: ${d.urlMiniSitio}`);
  lineas.push('', `La carta completa va adjunta en PDF: ${d.nombreAdjunto}`, '', 'Enviado con Redinmo.io');
  return lineas.join('\n');
}
