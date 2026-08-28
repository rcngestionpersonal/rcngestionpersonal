import QRCode from 'qrcode';

// Genera la imagen del Carnet de Agente via canvas (formato historia,
// 1080x1920), con el carnet centrado sobre fondo y un glow sutil. Sigue el
// tema activo del agente (Fase 7-bis, seccion 1.3): claro por defecto,
// oscuro si el agente tiene el tema oscuro seleccionado - ver STORY_PALETTES
// mas abajo, que espejea los tokens vigentes de globals.css (un canvas no
// puede leer variables CSS, asi que se hardcodean aqui).
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
  theme: 'light' | 'dark';
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

// Paletas del carnet "historia" (compartir), una por tema - espejean los
// tokens de src/app/globals.css al momento de esta fase. Mantener en sync si
// los tokens cambian: no hay forma de que el canvas los lea en vivo.
type StoryPalette = {
  pageBg: string;
  glow: string;
  cardGradFrom: string;
  cardGradTo: string;
  cardBorder: string;
  ringColor: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  verifiedChipBg: string;
  verifiedChipBorder: string;
  levelChipBg: string;
  levelChipBorder: string;
  trustChipBg: string;
  trustChipBorder: string;
  statBoxBg: string;
  contactBoxBorder: string;
  contactBoxBg: string;
  qrBoxBg: string;
  qrBoxBorder: string;
  avatarFallbackFrom: string;
  avatarFallbackTo: string;
};

const STORY_PALETTES: Record<'light' | 'dark', StoryPalette> = {
  dark: {
    pageBg: '#0f0b1c',
    glow: 'rgba(45,212,191,0.14)',
    cardGradFrom: '#171130',
    cardGradTo: '#1e1740',
    cardBorder: 'rgba(45,212,191,0.32)',
    ringColor: 'rgba(45,212,191,0.2)',
    accent: '#2dd4bf',
    textPrimary: '#f3f1fa',
    textSecondary: '#a9a1cd',
    textTertiary: '#736c96',
    verifiedChipBg: 'rgba(45,212,191,0.1)',
    verifiedChipBorder: 'rgba(45,212,191,0.32)',
    levelChipBg: 'rgba(167,139,250,0.13)',
    levelChipBorder: 'rgba(167,139,250,0.34)',
    trustChipBg: 'rgba(255,255,255,0.05)',
    trustChipBorder: 'rgba(255,255,255,0.14)',
    statBoxBg: 'rgba(255,255,255,0.03)',
    contactBoxBorder: 'rgba(255,255,255,0.1)',
    contactBoxBg: 'rgba(255,255,255,0.02)',
    qrBoxBg: 'rgba(45,212,191,0.1)',
    qrBoxBorder: 'rgba(45,212,191,0.32)',
    avatarFallbackFrom: '#26304a',
    avatarFallbackTo: '#1a2033',
  },
  light: {
    pageBg: '#f4f2fa',
    glow: 'rgba(13,148,136,0.1)',
    cardGradFrom: '#ffffff',
    cardGradTo: '#f4f2fa',
    cardBorder: '#d5cdea',
    ringColor: 'rgba(13,148,136,0.18)',
    accent: '#0d9488',
    textPrimary: '#1a1330',
    textSecondary: '#635a80',
    textTertiary: '#8b83a6',
    verifiedChipBg: '#e0f5f2',
    verifiedChipBorder: '#8fd8d0',
    levelChipBg: '#efeaff',
    levelChipBorder: '#c9b8ff',
    trustChipBg: '#f4f2fa',
    trustChipBorder: '#e6e1f2',
    statBoxBg: '#f4f2fa',
    contactBoxBorder: '#d5cdea',
    contactBoxBg: '#faf9fd',
    qrBoxBg: '#e0f5f2',
    qrBoxBorder: '#8fd8d0',
    avatarFallbackFrom: '#efeaff',
    avatarFallbackTo: '#e0f5f2',
  },
};

export async function generateCarnetImage(input: CarnetImageInput): Promise<Blob> {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no soportado.');

  const P = STORY_PALETTES[input.theme] ?? STORY_PALETTES.light;

  const centerX = width / 2;
  const cardX = 90;
  const cardW = width - cardX * 2;
  const cardY = 230;
  const cardH = 1460;

  // Fondo + glow centrado en el carnet
  ctx.fillStyle = P.pageBg;
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(centerX, cardY + cardH / 2, 80, centerX, cardY + cardH / 2, 800);
  glow.addColorStop(0, P.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Caja del carnet
  const cardBg = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  cardBg.addColorStop(0, P.cardGradFrom);
  cardBg.addColorStop(1, P.cardGradTo);
  ctx.fillStyle = cardBg;
  roundRect(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.fill();
  ctx.strokeStyle = P.cardBorder;
  ctx.lineWidth = 2;
  roundRect(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.stroke();

  // Anillos decorativos, recortados al borde del carnet
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.clip();
  ctx.strokeStyle = P.ringColor;
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
  ctx.fillStyle = P.accent;
  ctx.fillText(brandText, hx, y);
  hx += brandWidth;
  ctx.fillStyle = P.textTertiary;
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
    avatarBg.addColorStop(0, P.avatarFallbackFrom);
    avatarBg.addColorStop(1, P.avatarFallbackTo);
    ctx.fillStyle = avatarBg;
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(centerX, photoCenterY, photoRadius, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = P.accent;
  ctx.stroke();

  if (!img) {
    ctx.font = `800 64px ${FONT}`;
    ctx.fillStyle = P.textPrimary;
    ctx.textAlign = 'center';
    ctx.fillText(initialsOf(input.displayName), centerX, photoCenterY + 22);
  }

  y = photoCenterY + photoRadius + 70;

  // Nombre
  ctx.textAlign = 'center';
  const nameFont = `800 52px ${FONT}`;
  ctx.font = nameFont;
  ctx.fillStyle = P.textPrimary;
  ctx.fillText(fitText(ctx, input.displayName, cardW - 100, nameFont), centerX, y);
  y += 66;

  // Chips: verificado (si aplica) + nivel
  type Chip = { label: string; bg: string; border: string; color: string };
  const chips: Chip[] = [];
  if (input.verified) {
    chips.push({
      label: `✓ ${input.lang === 'es' ? 'Verificado' : 'Verified'}`,
      bg: P.verifiedChipBg,
      border: P.verifiedChipBorder,
      color: P.accent,
    });
  }
  chips.push({ label: `● ${input.levelLabel}`, bg: P.levelChipBg, border: P.levelChipBorder, color: input.levelColor });

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
    ctx.fillStyle = P.textSecondary;
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
      ctx.fillStyle = P.trustChipBg;
      roundRect(ctx, tx, y, w, tH, tH / 2);
      ctx.fill();
      ctx.strokeStyle = P.trustChipBorder;
      ctx.lineWidth = 1.5;
      roundRect(ctx, tx, y, w, tH, tH / 2);
      ctx.stroke();
      ctx.fillStyle = P.textPrimary;
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
    ctx.fillStyle = P.statBoxBg;
    roundRect(ctx, sx, y, statBoxW, statBoxH, 20);
    ctx.fill();
    const valueFont = `800 40px ${FONT}`;
    ctx.font = valueFont;
    ctx.fillStyle = P.accent;
    ctx.fillText(fitText(ctx, s.value, statBoxW - 24, valueFont), sx + statBoxW / 2, y + 70);
    ctx.font = `700 17px ${FONT}`;
    ctx.fillStyle = P.textTertiary;
    ctx.fillText(s.label, sx + statBoxW / 2, y + 108);
  });
  y += statBoxH + 56;

  // Vigencia
  ctx.font = `700 24px ${FONT}`;
  ctx.fillStyle = input.subscriptionActive ? P.accent : P.textTertiary;
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
  ctx.fillStyle = P.contactBoxBg;
  roundRect(ctx, boxX, y, boxW, contactH, 18);
  ctx.fill();
  ctx.strokeStyle = P.contactBoxBorder;
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2;
  roundRect(ctx, boxX, y, boxW, contactH, 18);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `600 26px ${FONT}`;
  ctx.fillStyle = P.accent;
  ctx.fillText('✆', boxX + 24, y + 54);
  ctx.fillStyle = P.textSecondary;
  ctx.fillText(input.phone, boxX + 56, y + 54);
  const cityLine = `Quito, Ecuador${input.zones.length > 0 ? ` · ${input.zones.slice(0, 2).join(', ')}` : ''}`;
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText(fitText(ctx, cityLine, boxW - 48, `500 24px ${FONT}`), boxX + 24, y + 96);
  y += contactH + 40;

  // Bloque QR: abre WhatsApp con el mensaje del agente (o el default), listo
  // para escanear a resolucion util.
  const qrBoxH = 210;
  ctx.fillStyle = P.qrBoxBg;
  roundRect(ctx, boxX, y, boxW, qrBoxH, 18);
  ctx.fill();
  ctx.strokeStyle = P.qrBoxBorder;
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
    // El QR en si SIEMPRE se dibuja oscuro-sobre-blanco (nunca sigue el tema):
    // necesita ese contraste fijo para escanear bien.
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
  ctx.fillStyle = P.textPrimary;
  ctx.fillText(
    fitText(ctx, input.lang === 'es' ? 'Escanéame y hablemos por WhatsApp' : "Scan me, let's talk on WhatsApp", qrTextMaxWidth, `700 26px ${FONT}`),
    qrTextX,
    y + 90,
  );
  ctx.font = `500 21px ${FONT}`;
  ctx.fillStyle = P.textSecondary;
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
    ctx.fillStyle = P.textTertiary;
    const verifyText = `${input.lang === 'es' ? 'Verifica este carnet en' : 'Verify this card at'} redinmo.io/v/${input.carnetSlug}`;
    ctx.fillText(fitText(ctx, verifyText, cardW - 100, `500 20px ${FONT}`), centerX, y);
    y += 44;
  }

  ctx.font = `700 20px ${FONT}`;
  ctx.fillStyle = P.accent;
  const footerBrand = 'redinmo.io';
  const footerTagline = ` · ${input.lang === 'es' ? 'EL HUB QUE CONECTA COLEGAS' : 'THE HUB THAT CONNECTS COLLEAGUES'}`;
  const footerBrandWidth = ctx.measureText(footerBrand).width;
  ctx.font = `600 20px ${FONT}`;
  const footerTaglineWidth = ctx.measureText(footerTagline).width;
  let fx = centerX - (footerBrandWidth + footerTaglineWidth) / 2;
  ctx.textAlign = 'left';
  ctx.font = `700 20px ${FONT}`;
  ctx.fillStyle = P.accent;
  ctx.fillText(footerBrand, fx, y);
  fx += footerBrandWidth;
  ctx.font = `600 20px ${FONT}`;
  ctx.fillStyle = P.textTertiary;
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
  specialty?: 'SALE' | 'RENT' | 'BOTH';
  yearsExperience?: number | null;
  licenseNumber?: string | null;
  company?: string | null;
  zones: string[];
  phone: string;
  email?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  carnetSlug?: string | null;
  lang: 'es' | 'en';
};

function specialtyLabel(specialty: 'SALE' | 'RENT' | 'BOTH' | undefined, lang: 'es' | 'en'): string {
  if (specialty === 'SALE') return lang === 'es' ? 'Venta' : 'Sale';
  if (specialty === 'RENT') return lang === 'es' ? 'Alquiler' : 'Rent';
  if (specialty === 'BOTH') return lang === 'es' ? 'Venta y Alquiler' : 'Sale & Rent';
  return '';
}

// Paleta fija para la version impresa: SIEMPRE clara, sin importar el tema
// activo en pantalla ni la preferencia del agente (Fase 7, seccion 2.1) -
// fondo blanco y texto oscuro para minimizar el consumo de tinta al
// imprimir. Corresponde a los tokens de [data-theme='light'] en globals.css,
// pero hardcodeados: un canvas no puede leer variables CSS y esta version
// nunca debe cambiar con el tema de la app.
const PRINT_BG = '#ffffff';
const PRINT_TEXT = '#1a1330';
const PRINT_TEXT_2 = '#635a80';
const PRINT_TEXT_3 = '#8b83a6';
const PRINT_ACCENT = '#0d9488';
const PRINT_LEVEL_COLOR = '#6d28d9';
const PRINT_LINE = '#e6e1f2';
const PRINT_CHIP_BG = '#f4f2fa';

// Version "credencial fisica" del carnet: formato tarjeta de presentacion
// (85x55mm, la proporcion mas cercana que permite legibilidad - practicamente
// CR80) renderizada a 600 DPI (2020x1274px) para que se pueda imprimir y
// recortar sin pixelarse. Layout en 3 zonas horizontales (Fase 7-bis, seccion
// 1.1): superior (marca + verificacion), central (foto/nombre/nivel/
// especialidad - el bloque protagonista, centrado en el area disponible) e
// inferior (contacto, licencia, QR) - a diferencia del layout anterior, que
// apretujaba todo el texto arriba y dejaba el centro de la tarjeta vacio.
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

  const padX = 90;

  // Fondo blanco (tinta economica) + franja de acento superior - unico uso de
  // color solido "fuerte" de toda la credencial (se mantiene sin cambios).
  ctx.fillStyle = PRINT_BG;
  ctx.fillRect(0, 0, width, height);

  const accent = ctx.createLinearGradient(0, 0, width, 0);
  accent.addColorStop(0, '#7c5cff');
  accent.addColorStop(1, '#0fb5a3');
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, 14);

  // Marca de agua: isotipo ✦ centrado, SIN que ninguna punta se corte (Fase
  // 7-bis, seccion 1.2). Se mide el glyph a un tamano de referencia con su
  // caja de colision REAL (actualBoundingBox*, no solo el ancho de avance -
  // ese era el bug: un glyph puede rendear mas alto que ancho segun la
  // fuente, y medir solo el ancho dejaba las puntas superior/inferior
  // saliendose del canvas) y se escala para que su lado mas largo mida como
  // maximo 40% de la dimension MENOR de la tarjeta (la altura, aqui). Se
  // pinta antes que cualquier otro contenido para quedar siempre detras.
  ctx.save();
  const wmProbeSize = 400;
  ctx.font = `800 ${wmProbeSize}px ${FONT}`;
  const wmProbe = ctx.measureText('✦');
  const probeW = (wmProbe.actualBoundingBoxLeft ?? 0) + (wmProbe.actualBoundingBoxRight ?? wmProbe.width);
  const probeH = (wmProbe.actualBoundingBoxAscent ?? wmProbeSize * 0.75) + (wmProbe.actualBoundingBoxDescent ?? wmProbeSize * 0.1);
  const probeMax = Math.max(probeW, probeH, 1);
  const wmTargetSize = Math.min(width, height) * 0.4;
  const wmFontSize = Math.round(wmProbeSize * (wmTargetSize / probeMax));
  ctx.font = `800 ${wmFontSize}px ${FONT}`;
  const wmGrad = ctx.createLinearGradient(0, 0, width, height);
  wmGrad.addColorStop(0, 'rgba(109,74,255,0.07)');
  wmGrad.addColorStop(1, 'rgba(13,148,136,0.07)');
  ctx.fillStyle = wmGrad;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', width / 2, height / 2);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(width - 60, 60, 260, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(109,74,255,0.14)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(width - 60, 60, 240, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // --- Zona superior: marca + estado de verificacion ---
  const topBaseline = 78;
  ctx.textAlign = 'left';
  ctx.font = `800 32px ${FONT}`;
  ctx.fillStyle = PRINT_ACCENT;
  ctx.fillText('✦ REDINMO.IO', padX, topBaseline);
  const brandW = ctx.measureText('✦ REDINMO.IO').width;
  ctx.font = `600 26px ${FONT}`;
  ctx.fillStyle = PRINT_TEXT_3;
  ctx.fillText(input.lang === 'es' ? '  ·  CARNET DE AGENTE INMOBILIARIO' : '  ·  REAL ESTATE AGENT CARD', padX + brandW, topBaseline);

  ctx.textAlign = 'right';
  ctx.font = `700 28px ${FONT}`;
  ctx.fillStyle = input.verified ? PRINT_ACCENT : PRINT_TEXT_3;
  ctx.fillText(input.verified ? (input.lang === 'es' ? '✓ VERIFICADO' : '✓ VERIFIED') : (input.lang === 'es' ? 'NO VERIFICADO' : 'NOT VERIFIED'), width - padX, topBaseline);

  const topLineY = 116;
  ctx.strokeStyle = PRINT_LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, topLineY);
  ctx.lineTo(width - padX, topLineY);
  ctx.stroke();

  // --- Zona central: foto + nombre + nivel + especialidad, bloque
  // protagonista centrado en el espacio disponible entre las dos zonas. ---
  const bottomZoneTop = 954;
  const centerZoneTop = topLineY + 34;
  const centerZoneH = bottomZoneTop - centerZoneTop;

  const photoR = 145;
  const gapPhotoName = 40;
  const nameLineH = 64;
  const gapNameLevel = 22;
  const levelLineH = 34;
  const hasSpecialtyOrCompany = Boolean(specialtyLabel(input.specialty, input.lang) || input.company);
  const gapLevelCompany = 18;
  const companyLineH = 30;

  let blockH = photoR * 2 + gapPhotoName + nameLineH + gapNameLevel + levelLineH;
  if (hasSpecialtyOrCompany) blockH += gapLevelCompany + companyLineH;

  let cy = centerZoneTop + Math.max(0, (centerZoneH - blockH) / 2);
  const centerX = width / 2;

  const photoCenterY = cy + photoR;
  const img = input.photoUrl ? await loadImage(input.photoUrl) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, photoCenterY, photoR, 0, Math.PI * 2);
  ctx.closePath();
  if (img) {
    ctx.clip();
    ctx.drawImage(img, centerX - photoR, photoCenterY - photoR, photoR * 2, photoR * 2);
  } else {
    const avatarBg = ctx.createLinearGradient(centerX - photoR, photoCenterY - photoR, centerX + photoR, photoCenterY + photoR);
    avatarBg.addColorStop(0, '#efeaff');
    avatarBg.addColorStop(1, '#e0f5f2');
    ctx.fillStyle = avatarBg;
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(centerX, photoCenterY, photoR, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = PRINT_ACCENT;
  ctx.stroke();
  if (!img) {
    ctx.font = `800 92px ${FONT}`;
    ctx.fillStyle = PRINT_TEXT;
    ctx.textAlign = 'center';
    ctx.fillText(initialsOf(input.displayName), centerX, photoCenterY + 32);
  }

  cy = photoCenterY + photoR + gapPhotoName;
  ctx.textAlign = 'center';
  const nameFont = `800 60px ${FONT}`;
  ctx.font = nameFont;
  ctx.fillStyle = PRINT_TEXT;
  ctx.fillText(fitText(ctx, input.displayName, width * 0.7, nameFont), centerX, cy);

  cy += gapNameLevel + levelLineH * 0.7;
  ctx.font = `700 32px ${FONT}`;
  ctx.fillStyle = PRINT_LEVEL_COLOR;
  ctx.fillText(`● ${input.levelLabel}`, centerX, cy);

  if (hasSpecialtyOrCompany) {
    cy += gapLevelCompany + companyLineH * 0.7;
    const specLabel = specialtyLabel(input.specialty, input.lang);
    const line = [specLabel, input.company].filter(Boolean).join('   ·   ');
    ctx.font = `600 28px ${FONT}`;
    ctx.fillStyle = PRINT_TEXT_2;
    ctx.fillText(fitText(ctx, line, width * 0.7, `600 28px ${FONT}`), centerX, cy);
  }

  // --- Zona inferior: contacto, licencia y QR de verificacion. ---
  ctx.strokeStyle = PRINT_LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, bottomZoneTop);
  ctx.lineTo(width - padX, bottomZoneTop);
  ctx.stroke();

  const qrBox = 180;
  const qrX = width - padX - qrBox;
  const qrY = height - 70 - qrBox;
  const textMaxWidth = qrX - padX - 40;

  ctx.textAlign = 'left';
  let by = bottomZoneTop + 76;

  // Chips de credenciales: experiencia + licencia. La etiqueta de licencia es
  // siempre "Lic. Prof.: [numero]" (Fase 7, seccion 2.3) - si el agente no
  // registro licencia, el chip simplemente no se agrega (nunca "Lic. Prof.: —").
  const chipParts: string[] = [];
  if (input.yearsExperience) chipParts.push(`${input.yearsExperience}+ ${input.lang === 'es' ? 'años de experiencia' : 'years of experience'}`);
  if (input.licenseNumber) chipParts.push(`Lic. Prof.: ${input.licenseNumber}`);
  if (chipParts.length > 0) {
    const chipFont = `700 26px ${FONT}`;
    ctx.font = chipFont;
    let chipX = padX;
    for (const label of chipParts) {
      const w = ctx.measureText(label).width + 38;
      ctx.fillStyle = PRINT_CHIP_BG;
      roundRect(ctx, chipX, by - 36, w, 50, 25);
      ctx.fill();
      ctx.strokeStyle = PRINT_LINE;
      ctx.lineWidth = 1.5;
      roundRect(ctx, chipX, by - 36, w, 50, 25);
      ctx.stroke();
      ctx.fillStyle = PRINT_TEXT;
      ctx.font = chipFont;
      ctx.fillText(label, chipX + 19, by - 3);
      chipX += w + 14;
    }
    by += 58;
  }

  // Lineas de contacto: telefono + correo, direccion profesional (si el
  // agente la cargo), zonas (si tiene) - cada linea se salta si no hay dato,
  // en vez de dejar un hueco o un "—".
  const contactLines: { text: string; font: string; color: string }[] = [];
  const phoneEmail = input.email ? `✆ ${input.phone}    ✉ ${input.email}` : `✆ ${input.phone}`;
  contactLines.push({ text: phoneEmail, font: `600 28px ${FONT}`, color: PRINT_TEXT_2 });
  if (input.direccion) {
    contactLines.push({ text: `${input.direccion}${input.ciudad ? `, ${input.ciudad}` : ''}`, font: `500 25px ${FONT}`, color: PRINT_TEXT_3 });
  }
  if (input.zones.length > 0) {
    contactLines.push({ text: `${input.lang === 'es' ? 'Zonas' : 'Areas'}: ${input.zones.join(' · ')}`, font: `500 25px ${FONT}`, color: PRINT_TEXT_3 });
  }
  for (const line of contactLines) {
    ctx.font = line.font;
    ctx.fillStyle = line.color;
    ctx.fillText(fitText(ctx, line.text, textMaxWidth, line.font), padX, by);
    by += 40;
  }

  // QR de verificacion publica, esquina inferior derecha
  if (input.carnetSlug) {
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
    ctx.fillStyle = PRINT_TEXT_3;
    ctx.textAlign = 'center';
    ctx.fillText(input.lang === 'es' ? 'Verificar' : 'Verify', qrX + qrBox / 2, qrY + qrBox + 34);
  }

  // Pie: marca + fecha de emision
  ctx.textAlign = 'left';
  ctx.font = `600 22px ${FONT}`;
  ctx.fillStyle = PRINT_TEXT_3;
  const issued = new Date().toLocaleDateString(input.lang === 'es' ? 'es-EC' : 'en-US', { month: 'long', year: 'numeric' });
  ctx.fillText(`redinmo.io  ·  ${input.lang === 'es' ? 'emitido' : 'issued'} ${issued}`, padX, height - 40);

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
