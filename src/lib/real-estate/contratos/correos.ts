// Correos del flujo de firma. HTML con tablas y CSS en linea, ancho maximo
// 600px y fondo claro: las mismas restricciones que el resto de los correos de
// la plataforma, porque los clientes de correo no soportan hojas de estilo ni
// flexbox. Siempre con version de texto plano de respaldo.

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

export function correoSolicitudFirma(input: {
  nombreFirmante: string;
  nombreDocumento: string;
  agente: { nombre: string; empresa: string | null };
  url: string;
  venceEl: string;
}): { subject: string; text: string; html: string } {
  const subject = `Para su firma: ${input.nombreDocumento}`;
  const remitente = input.agente.empresa ? `${input.agente.nombre} (${input.agente.empresa})` : input.agente.nombre;

  const html = MARCO(
    'Tiene un documento pendiente de firma',
    `<p style="margin:0 0 10px;font-size:14.5px;line-height:1.6;color:#635a80;">Estimado/a ${input.nombreFirmante}:</p>
     <p style="margin:0 0 10px;font-size:14.5px;line-height:1.6;color:#635a80;">
       <strong style="color:#1a1330;">${remitente}</strong> le ha hecho llegar el documento
       <strong style="color:#1a1330;">${input.nombreDocumento}</strong> para que lo revise y lo suscriba.
     </p>
     <p style="margin:0;font-size:14.5px;line-height:1.6;color:#635a80;">
       El enlace es personal e intransferible y está disponible hasta el ${input.venceEl}.
     </p>
     ${BOTON(input.url, 'Leer y firmar')}
     <p style="margin:0;font-size:12.5px;line-height:1.6;color:#8b83a6;">
       Podrá leerlo íntegro antes de decidir, descargarlo en PDF y, si no está de acuerdo, rechazarlo indicando el motivo.
     </p>`,
  );

  const text = [
    `Estimado/a ${input.nombreFirmante}:`,
    '',
    `${remitente} le ha hecho llegar el documento "${input.nombreDocumento}" para que lo revise y lo suscriba.`,
    `El enlace es personal e intransferible y está disponible hasta el ${input.venceEl}.`,
    '',
    input.url,
    '',
    'Podrá leerlo íntegro antes de decidir, descargarlo en PDF y, si no está de acuerdo, rechazarlo indicando el motivo.',
    '',
    'Si usted no es el destinatario, contacte con quien se lo envió y no acceda al enlace.',
  ].join('\n');

  return { subject, text, html };
}

export function correoDocumentoFirmado(input: {
  nombreFirmante: string;
  nombreDocumento: string;
  codigo: string;
  urlVerificacion: string;
}): { subject: string; text: string; html: string } {
  const subject = `Ya está firmado: ${input.nombreDocumento}`;
  const html = MARCO(
    'El documento quedó firmado por todas las partes',
    `<p style="margin:0 0 10px;font-size:14.5px;line-height:1.6;color:#635a80;">Estimado/a ${input.nombreFirmante}:</p>
     <p style="margin:0 0 10px;font-size:14.5px;line-height:1.6;color:#635a80;">
       Ya suscribieron todas las partes <strong style="color:#1a1330;">${input.nombreDocumento}</strong>.
       Lo adjuntamos en PDF, con la constancia electrónica al final.
     </p>
     <p style="margin:0 0 4px;font-size:13px;color:#635a80;">Identificador:</p>
     <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#1a1330;letter-spacing:0.08em;">${input.codigo}</p>
     <p style="margin:0;font-size:13px;line-height:1.6;color:#635a80;">
       Cualquiera puede comprobar su existencia y su fecha en
       <a href="${input.urlVerificacion}" style="color:#0d9488;">${input.urlVerificacion}</a>.
       Esa página nunca muestra el contenido.
     </p>`,
  );
  const text = [
    `Estimado/a ${input.nombreFirmante}:`,
    '',
    `Ya suscribieron todas las partes "${input.nombreDocumento}". Lo adjuntamos en PDF, con la constancia electrónica al final.`,
    '',
    `Identificador: ${input.codigo}`,
    `Verificación: ${input.urlVerificacion}`,
    '',
    'La página de verificación nunca muestra el contenido.',
  ].join('\n');
  return { subject, text, html };
}

export function correoRechazo(input: {
  nombreAgente: string;
  nombreDocumento: string;
  quienRechazo: string;
  motivo: string;
}): { subject: string; text: string; html: string } {
  const subject = `Rechazado: ${input.nombreDocumento}`;
  const html = MARCO(
    'Una de las partes no aceptó el documento',
    `<p style="margin:0 0 10px;font-size:14.5px;line-height:1.6;color:#635a80;">Hola ${input.nombreAgente}:</p>
     <p style="margin:0 0 10px;font-size:14.5px;line-height:1.6;color:#635a80;">
       <strong style="color:#1a1330;">${input.quienRechazo}</strong> rechazó
       <strong style="color:#1a1330;">${input.nombreDocumento}</strong>. El proceso quedó detenido y
       los enlaces de las demás partes dejaron de estar activos.
     </p>
     <p style="margin:0 0 4px;font-size:13px;color:#635a80;">Motivo indicado:</p>
     <p style="margin:0;padding:12px 14px;background:#f5f3fa;border-radius:8px;font-size:14px;line-height:1.6;color:#1a1330;">${input.motivo}</p>`,
  );
  const text = [
    `Hola ${input.nombreAgente}:`,
    '',
    `${input.quienRechazo} rechazó "${input.nombreDocumento}". El proceso quedó detenido y los enlaces de las demás partes dejaron de estar activos.`,
    '',
    `Motivo: ${input.motivo}`,
  ].join('\n');
  return { subject, text, html };
}

export function correoCancelado(input: { nombreFirmante: string; nombreDocumento: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `Cancelado: ${input.nombreDocumento}`;
  const html = MARCO(
    'Ya no hace falta firmar',
    `<p style="margin:0 0 10px;font-size:14.5px;line-height:1.6;color:#635a80;">Estimado/a ${input.nombreFirmante}:</p>
     <p style="margin:0;font-size:14.5px;line-height:1.6;color:#635a80;">
       Quien le hizo llegar <strong style="color:#1a1330;">${input.nombreDocumento}</strong> canceló el proceso
       de firma. El enlace que recibió ya no está activo y no se requiere ninguna acción de su parte.
     </p>`,
  );
  const text = [
    `Estimado/a ${input.nombreFirmante}:`,
    '',
    `Quien le hizo llegar "${input.nombreDocumento}" canceló el proceso de firma. El enlace ya no está activo y no se requiere ninguna acción de su parte.`,
  ].join('\n');
  return { subject, text, html };
}
