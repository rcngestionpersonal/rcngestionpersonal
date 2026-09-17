import type { CambiosEntreVersiones } from './clausulas';
import { AVISO_APROBACION } from './tipos';

// Correos del flujo de aprobación de borrador. HTML con tablas y CSS en línea,
// ancho máximo 600px y fondo claro: las mismas restricciones que el resto de
// los correos de la plataforma, porque los clientes de correo no soportan hojas
// de estilo ni flexbox. Siempre con versión de texto plano de respaldo.

const MARCO = (titulo: string, cuerpo: string) => `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:32px 16px;background:#faf9fd;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e6e1f2;border-radius:16px;">
      <tr><td style="padding:32px 28px;">
        <p style="margin:0 0 22px;font-size:13px;font-weight:600;letter-spacing:0.04em;">
          <span style="color:#0d9488;">&#10022;</span> <span style="color:#1a1330;">REDINMO.IO</span>
        </p>
        <h1 style="margin:0 0 16px;font-size:21px;font-weight:700;color:#1a1330;line-height:1.3;">${titulo}</h1>
        ${cuerpo}
        <hr style="border:none;border-top:1px solid #e6e1f2;margin:26px 0 16px;" />
        <p style="margin:0;font-size:11.5px;line-height:1.5;color:#8b83a6;">
          Si usted no es el destinatario, por favor contacte con quien se lo envió y no acceda al enlace.
        </p>
        <p style="margin:8px 0 0;font-size:11.5px;color:#8b83a6;">redinmo.io &middot; El hub que conecta colegas</p>
      </td></tr>
    </table>
  </body>
</html>`;

const BOTON = (url: string, etiqueta: string) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0;">
    <tr><td align="center" bgcolor="#0d9488" style="border-radius:9px;">
      <a href="${url}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${etiqueta}</a>
    </td></tr>
  </table>
  <p style="margin:0 0 6px;font-size:12.5px;color:#635a80;">Si el botón no funciona, copie y pegue este enlace en su navegador:</p>
  <p style="margin:0 0 8px;font-size:12.5px;word-break:break-all;"><a href="${url}" style="color:#0d9488;">${url}</a></p>`;

const P = 'margin:0 0 10px;font-size:14.5px;line-height:1.6;color:#635a80;';
const FUERTE = 'color:#1a1330;';

function esc(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// La advertencia viaja también en el correo, con el mismo peso que el resto:
// quien aprueba desde el celular puede no llegar a leer la página entera.
const AVISO_HTML = `<p style="margin:18px 0 0;padding:12px 14px;background:#fff7e6;border:1px solid #f1d49b;border-radius:8px;font-size:14px;line-height:1.6;color:#6b4406;">${esc(
  AVISO_APROBACION,
)}</p>`;

function listaCambios(cambios: CambiosEntreVersiones | null): { html: string; texto: string[] } {
  if (!cambios) return { html: '', texto: [] };
  const lineas = [
    ...cambios.modificadas.map((c) => `Modificada: ${c}`),
    ...cambios.agregadas.map((c) => `Nueva: ${c}`),
    ...cambios.retiradas.map((c) => `Retirada: ${c}`),
    ...(cambios.otros ? ['Cambios en los datos de las partes o del inmueble'] : []),
  ];
  if (lineas.length === 0) return { html: '', texto: [] };
  return {
    html: `<p style="margin:14px 0 6px;font-size:13px;font-weight:700;color:#1a1330;">Cambios respecto de la versión anterior</p>
      <ul style="margin:0 0 6px;padding-left:20px;font-size:13.5px;line-height:1.6;color:#635a80;">${lineas
        .map((l) => `<li>${esc(l)}</li>`)
        .join('')}</ul>`,
    texto: ['Cambios respecto de la versión anterior:', ...lineas.map((l) => `- ${l}`)],
  };
}

export function correoSolicitudAprobacion(input: {
  nombreParte: string;
  nombreDocumento: string;
  numero: number;
  agente: { nombre: string; empresa: string | null };
  url: string;
  venceEl: string;
  cambios: CambiosEntreVersiones | null;
}): { subject: string; text: string; html: string } {
  const subject = `Para su revisión: ${input.nombreDocumento} (versión ${input.numero})`;
  const remitente = input.agente.empresa ? `${input.agente.nombre} (${input.agente.empresa})` : input.agente.nombre;
  const cambios = listaCambios(input.cambios);

  const html = MARCO(
    input.numero > 1 ? 'Hay una versión nueva del documento' : 'Tiene un documento para revisar',
    `<p style="${P}">Estimado/a ${esc(input.nombreParte)}:</p>
     <p style="${P}">
       <strong style="${FUERTE}">${esc(remitente)}</strong> le envía la versión ${input.numero} de
       <strong style="${FUERTE}">${esc(input.nombreDocumento)}</strong> para que la revise.
       Si está de acuerdo con el texto, apruébela; si necesita cambios, indíquelos y recibirá una versión nueva.
     </p>
     ${cambios.html}
     <p style="${P}">El enlace es personal y está disponible hasta el ${esc(input.venceEl)}.</p>
     ${BOTON(input.url, 'Revisar el documento')}
     ${AVISO_HTML}`,
  );

  const text = [
    `Estimado/a ${input.nombreParte}:`,
    '',
    `${remitente} le envía la versión ${input.numero} de "${input.nombreDocumento}" para que la revise. Si está de acuerdo con el texto, apruébela; si necesita cambios, indíquelos y recibirá una versión nueva.`,
    ...(cambios.texto.length ? ['', ...cambios.texto] : []),
    '',
    `El enlace es personal y está disponible hasta el ${input.venceEl}.`,
    '',
    input.url,
    '',
    AVISO_APROBACION,
    '',
    'Si usted no es el destinatario, contacte con quien se lo envió y no acceda al enlace.',
  ].join('\n');

  return { subject, text, html };
}

export function correoVersionAprobada(input: {
  nombre: string;
  nombreDocumento: string;
  numero: number;
  aprobadaPor: string;
  codigo: string;
  urlVerificacion: string;
}): { subject: string; text: string; html: string } {
  const subject = `Versión ${input.numero} aprobada: ${input.nombreDocumento}`;
  const html = MARCO(
    `Todas las partes aprobaron la versión ${input.numero}`,
    `<p style="${P}">Estimado/a ${esc(input.nombre)}:</p>
     <p style="${P}">
       La versión ${input.numero} de <strong style="${FUERTE}">${esc(input.nombreDocumento)}</strong> quedó aprobada por
       ${esc(input.aprobadaPor)}. La adjuntamos en PDF, con la constancia de aprobación como anexo separado.
     </p>
     <p style="${P}">
       Es el texto acordado para llevar a la firma. Si la negociación continúa, puede recibir versiones nuevas.
     </p>
     <p style="margin:0 0 4px;font-size:13px;color:#635a80;">Identificador:</p>
     <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#1a1330;letter-spacing:0.08em;">${esc(input.codigo)}</p>
     <p style="margin:0;font-size:13px;line-height:1.6;color:#635a80;">
       El registro de aprobaciones puede consultarse en
       <a href="${input.urlVerificacion}" style="color:#0d9488;">${input.urlVerificacion}</a>. Esa página nunca muestra el contenido.
     </p>
     ${AVISO_HTML}`,
  );
  const text = [
    `Estimado/a ${input.nombre}:`,
    '',
    `La versión ${input.numero} de "${input.nombreDocumento}" quedó aprobada por ${input.aprobadaPor}. La adjuntamos en PDF, con la constancia de aprobación como anexo separado.`,
    'Es el texto acordado para llevar a la firma. Si la negociación continúa, puede recibir versiones nuevas.',
    '',
    `Identificador: ${input.codigo}`,
    `Registro de aprobaciones: ${input.urlVerificacion}`,
    '',
    AVISO_APROBACION,
  ].join('\n');
  return { subject, text, html };
}

export function correoVersionNoAprobada(input: {
  nombreAgente: string;
  nombreDocumento: string;
  numero: number;
  quien: string;
  motivo: string;
}): { subject: string; text: string; html: string } {
  const subject = `Piden cambios en la versión ${input.numero}: ${input.nombreDocumento}`;
  const html = MARCO(
    'Una de las partes no aprobó la versión',
    `<p style="${P}">Hola ${esc(input.nombreAgente)}:</p>
     <p style="${P}">
       <strong style="${FUERTE}">${esc(input.quien)}</strong> no aprobó la versión ${input.numero} de
       <strong style="${FUERTE}">${esc(input.nombreDocumento)}</strong>. Los enlaces de esa versión dejaron de estar activos.
     </p>
     <p style="margin:0 0 4px;font-size:13px;color:#635a80;">Lo que indicó:</p>
     <p style="margin:0 0 14px;padding:12px 14px;background:#f5f3fa;border-radius:8px;font-size:14px;line-height:1.6;color:#1a1330;">${esc(input.motivo)}</p>
     <p style="margin:0;font-size:14px;line-height:1.6;color:#635a80;">Edita el documento y envía la versión ${input.numero + 1}: el historial conserva lo que pidió cada parte.</p>`,
  );
  const text = [
    `Hola ${input.nombreAgente}:`,
    '',
    `${input.quien} no aprobó la versión ${input.numero} de "${input.nombreDocumento}". Los enlaces de esa versión dejaron de estar activos.`,
    '',
    `Lo que indicó: ${input.motivo}`,
    '',
    `Edita el documento y envía la versión ${input.numero + 1}: el historial conserva lo que pidió cada parte.`,
  ].join('\n');
  return { subject, text, html };
}

export function correoCancelado(input: { nombreParte: string; nombreDocumento: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `Cancelado: ${input.nombreDocumento}`;
  const html = MARCO(
    'Ya no hace falta revisar este documento',
    `<p style="${P}">Estimado/a ${esc(input.nombreParte)}:</p>
     <p style="margin:0;font-size:14.5px;line-height:1.6;color:#635a80;">
       Quien le hizo llegar <strong style="${FUERTE}">${esc(input.nombreDocumento)}</strong> canceló el proceso.
       El enlace que recibió ya no está activo y no se requiere ninguna acción de su parte.
     </p>`,
  );
  const text = [
    `Estimado/a ${input.nombreParte}:`,
    '',
    `Quien le hizo llegar "${input.nombreDocumento}" canceló el proceso. El enlace ya no está activo y no se requiere ninguna acción de su parte.`,
  ].join('\n');
  return { subject, text, html };
}
