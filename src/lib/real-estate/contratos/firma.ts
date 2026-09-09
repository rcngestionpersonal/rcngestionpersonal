import crypto from 'crypto';
import { decryptAtRest, encryptAtRest } from '@/lib/real-estate/payments/encryption';
import { FIRMA_VIGENCIA_DIAS } from './tipos';

// Mecanica de la firma por aceptacion remota.
//
// El token del enlace se genera con 32 bytes de aleatoriedad criptografica y
// NUNCA se guarda: en la base vive solo su SHA-256. Si alguien lee la tabla no
// puede firmar por nadie, porque del hash no se vuelve al token. El token
// existe unicamente en el correo del firmante, y ese buzon es la credencial
// (punto 3.4: sin login).

export function generarToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function fechaExpiracion(desde = new Date()): Date {
  return new Date(desde.getTime() + FIRMA_VIGENCIA_DIAS * 24 * 60 * 60 * 1000);
}

// Codigo publico del documento (/c/[codigo]). Corto para poder dictarlo por
// telefono, pero con suficiente entropia para no adivinarse: 10 caracteres
// base32 son ~50 bits.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I, O, 0, 1
export function generarCodigoVerificacion(): string {
  const bytes = crypto.randomBytes(10);
  let salida = '';
  for (const b of bytes) salida += ALFABETO[b % ALFABETO.length];
  return `${salida.slice(0, 5)}-${salida.slice(5)}`;
}

export function ultimos4(cedula: string): string {
  const digitos = cedula.replace(/\D/g, '');
  return digitos.slice(-4);
}

// Comparacion en tiempo constante: verificar los ultimos 4 digitos es un
// control de identidad, y compararlos con === deja un canal de temporizacion
// por el que se podrian adivinar digito a digito.
export function coincidenUltimos4(ingresado: string, esperado: string): boolean {
  const a = Buffer.from(ingresado.replace(/\D/g, '').padStart(8, ' '));
  const b = Buffer.from(esperado.replace(/\D/g, '').padStart(8, ' '));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Registro probatorio (punto 3.5). Se guarda cifrado (punto 7.4).
// ---------------------------------------------------------------------------
export type Evidencia = {
  ip: string | null;
  userAgent: string | null;
  // El firmante desplazo el documento hasta el final antes de aceptar.
  leyoCompleto: boolean;
  // Hash del texto exacto que tenia a la vista cuando acepto.
  hashDocumento: string;
  aceptoLectura: boolean;
  aceptoValorFirma: boolean;
  zonaHoraria: string | null;
};

export function cifrarEvidencia(evidencia: Evidencia): string {
  return encryptAtRest(JSON.stringify(evidencia));
}

export function descifrarEvidencia(guardada: string | null): Evidencia | null {
  if (!guardada) return null;
  try {
    return JSON.parse(decryptAtRest(guardada)) as Evidencia;
  } catch {
    return null;
  }
}

// Los datos del formulario tambien van cifrados: contienen cedulas y
// direcciones de terceros que nunca aceptaron los terminos (punto 7.1).
export function cifrarDatos(datos: Record<string, string>): string {
  return encryptAtRest(JSON.stringify(datos));
}

export function descifrarDatos(guardados: string): Record<string, string> {
  try {
    return JSON.parse(decryptAtRest(guardados)) as Record<string, string>;
  } catch {
    return {};
  }
}

// La IP del cliente detras del proxy de Vercel.
export function ipDeSolicitud(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip');
}

// Descripcion legible del dispositivo, para la constancia. No se guarda el
// user-agent crudo en el PDF porque es ilegible; si en el registro cifrado.
export function describirNavegador(userAgent: string | null): string {
  if (!userAgent) return '—';
  const navegador = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Safari\//.test(userAgent) && !/Chrome/.test(userAgent)
        ? 'Safari'
        : /Firefox\//.test(userAgent)
          ? 'Firefox'
          : 'Navegador';
  const sistema = /iPhone|iPad|iPod/.test(userAgent)
    ? 'iOS'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Mac OS X/.test(userAgent)
        ? 'macOS'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'sistema no identificado';
  return `${navegador} en ${sistema}`;
}

export function fechaConZona(fecha: Date | null): string | null {
  if (!fecha) return null;
  return `${fecha.toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'America/Guayaquil' })} (GMT-5)`;
}
