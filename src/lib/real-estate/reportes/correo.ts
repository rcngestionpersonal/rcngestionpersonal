// Cuerpo del correo con el que viaja cualquiera de los tres reportes. El
// reporte va adjunto; el cuerpo solo presenta al remitente y dice que hay
// adentro. Mismas reglas que el correo de las cartas: tablas, CSS en linea,
// fondo claro y nada que dependa de imagenes.

const VIOLETA = '#6d4aff';
const TEXTO = '#14121f';
const TEXTO_2 = '#635a80';
const TEXTO_3 = '#8b83a6';
const LINEA = '#e6e1f2';
const FONDO = '#f6f4fb';
const FUENTE = 'Helvetica, Arial, sans-serif';

export type DatosCorreoReporte = {
  agente: { nombre: string; empresa: string | null; telefono: string | null; correo: string };
  // "de visita", "de gestión", "de tasación"
  tipo: string;
  inmueble: string;
  mensaje: string | null;
  nombreAdjunto: string;
};

function escapar(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function asuntoReporte(d: Pick<DatosCorreoReporte, 'tipo' | 'inmueble'>): string {
  return `Reporte ${d.tipo}: ${d.inmueble}`;
}

export function cuerpoHtmlReporte(d: DatosCorreoReporte): string {
  const contacto = [d.agente.telefono, d.agente.correo].filter(Boolean).map((x) => escapar(x as string)).join(' &middot; ');
  const mensaje = d.mensaje
    ? d.mensaje
        .split(/\n+/)
        .filter((l) => l.trim())
        .map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${TEXTO_2};">${escapar(l.trim())}</p>`)
        .join('')
    : `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${TEXTO_2};">Le comparto el reporte ${escapar(d.tipo)} de su inmueble.</p>`;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapar(asuntoReporte(d))}</title></head>
<body style="margin:0;padding:0;background-color:${FONDO};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${FONDO};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid ${LINEA};border-radius:12px;">
      <tr><td style="padding:20px 24px;border-bottom:1px solid ${LINEA};font-family:${FUENTE};">
        <div style="font-size:12px;font-weight:bold;letter-spacing:1px;color:${VIOLETA};">REPORTE ${escapar(d.tipo.toUpperCase())}</div>
        <div style="font-size:18px;font-weight:bold;color:${TEXTO};padding-top:4px;">${escapar(d.inmueble)}</div>
      </td></tr>
      <tr><td style="padding:22px 24px 8px;font-family:${FUENTE};">${mensaje}</td></tr>
      <tr><td style="padding:0 24px 20px;font-family:${FUENTE};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid ${LINEA};">
          <tr><td style="padding-top:14px;font-size:15px;font-weight:bold;color:${TEXTO};">${escapar(d.agente.nombre)}</td></tr>
          ${d.agente.empresa ? `<tr><td style="font-size:13px;color:${TEXTO_2};padding-top:2px;">${escapar(d.agente.empresa)}</td></tr>` : ''}
          <tr><td style="font-size:13px;color:${TEXTO_2};padding-top:4px;">${contacto}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 24px 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${FONDO};border-radius:8px;">
          <tr><td style="padding:12px 14px;font-family:${FUENTE};font-size:13px;color:${TEXTO_2};line-height:1.5;">
            El reporte completo va adjunto: <strong style="color:${TEXTO};">${escapar(d.nombreAdjunto)}</strong>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:14px 24px 18px;border-top:1px solid ${LINEA};font-family:${FUENTE};font-size:12px;color:${TEXTO_3};line-height:1.5;">
        Enviado con <span style="color:${VIOLETA};font-weight:bold;">Redinmo.io</span>. Puede responder a este correo para contactar con ${escapar(d.agente.nombre)}.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function cuerpoTextoReporte(d: DatosCorreoReporte): string {
  const lineas = [d.mensaje?.trim() || `Le comparto el reporte ${d.tipo} de su inmueble.`, '', '—', d.agente.nombre];
  if (d.agente.empresa) lineas.push(d.agente.empresa);
  if (d.agente.telefono) lineas.push(d.agente.telefono);
  lineas.push(d.agente.correo, '', `El reporte completo va adjunto: ${d.nombreAdjunto}`, '', 'Enviado con Redinmo.io');
  return lineas.join('\n');
}
