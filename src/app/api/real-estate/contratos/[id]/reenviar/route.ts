import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import {
  agenteConContratos,
  baseUrl,
  contratoDelAgente,
  etiquetaRol,
  perfilAgente,
  referenciaInmueble,
  ultimaVersion,
} from '@/lib/real-estate/contratos/servidor';
import { regenerarEnlace, registrarReenvio } from '@/lib/real-estate/contratos/versiones';
import { descifrarDatos, descifrarToken, fechaLarga } from '@/lib/real-estate/contratos/aprobacion';
import { correoSolicitudAprobacion } from '@/lib/real-estate/contratos/correos';
import { solicitudDe } from '@/lib/real-estate/contratos/eventos';
import { enlaceWhatsApp, mensajeParaCompartir } from '@/lib/real-estate/contratos/flujo';
import { CONTRATO_DEFINICION, VIGENCIAS_HORAS, identidadParte, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';

// Hacer llegar otra vez el enlace de una persona que aún no decidió:
//   regenerar  enlace nuevo con vigencia nueva; el anterior deja de servir.
//              Es lo que se usa con un enlace vencido.
//   correo     el mismo enlace vigente, por correo.
//   whatsapp   deja constancia de que el agente lo compartió por WhatsApp (el
//              mensaje lo abre la pantalla con el enlace que ya tiene).
// Nunca sale nada solo hacia los clientes: todo parte de un clic del agente.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  parteId: z.string().min(1),
  accion: z.enum(['regenerar', 'correo', 'whatsapp']),
  vigenciaHoras: z
    .number()
    .int()
    .refine((h) => (VIGENCIAS_HORAS as readonly number[]).includes(h))
    .optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 });
  const { parteId, accion } = parsed.data;
  const solicitud = solicitudDe(request.headers);
  const tipo = contrato.tipo as ContratoTipo;
  const datos = descifrarDatos(contrato.datosCifrados);

  if (accion === 'regenerar') {
    const r = await regenerarEnlace(contrato, parteId, parsed.data.vigenciaHoras ?? null, solicitud);
    if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.status });
    const url = `${baseUrl()}/aprobar/${r.token}`;
    const referencia = await referenciaInmueble(contrato, datos);
    const mensaje = mensajeParaCompartir({ nombre: r.parte.nombre, tipoDocumento: CONTRATO_DEFINICION[tipo].titulo.toLowerCase(), referencia, enlace: url });
    return NextResponse.json({
      ok: true,
      estado: r.estado,
      expiraAt: r.expiraAt,
      url,
      mensaje,
      whatsapp: enlaceWhatsApp(identidadParte(tipo, datos, r.parte.rol).telefono, mensaje),
    });
  }

  if (accion === 'correo' && !isEmailConfigured()) {
    return NextResponse.json({ error: 'El envío por correo no está configurado.' }, { status: 503 });
  }

  const r = await registrarReenvio(contrato, parteId, accion, solicitud);
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.status });
  if (accion === 'whatsapp') return NextResponse.json({ ok: true });

  const token = descifrarToken(r.parte.tokenCifrado);
  if (!token) {
    return NextResponse.json({ error: 'Este enlace es anterior al envío por WhatsApp: regenéralo para enviarlo.', code: 'sin_enlace' }, { status: 409 });
  }
  if (!r.parte.correo) return NextResponse.json({ error: 'Esta persona no tiene correo registrado.', code: 'sin_correo' }, { status: 409 });

  const version = ultimaVersion(contrato);
  const perfil = await perfilAgente(auth.agentId);
  const mensaje = correoSolicitudAprobacion({
    nombreParte: r.parte.nombre,
    nombreDocumento: CONTRATO_DEFINICION[tipo].nombreDocumento,
    numero: version?.numero ?? contrato.versionActual,
    agente: { nombre: perfil.nombre, empresa: perfil.empresa },
    url: `${baseUrl()}/aprobar/${token}`,
    venceEl: fechaLarga(r.parte.expiraAt),
    cambios: null,
  });
  const envio = await sendEmailNotification({
    to: r.parte.correo,
    ...mensaje,
    fromName: perfil.nombre,
    ...(perfil.correo ? { replyTo: perfil.correo } : {}),
  });
  if (!envio.delivered) {
    return NextResponse.json({ error: envio.error ?? `No se pudo enviar el correo a ${etiquetaRol(tipo, r.parte.rol).toLowerCase()}.` }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
