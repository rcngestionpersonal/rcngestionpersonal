import QRCode from 'qrcode';

// Genera la imagen del Carnet de Agente via canvas (formato historia,
// 1080x1920), con el carnet centrado sobre fondo oscuro y un glow teal sutil.
// IMPORTANTE - privacidad: este tipo de entrada NO tiene (ni puede tener) un
// campo de total de agentes de la Red - es estructuralmente imposible que la
// imagen exportada filtre "de N", solo "#N en la Red" (a diferencia de la
// tarjeta en pantalla, que tampoco lo muestra, pero aqui es un requisito
// explicito del pedido original).
export type CarnetImageInput = {
  displayName: string;
  photoUrl?: string | null;
  levelLabel: string;
  levelColor: string;
  verified: boolean;
  audience: 'colegas' | 'clientes';
  rank: number;
  totalPoints: number;
  cierres: number;
  joinYear: number;
  listingsActive: number;
  zones: string[];
  phone: string;
  whatsappMessage: string;
  subscriptionActive: boolean;
  vigenteLabel: string;
  carnetSlug?: string | null;
  yearsExperience?: number | null;
  licenseNumber?: string | null;
  lang: 'es' | 'en';
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Si la foto no carga (CORS, red, etc.) resolvemos null y el carnet cae con
// gracia al fallback de iniciales - nunca debe romper la exportacion.
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string): string {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

const FONT = '"Plus Jakarta Sans", sans-serif';

export async function generateCarnetImage(input: CarnetImageInput): Promise<Blob> {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no soportado.');

  const centerX = width / 2;
  const cardX = 90;
  const cardW = width - cardX * 2;
  const cardY = 230;
  const cardH = 1460;

  // Fondo + glow teal centrado en el carnet
  ctx.fillStyle = '#0b0d14';
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(centerX, cardY + cardH / 2, 80, centerX, cardY + cardH / 2, 800);
  glow.addColorStop(0, 'rgba(45,212,191,0.14)');
  glow.addColorStop(1, 'rgba(45,212,191,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Caja del carnet
  const cardBg = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  cardBg.addColorStop(0, '#131a22');
  cardBg.addColorStop(0.45, '#10141f');
  cardBg.addColorStop(1, '#141225');
  ctx.fillStyle = cardBg;
  roundRect(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.fill();
  ctx.strokeStyle = 'rgba(45,212,191,0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.stroke();

  // Anillos decorativos, recortados al borde del carnet
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.clip();
  ctx.strokeStyle = 'rgba(45,212,191,0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cardX + cardW - 30, cardY + 30, 190, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cardX + cardW - 10, cardY + 10, 120, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  let y = cardY + 80;

  // Header
  const headerLabel = input.lang === 'es' ? 'CARNET DE AGENTE' : 'AGENT CARD';
  const brandText = '✦ REDINMO';
  ctx.font = `800 22px ${FONT}`;
  const brandWidth = ctx.measureText(brandText).width;
  const restWidth = ctx.measureText(` · ${headerLabel}`).width;
  let hx = centerX - (brandWidth + restWidth) / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2dd4bf';
  ctx.fillText(brandText, hx, y);
  hx += brandWidth;
  ctx.fillStyle = '#62667f';
  ctx.fillText(` · ${headerLabel}`, hx, y);

  y += 90;

  // Foto de perfil (o iniciales sobre gradiente)
  const photoRadius = 100;
  const photoCenterY = y + photoRadius;
  const img = input.photoUrl ? await loadImage(input.photoUrl) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, photoCenterY, photoRadius, 0, Math.PI * 2);
  ctx.closePath();
  if (img) {
    ctx.clip();
    ctx.drawImage(img, centerX - photoRadius, photoCenterY - photoRadius, photoRadius * 2, photoRadius * 2);
  } else {
    const avatarBg = ctx.createLinearGradient(centerX - photoRadius, photoCenterY - photoRadius, centerX + photoRadius, photoCenterY + photoRadius);
    avatarBg.addColorStop(0, '#26304a');
    avatarBg.addColorStop(1, '#1a2033');
    ctx.fillStyle = avatarBg;
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(centerX, photoCenterY, photoRadius, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#2dd4bf';
  ctx.stroke();

  if (!img) {
    ctx.font = `800 64px ${FONT}`;
    ctx.fillStyle = '#f0f1f7';
    ctx.textAlign = 'center';
    ctx.fillText(initialsOf(input.displayName), centerX, photoCenterY + 22);
  }

  y = photoCenterY + photoRadius + 70;

  // Nombre
  ctx.textAlign = 'center';
  const nameFont = `800 52px ${FONT}`;
  ctx.font = nameFont;
  ctx.fillStyle = '#f0f1f7';
  ctx.fillText(fitText(ctx, input.displayName, cardW - 100, nameFont), centerX, y);
  y += 66;

  // Chips: verificado (si aplica) + nivel
  type Chip = { label: string; bg: string; border: string; color: string };
  const chips: Chip[] = [];
  if (input.verified) {
    chips.push({
      label: `✓ ${input.lang === 'es' ? 'Verificado' : 'Verified'}`,
      bg: 'rgba(45,212,191,0.12)',
      border: 'rgba(45,212,191,0.35)',
      color: '#2dd4bf',
    });
  }
  chips.push({ label: `● ${input.levelLabel}`, bg: 'rgba(167,139,250,0.13)', border: 'rgba(167,139,250,0.42)', color: input.levelColor });

  const chipFont = `700 24px ${FONT}`;
  ctx.font = chipFont;
  const chipWidths = chips.map((c) => ctx.measureText(c.label).width + 44);
  const chipsGap = 16;
  const chipsTotalWidth = chipWidths.reduce((a, b) => a + b, 0) + chipsGap * (chips.length - 1);
  let cx = centerX - chipsTotalWidth / 2;
  const chipY = y;
  const chipH = 48;
  chips.forEach((chip, i) => {
    const w = chipWidths[i];
    ctx.fillStyle = chip.bg;
    roundRect(ctx, cx, chipY, w, chipH, chipH / 2);
    ctx.fill();
    ctx.strokeStyle = chip.border;
    ctx.lineWidth = 1.5;
    roundRect(ctx, cx, chipY, w, chipH, chipH / 2);
    ctx.stroke();
    ctx.fillStyle = chip.color;
    ctx.textAlign = 'left';
    ctx.font = chipFont;
    ctx.fillText(chip.label, cx + 22, chipY + 32);
    cx += w + chipsGap;
  });
  ctx.textAlign = 'center';
  y += chipH + 42;

  // Zonas de especializacion
  if (input.zones.length > 0) {
    const zonesFont = `600 26px ${FONT}`;
    ctx.font = zonesFont;
    ctx.fillStyle = '#9296b0';
    ctx.fillText(fitText(ctx, input.zones.join(' · '), cardW - 100, zonesFont), centerX, y);
    y += 66;
  } else {
    y += 16;
  }

  // Chips de confianza: anos de experiencia + licencia profesional (Parte
  // "algo que interese a la comunidad" del carnet) - solo si el agente los cargo.
  const trustChips: string[] = [];
  if (input.yearsExperience) trustChips.push(`${input.yearsExperience}+ ${input.lang === 'es' ? 'años de experiencia' : 'years of experience'}`);
  if (input.licenseNumber) trustChips.push(`${input.lang === 'es' ? 'Lic.' : 'Lic.'} ${input.licenseNumber}`);
  if (trustChips.length > 0) {
    const tFont = `700 22px ${FONT}`;
    ctx.font = tFont;
    const tWidths = trustChips.map((c) => ctx.measureText(c).width + 36);
    const tGap = 12;
    const tTotal = tWidths.reduce((a, b) => a + b, 0) + tGap * (trustChips.length - 1);
    let tx = centerX - tTotal / 2;
    const tH = 42;
    trustChips.forEach((label, i) => {
      const w = tWidths[i];
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      roundRect(ctx, tx, y, w, tH, tH / 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, tx, y, w, tH, tH / 2);
      ctx.stroke();
      ctx.fillStyle = '#f0f1f7';
      ctx.textAlign = 'left';
      ctx.font = tFont;
      ctx.fillText(label, tx + 18, y + 28);
      tx += w + tGap;
    });
    ctx.textAlign = 'center';
    y += tH + 30;
  }

  // Estadisticas: version Colegas muestra posicion/cierres/puntos, version
  // Clientes NUNCA muestra puntos/posicion (jerga interna) - cierres/antiguedad/
  // inmuebles activos en su lugar.
  const statGap = 16;
  const statBoxW = (cardW - 80 - statGap * 2) / 3;
  const statBoxH = 150;
  const statX0 = cardX + 40;
  const stats =
    input.audience === 'colegas'
      ? [
          { value: `#${input.rank}`, label: input.lang === 'es' ? 'EN LA RED' : 'IN THE NETWORK' },
          { value: String(input.cierres), label: input.lang === 'es' ? 'CIERRES' : 'CLOSINGS' },
          { value: String(input.totalPoints), label: input.lang === 'es' ? 'PUNTOS' : 'POINTS' },
        ]
      : [
          { value: String(input.cierres), label: input.lang === 'es' ? 'CIERRES' : 'CLOSINGS' },
          { value: String(input.joinYear), label: input.lang === 'es' ? 'EN REDINMO' : 'ON REDINMO' },
          { value: String(input.listingsActive), label: input.lang === 'es' ? 'INMUEBLES ACTIVOS' : 'ACTIVE LISTINGS' },
        ];

  stats.forEach((s, i) => {
    const sx = statX0 + i * (statBoxW + statGap);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    roundRect(ctx, sx, y, statBoxW, statBoxH, 20);
    ctx.fill();
    const valueFont = `800 40px ${FONT}`;
    ctx.font = valueFont;
    ctx.fillStyle = '#3ee8d2';
    ctx.fillText(fitText(ctx, s.value, statBoxW - 24, valueFont), sx + statBoxW / 2, y + 70);
    ctx.font = `700 17px ${FONT}`;
    ctx.fillStyle = '#62667f';
    ctx.fillText(s.label, sx + statBoxW / 2, y + 108);
  });
  y += statBoxH + 56;

  // Vigencia
  ctx.font = `700 24px ${FONT}`;
  ctx.fillStyle = input.subscriptionActive ? '#2dd4bf' : '#62667f';
  const vigenciaText = input.subscriptionActive
    ? `● ${input.lang === 'es' ? 'Vigente' : 'Active'} · ${input.vigenteLabel}`
    : input.lang === 'es'
      ? 'No vigente'
      : 'Not active';
  ctx.fillText(vigenciaText, centerX, y);
  y += 64;

  // Bloque de contacto
  ctx.textAlign = 'left';
  const boxX = cardX + 40;
  const boxW = cardW - 80;
  const contactH = 140;
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2;
  roundRect(ctx, boxX, y, boxW, contactH, 18);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `600 26px ${FONT}`;
  ctx.fillStyle = '#2dd4bf';
  ctx.fillText('✆', boxX + 24, y + 54);
  ctx.fillStyle = '#9296b0';
  ctx.fillText(input.phone, boxX + 56, y + 54);
  const cityLine = `Quito, Ecuador${input.zones.length > 0 ? ` · ${input.zones.slice(0, 2).join(', ')}` : ''}`;
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText(fitText(ctx, cityLine, boxW - 48, `500 24px ${FONT}`), boxX + 24, y + 96);
  y += contactH + 40;

  // Bloque QR: abre WhatsApp con el mensaje del agente (o el default), listo
  // para escanear a resolucion util.
  const qrBoxH = 210;
  ctx.fillStyle = 'rgba(45,212,191,0.12)';
  roundRect(ctx, boxX, y, boxW, qrBoxH, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(45,212,191,0.35)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, boxX, y, boxW, qrBoxH, 18);
  ctx.stroke();

  // QR con quiet zone real (margin:3, no 1) para que sobreviva la
  // recompresion de WhatsApp/redes sin volverse illegible, y un gap explicito
  // de 28px antes del texto - antes el texto arrancaba pegado al borde del QR.
  const qrPad = 22;
  const qrSize = qrBoxH - qrPad * 2;
  const qrTextGap = 28;
  const qrTextX = boxX + qrPad + qrSize + qrTextGap;
  const qrTextMaxWidth = boxW - (qrPad + qrSize + qrTextGap) - qrPad;

  try {
    const qrTarget = `https://wa.me/${input.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(input.whatsappMessage)}`;
    const qrDataUrl = await QRCode.toDataURL(qrTarget, { width: 320, margin: 3, color: { dark: '#04201c', light: '#ffffffff' } });
    const qrImg = await loadImage(qrDataUrl);
    if (qrImg) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, boxX + qrPad, y + qrPad, qrSize, qrSize, 12);
      ctx.fill();
      ctx.drawImage(qrImg, boxX + qrPad, y + qrPad, qrSize, qrSize);
      ctx.restore();
    }
  } catch {
    // El QR es secundario a la exportacion (el mensaje ya vive en el propio
    // texto); si falla, seguimos sin bloquear la imagen.
  }

  ctx.font = `700 26px ${FONT}`;
  ctx.fillStyle = '#f0f1f7';
  ctx.fillText(
    fitText(ctx, input.lang === 'es' ? 'Escanéame y hablemos por WhatsApp' : "Scan me, let's talk on WhatsApp", qrTextMaxWidth, `700 26px ${FONT}`),
    qrTextX,
    y + 90,
  );
  ctx.font = `500 21px ${FONT}`;
  ctx.fillStyle = '#9296b0';
  ctx.fillText(
    fitText(
      ctx,
      input.lang === 'es' ? 'Abre un chat directo conmigo con un mensaje listo.' : 'Opens a direct chat with me, message ready to send.',
      qrTextMaxWidth,
      `500 21px ${FONT}`,
    ),
    qrTextX,
    y + 124,
  );
  y += qrBoxH + 44;

  // Microtexto de verificacion + pie de marca
  ctx.textAlign = 'center';
  if (input.carnetSlug) {
    ctx.font = `500 20px ${FONT}`;
    ctx.fillStyle = '#62667f';
    const verifyText = `${input.lang === 'es' ? 'Verifica este carnet en' : 'Verify this card at'} redinmo.io/v/${input.carnetSlug}`;
    ctx.fillText(fitText(ctx, verifyText, cardW - 100, `500 20px ${FONT}`), centerX, y);
    y += 44;
  }

  ctx.font = `700 20px ${FONT}`;
  ctx.fillStyle = '#2dd4bf';
  const footerBrand = 'redinmo.io';
  const footerTagline = ` · ${input.lang === 'es' ? 'EL HUB QUE CONECTA COLEGAS' : 'THE HUB THAT CONNECTS COLLEAGUES'}`;
  const footerBrandWidth = ctx.measureText(footerBrand).width;
  ctx.font = `600 20px ${FONT}`;
  const footerTaglineWidth = ctx.measureText(footerTagline).width;
  let fx = centerX - (footerBrandWidth + footerTaglineWidth) / 2;
  ctx.textAlign = 'left';
  ctx.font = `700 20px ${FONT}`;
  ctx.fillStyle = '#2dd4bf';
  ctx.fillText(footerBrand, fx, y);
  fx += footerBrandWidth;
  ctx.font = `600 20px ${FONT}`;
  ctx.fillStyle = '#62667f';
  ctx.fillText(footerTagline, fx, y);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('No se pudo generar la imagen.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

export type CarnetPrintInput = {
  displayName: string;
  photoUrl?: string | null;
  levelLabel: string;
  levelColor: string;
  verified: boolean;
  yearsExperience?: number | null;
  licenseNumber?: string | null;
  company?: string | null;
  zones: string[];
  phone: string;
  carnetSlug?: string | null;
  lang: 'es' | 'en';
};

// Version "credencial fisica" del carnet: formato tarjeta CR80 (proporcion
// real de una tarjeta de identificacion, 85.6x54mm) renderizada a 600 DPI
// (2020x1274px) para que se pueda imprimir y plastificar sin pixelarse -
// a diferencia de la version "historia" (1080x1920, pensada para pantalla/
// compartir), esta es horizontal y muestra solo los datos que tienen sentido
// en una credencial fisica (sin puntos/posicion, que cambian todos los dias).
// El QR apunta a la verificacion publica (redinmo.io/v/slug), no a WhatsApp:
// el objetivo de esta version es que cualquiera pueda confirmar que el
// agente es real y esta verificado, no iniciar un chat.
export async function generateCarnetPrintImage(input: CarnetPrintInput): Promise<Blob> {
  const width = 2020;
  const height = 1274;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no soportado.');

  // Fondo: degradado oscuro de marca + franja de acento superior.
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#131a22');
  bg.addColorStop(0.5, '#10141f');
  bg.addColorStop(1, '#161029');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const accent = ctx.createLinearGradient(0, 0, width, 0);
  accent.addColorStop(0, '#b7a5ff');
  accent.addColorStop(1, '#2dd4bf');
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, 14);

  ctx.save();
  ctx.beginPath();
  ctx.arc(width - 60, 60, 260, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(45,212,191,0.16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(width - 60, 60, 240, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const padX = 90;
  const photoR = 150;
  const photoCX = padX + photoR;
  const photoCY = height / 2 - 30;

  // Foto / iniciales
  const img = input.photoUrl ? await loadImage(input.photoUrl) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(photoCX, photoCY, photoR, 0, Math.PI * 2);
  ctx.closePath();
  if (img) {
    ctx.clip();
    ctx.drawImage(img, photoCX - photoR, photoCY - photoR, photoR * 2, photoR * 2);
  } else {
    const avatarBg = ctx.createLinearGradient(photoCX - photoR, photoCY - photoR, photoCX + photoR, photoCY + photoR);
    avatarBg.addColorStop(0, '#26304a');
    avatarBg.addColorStop(1, '#1a2033');
    ctx.fillStyle = avatarBg;
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(photoCX, photoCY, photoR, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#2dd4bf';
  ctx.stroke();
  if (!img) {
    ctx.font = `800 92px ${FONT}`;
    ctx.fillStyle = '#f0f1f7';
    ctx.textAlign = 'center';
    ctx.fillText(initialsOf(input.displayName), photoCX, photoCY + 32);
  }

  ctx.textAlign = 'center';
  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = input.verified ? '#2dd4bf' : '#736c96';
  ctx.fillText(input.verified ? (input.lang === 'es' ? '✓ VERIFICADO' : '✓ VERIFIED') : (input.lang === 'es' ? 'NO VERIFICADO' : 'NOT VERIFIED'), photoCX, photoCY + photoR + 60);

  // Columna derecha: marca, nombre, credenciales, contacto y QR de verificacion.
  const colX = padX + photoR * 2 + 80;
  const colW = width - colX - padX;
  let y = 150;

  ctx.textAlign = 'left';
  ctx.font = `800 34px ${FONT}`;
  ctx.fillStyle = '#2dd4bf';
  ctx.fillText('✦ REDINMO.IO', colX, y);
  ctx.font = `600 28px ${FONT}`;
  ctx.fillStyle = '#62667f';
  ctx.fillText(input.lang === 'es' ? '  ·  CARNET DE AGENTE INMOBILIARIO' : '  ·  REAL ESTATE AGENT CARD', colX + 260, y);

  y += 76;
  const nameFont = `800 68px ${FONT}`;
  ctx.font = nameFont;
  ctx.fillStyle = '#f0f1f7';
  ctx.fillText(fitText(ctx, input.displayName, colW, nameFont), colX, y);

  y += 50;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = input.levelColor;
  ctx.fillText(`● ${input.levelLabel}${input.company ? `   ·   ${input.company}` : ''}`, colX, y);

  y += 60;
  // Chips de credenciales: experiencia + licencia + zonas
  const chipParts: string[] = [];
  if (input.yearsExperience) chipParts.push(`${input.yearsExperience}+ ${input.lang === 'es' ? 'años de experiencia' : 'years of experience'}`);
  if (input.licenseNumber) chipParts.push(`${input.lang === 'es' ? 'Licencia' : 'License'} ${input.licenseNumber}`);
  const chipFont = `700 27px ${FONT}`;
  ctx.font = chipFont;
  let chipX = colX;
  for (const label of chipParts) {
    const w = ctx.measureText(label).width + 40;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, chipX, y, w, 52, 26);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, chipX, y, w, 52, 26);
    ctx.stroke();
    ctx.fillStyle = '#f0f1f7';
    ctx.font = chipFont;
    ctx.fillText(label, chipX + 20, y + 34);
    chipX += w + 14;
  }
  y += 90;

  if (input.zones.length > 0) {
    ctx.font = `600 28px ${FONT}`;
    ctx.fillStyle = '#9296b0';
    const zonesFont = `600 28px ${FONT}`;
    ctx.fillText(fitText(ctx, `${input.lang === 'es' ? 'Zonas' : 'Areas'}: ${input.zones.join(' · ')}`, colW - 260, zonesFont), colX, y);
  }
  ctx.font = `600 28px ${FONT}`;
  ctx.fillStyle = '#9296b0';
  ctx.fillText(`✆ ${input.phone}`, colX, y + 46);

  // QR de verificacion publica, esquina inferior derecha
  if (input.carnetSlug) {
    const qrBox = 190;
    const qrX = width - padX - qrBox;
    const qrY = height - 110 - qrBox;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, qrX, qrY, qrBox, qrBox, 16);
    ctx.fill();
    try {
      const verifyUrl = `https://redinmo.io/v/${input.carnetSlug}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 320, margin: 2, color: { dark: '#120c22', light: '#ffffffff' } });
      const qrImg = await loadImage(qrDataUrl);
      if (qrImg) {
        const inset = 14;
        ctx.drawImage(qrImg, qrX + inset, qrY + inset, qrBox - inset * 2, qrBox - inset * 2);
      }
    } catch {
      // El QR es un plus de verificacion; si falla, la credencial se sigue exportando.
    }
    ctx.font = `600 20px ${FONT}`;
    ctx.fillStyle = '#62667f';
    ctx.textAlign = 'center';
    ctx.fillText(input.lang === 'es' ? 'Verificar' : 'Verify', qrX + qrBox / 2, qrY + qrBox + 34);
  }

  // Pie: marca + fecha de emision
  ctx.textAlign = 'left';
  ctx.font = `600 22px ${FONT}`;
  ctx.fillStyle = '#736c96';
  const issued = new Date().toLocaleDateString(input.lang === 'es' ? 'es-EC' : 'en-US', { month: 'long', year: 'numeric' });
  ctx.fillText(`redinmo.io  ·  ${input.lang === 'es' ? 'emitido' : 'issued'} ${issued}`, colX, height - 60);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('No se pudo generar la credencial.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}
