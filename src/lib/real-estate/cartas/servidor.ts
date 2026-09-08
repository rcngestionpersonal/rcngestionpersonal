import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { tieneAccesoPorAgenteId } from '@/lib/real-estate/access-server';
import { fetchImageAsDataUri } from '@/lib/real-estate/ficha/photos';
import { urlMiniSitio } from '@/lib/real-estate/mini-sitio';
import type { CartaEncabezado } from './plantilla';
import { normalizarBloques, type CartaBloques } from './tipos';

// Piezas compartidas por las rutas de cartas: la guarda de sesion + feature y
// el armado del encabezado del documento.

export type AgenteAutorizado = { agentId: string };

// Defensa en profundidad (misma regla que la ficha PDF): el cliente ya oculta
// la pestaña detras de RequiereFeature, pero cada ruta vuelve a validar. Nunca
// confiar en que el frontend escondio el boton.
export async function agenteConCartas(
  request: NextRequest,
): Promise<{ error: NextResponse; agentId?: undefined } | { error?: undefined; agentId: string }> {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== 'agent' || !session.agentId) {
    return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };
  }
  if (!(await tieneAccesoPorAgenteId(session.agentId, 'carta_presentacion'))) {
    return {
      error: NextResponse.json(
        { error: 'Las cartas de presentación son una función del plan Pro.', code: 'feature_locked' },
        { status: 403 },
      ),
    };
  }
  return { agentId: session.agentId };
}

// La carta pedida, solo si es del agente de la sesion. Los datos del
// destinatario son de un tercero y solo los ve quien los cargo (punto 7.1).
export async function cartaDelAgente(cartaId: string, agentId: string) {
  const carta = await prisma.carta.findUnique({ where: { id: cartaId } });
  if (!carta || carta.agentId !== agentId) return null;
  return carta;
}

export async function construirEncabezado(agentId: string, imagenTipo: string): Promise<CartaEncabezado | null> {
  const agente = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      fullName: true,
      company: true,
      phone: true,
      email: true,
      photoUrl: true,
      cartaLogoUrl: true,
      direccion: true,
      referenciaDireccion: true,
      ciudad: true,
      provincia: true,
      licenseNumber: true,
      idNumber: true,
      phoneVerifiedAt: true,
      miniSitio: { select: { slug: true, activo: true } },
    },
  });
  if (!agente) return null;

  const fuenteImagen = imagenTipo === 'logo' ? agente.cartaLogoUrl ?? agente.photoUrl : agente.photoUrl ?? agente.cartaLogoUrl;
  const imagenDataUri = fuenteImagen
    ? await fetchImageAsDataUri(fuenteImagen, { maxWidth: 256, quality: 88 }).catch(() => null)
    : null;

  // El QR del pie apunta al mini-sitio y solo si esta publicado: un QR que
  // lleva a "este perfil no está disponible" es peor que no poner QR.
  const slug = agente.miniSitio?.activo ? agente.miniSitio.slug : null;
  const url = slug ? urlMiniSitio(slug) : null;
  let qrDataUri: string | null = null;
  if (url) {
    const QRCode = (await import('qrcode')).default;
    qrDataUri = await QRCode.toDataURL(url, { width: 220, margin: 2, color: { dark: '#14121f', light: '#ffffffff' } }).catch(
      () => null,
    );
  }

  return {
    nombre: agente.fullName,
    empresa: agente.company,
    telefono: agente.phone,
    correo: agente.email,
    direccion: direccionProfesional(agente),
    imagenDataUri,
    verificado: Boolean(agente.idNumber) && Boolean(agente.phoneVerifiedAt),
    licencia: agente.licenseNumber,
    qrDataUri,
    urlMiniSitio: url ? url.replace(/^https?:\/\//, '') : null,
  };
}

function direccionProfesional(agente: {
  direccion: string | null;
  referenciaDireccion: string | null;
  ciudad: string | null;
  provincia: string | null;
}): string | null {
  const partes = [agente.direccion, agente.referenciaDireccion, agente.ciudad, agente.provincia].filter(Boolean);
  return partes.length > 0 ? partes.join(', ') : null;
}

export function bloquesDeCarta(valor: unknown): CartaBloques {
  return normalizarBloques(valor);
}

export function nombreArchivo(destinatario: string, extension: string): string {
  const base =
    destinatario
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'destinatario';
  return `carta-${base}.${extension}`;
}
