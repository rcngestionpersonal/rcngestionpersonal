// QR de la tarjeta del agente en la ficha (seccion 3.6): abre WhatsApp con un
// mensaje precargado sobre ESE inmueble especifico. Mismo formato de QR que
// carnet-image.ts (quiet zone real, oscuro sobre blanco fijo para que
// escanee bien sin importar la paleta de la ficha).
import QRCode from 'qrcode';

function onlyDigits(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

export async function buildFichaWhatsappQrDataUri(phone: string, message: string): Promise<string | null> {
  try {
    const target = `https://wa.me/${onlyDigits(phone)}?text=${encodeURIComponent(message)}`;
    return await QRCode.toDataURL(target, { width: 320, margin: 3, color: { dark: '#04201c', light: '#ffffffff' } });
  } catch {
    return null;
  }
}

export function fichaWhatsappMessage(input: { agentFirstName: string; propertyTypeLabel: string; sectorLine: string; lang: 'es' | 'en' }): string {
  return input.lang === 'es'
    ? `Hola ${input.agentFirstName} 👋 Vi tu ficha de "${input.propertyTypeLabel} en ${input.sectorLine}" en Redinmo.io y me interesa. ¿Me das más información?`
    : `Hi ${input.agentFirstName} 👋 I saw your listing sheet for "${input.propertyTypeLabel} in ${input.sectorLine}" on Redinmo.io and I'm interested. Could you share more details?`;
}
