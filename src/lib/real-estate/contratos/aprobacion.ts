import crypto from 'crypto';
import { decryptAtRest, encryptAtRest } from '@/lib/real-estate/payments/encryption';
import type { BloqueFinal } from './clausulas';
import { APROBACION_VIGENCIA_DIAS, type ContratoTipo } from './tipos';

// Mecánica de la aprobación de borrador: enlaces personales, identificación de
// quien aprueba, registro de cada decisión y documento congelado de cada
// versión.
//
// El token del enlace se genera con 32 bytes de aleatoriedad criptográfica y
// NUNCA se guarda: en la base vive solo su SHA-256. Si alguien lee la tabla no
// puede aprobar por nadie, porque del hash no se vuelve al token. El token
// existe únicamente en el correo de la parte, y ese buzón es la credencial (sin
// login).

export function generarToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function fechaExpiracion(desde = new Date()): Date {
  return new Date(desde.getTime() + APROBACION_VIGENCIA_DIAS * 24 * 60 * 60 * 1000);
}

// Código público del documento (/c/[codigo]). Corto para poder dictarlo por
// teléfono, pero con suficiente entropía para no adivinarse: 10 caracteres
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

// Comparación en tiempo constante: verificar los últimos 4 dígitos es un
// control de identidad, y compararlos con === deja un canal de temporización
// por el que se podrían adivinar dígito a dígito.
export function coincidenUltimos4(ingresado: string, esperado: string): boolean {
  const a = Buffer.from(ingresado.replace(/\D/g, '').padStart(8, ' '));
  const b = Buffer.from(esperado.replace(/\D/g, '').padStart(8, ' '));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Registro de cada decisión. Se guarda cifrado.
// ---------------------------------------------------------------------------
export type Evidencia = {
  ip: string | null;
  userAgent: string | null;
  // Desplazó el documento hasta el final antes de decidir.
  leyoCompleto: boolean;
  zonaHoraria: string | null;
  // Aprobación de borrador: la versión exacta que tenía a la vista y lo que
  // declaró, literal.
  numeroVersion?: number;
  huella?: string;
  declaracion?: string;
  // Legado: registro del flujo de firma retirado.
  hashDocumento?: string;
  aceptoLectura?: boolean;
  aceptoValorFirma?: boolean;
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

// Los datos del formulario también van cifrados: contienen cédulas y
// direcciones de terceros que nunca aceptaron los términos.
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

// ---------------------------------------------------------------------------
// Documento congelado de una versión
// ---------------------------------------------------------------------------

// Lo que leyeron las partes, entero y ya resuelto: cláusulas numeradas, datos
// de las partes, líneas de firma. Se guarda cifrado y no se recalcula nunca: si
// mañana el agente cambia su perfil o se publica otra plantilla, la versión 2
// sigue diciendo lo que decía cuando se envió.
export type DocumentoCongelado = {
  formato: 1;
  tipo: ContratoTipo;
  numero: number;
  nombreDocumento: string;
  ciudad: string;
  fechaLarga: string;
  plantillaVersion: string;
  avisoSinRevisar: string | null;
  bloques: BloqueFinal[];
};

export function cifrarDocumento(documento: DocumentoCongelado): string {
  return encryptAtRest(JSON.stringify(documento));
}

export function descifrarDocumento(guardado: string): DocumentoCongelado | null {
  try {
    const d = JSON.parse(decryptAtRest(guardado)) as DocumentoCongelado;
    return d && d.formato === 1 && Array.isArray(d.bloques) ? d : null;
  } catch {
    return null;
  }
}

// Huella SHA-256 del texto de una versión. NO es un sello de inviolabilidad:
// identifica el texto, para poder comprobar que el que alguien tiene delante es
// el mismo que se aprobó. Incluye el código del documento para que dos
// contratos distintos con el mismo texto no compartan huella.
export function huellaTexto(codigoVerificacion: string, texto: string): string {
  return crypto.createHash('sha256').update(`${codigoVerificacion}\n${texto}`, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// Datos de la solicitud
// ---------------------------------------------------------------------------

// La IP del cliente detrás del proxy de Vercel.
export function ipDeSolicitud(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip');
}

// Descripción legible del dispositivo, para la constancia. No se guarda el
// user-agent crudo en el PDF porque es ilegible.
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

export function fechaLarga(fecha: Date): string {
  return fecha.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Guayaquil' });
}
