import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { operationActionLabelEs, propertyTypeLabelEs } from '@/lib/real-estate/labels';
import { resolverEstadoMiniSitio } from '@/lib/real-estate/mini-sitio-server';
import { buildLeadMiniSitioEmail } from '@/lib/real-estate/email-templates';
import { sendEmailNotification } from '@/lib/real-estate/email';
import { getAppUrl } from '@/lib/real-estate/subscription-config';

// Formulario de captacion del mini-sitio (punto 2.4). Ruta PUBLICA: la llena
// un tercero que no tiene cuenta en Redinmo.io.
//
// El lead entra como pedido del agente dueño del sitio y de NADIE MAS (punto
// 9.2) - a diferencia del chat web, aca no se hace matching ni se notifica al
// resto de la red: es su sitio y su contacto.
export const runtime = 'nodejs';

const MAX_POR_IP_POR_HORA = 3;
const MAX_POR_SITIO_POR_HORA = 15;

const leadSchema = z.object({
  nombre: z.string().trim().min(2, 'Dinos tu nombre.').max(120),
  telefono: z.string().trim().min(6, 'Necesitamos un teléfono para contactarte.').max(30),
  propertyType: z.enum(['HOUSE', 'APARTMENT', 'SUITE', 'OFFICE', 'LAND', 'COMMERCIAL', 'WAREHOUSE', 'FARM', 'OTHER']),
  operationType: z.enum(['SALE', 'RENT']),
  zona: z.string().trim().min(2, 'Dinos en qué zona está.').max(120),
  mensaje: z.string().trim().max(600).optional(),
  consentimiento: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar la política de privacidad.' }) }),
  // Honeypot: campo oculto que un humano nunca ve ni llena. Si viene con
  // algo, es un bot. Se prefiere esto a un captcha porque no agrega friccion
  // a la persona real, que es justo la que queremos que complete el formulario.
  //
  // A proposito SIN validacion de longitud: si el schema lo rechazara, la
  // respuesta de error nombraria el campo y le enseñaria al bot exactamente
  // cual omitir la proxima vez. Se valida mas abajo, en silencio.
  website: z.string().optional(),
});

function ipDe(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || 'desconocida';
  return request.headers.get('x-real-ip') ?? 'desconocida';
}

// Se guarda un HASH de la IP, nunca la IP: alcanza para limitar por origen sin
// convertir el formulario en un tratamiento de datos que habria que declarar.
function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(`redinmo-lead:${ip}`).digest('hex').slice(0, 32);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const parsed = leadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Revisa los datos del formulario.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // El honeypot ya lo valida el schema (max 0), pero si llegara con contenido
  // se responde 200 a proposito: un bot que recibe un error reintenta con otra
  // forma; uno que cree haber tenido exito, no.
  if (input.website) return NextResponse.json({ success: true });

  const miniSitio = await prisma.miniSitio.findUnique({
    where: { slug },
    include: {
      agent: {
        select: {
          id: true, fullName: true, email: true, plan: true,
          subscriptionStatus: true, trialEndsAt: true, subscriptionPaidUntil: true,
        },
      },
    },
  });

  // Un sitio apagado o sin feature no recibe leads: si la pagina no se ve,
  // su formulario tampoco debe aceptar envios por API.
  if (!miniSitio || !miniSitio.mostrarFormulario) {
    return NextResponse.json({ error: 'Este formulario no está disponible.' }, { status: 404 });
  }
  if (resolverEstadoMiniSitio(miniSitio.agent, miniSitio) !== 'visible') {
    return NextResponse.json({ error: 'Este formulario no está disponible.' }, { status: 404 });
  }

  const desdeHaceUnaHora = new Date(Date.now() - 60 * 60 * 1000);
  const ipHash = hashIp(ipDe(request));

  const [desdeEstaIp, deEsteSitio] = await Promise.all([
    prisma.opportunity.count({
      where: { origen: 'mini_sitio', createdAt: { gte: desdeHaceUnaHora }, extractedData: { path: ['ipHash'], equals: ipHash } },
    }),
    prisma.opportunity.count({
      where: { origen: 'mini_sitio', createdAt: { gte: desdeHaceUnaHora }, createdByAgentId: miniSitio.agent.id },
    }),
  ]);

  if (desdeEstaIp >= MAX_POR_IP_POR_HORA || deEsteSitio >= MAX_POR_SITIO_POR_HORA) {
    return NextResponse.json(
      { error: 'Recibimos varios envíos seguidos. Intenta de nuevo en un rato.' },
      { status: 429 },
    );
  }

  const resumen = `${input.nombre} quiere ${operationActionLabelEs(input.operationType)} ${propertyTypeLabelEs(input.propertyType)} en ${input.zona}.`;

  try {
    const opportunity = await prisma.opportunity.create({
      data: {
        contactName: input.nombre,
        contactPhone: input.telefono,
        operationType: input.operationType,
        propertyType: input.propertyType,
        city: 'Quito',
        zone: input.zona,
        summary: resumen,
        origen: 'mini_sitio',
        // createdByAgentId es lo que hace que aparezca en SU panel y en el de
        // nadie mas.
        createdByAgentId: miniSitio.agent.id,
        extractedData: {
          source: 'mini_sitio',
          slug,
          mensaje: input.mensaje ?? null,
          ipHash,
          consentimiento: { aceptado: true, en: new Date().toISOString(), politica: '/legal/privacidad' },
        },
      },
    });

    await prisma.eventLog.create({
      data: {
        entityType: 'opportunity',
        entityId: opportunity.id,
        eventType: 'created_from_mini_sitio',
        payload: { slug, agentId: miniSitio.agent.id },
      },
    });

    if (miniSitio.agent.email) {
      const correo = buildLeadMiniSitioEmail({
        agentName: miniSitio.agent.fullName,
        contactName: input.nombre,
        contactPhone: input.telefono,
        resumen,
        mensaje: input.mensaje ?? null,
        appUrl: getAppUrl(),
      });
      void sendEmailNotification({ to: miniSitio.agent.email, subject: correo.subject, text: correo.text });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[mini-sitio] no se pudo registrar el lead', { slug, err });
    return NextResponse.json({ error: 'No pudimos enviar tu mensaje. Intenta de nuevo.' }, { status: 500 });
  }
}
