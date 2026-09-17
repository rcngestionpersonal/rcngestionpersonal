import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import {
  agenteConContratos,
  baseUrl,
  contratoDelAgente,
  esContratoDeFirma,
  logContratos,
  perfilAgente,
  referenciaInmueble,
} from '@/lib/real-estate/contratos/servidor';
import { enviar } from '@/lib/real-estate/contratos/versiones';
import { correoCorreccionMenor, correoSolicitudAprobacion } from '@/lib/real-estate/contratos/correos';
import { descifrarDatos, fechaLarga } from '@/lib/real-estate/contratos/aprobacion';
import { solicitudDe } from '@/lib/real-estate/contratos/eventos';
import { enlaceWhatsApp, mensajeParaCompartir } from '@/lib/real-estate/contratos/flujo';
import { CONTRATO_DEFINICION, VIGENCIAS_HORAS, vigenciaPorDefectoHoras, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';

// Envío de una versión. Por defecto, y siempre primero, a la parte principal
// (el cliente del agente). A la contraparte solo cuando la principal ya aprobó
// y el agente lo decide. El envío simultáneo existe como opción avanzada.
//
// El enlace de cada persona vuelve en la respuesta para compartirlo por
// WhatsApp; el correo es opcional y solo sale si el agente lo pide.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  destino: z.enum(['PRINCIPAL', 'CONTRAPARTE']),
  simultaneo: z.boolean().default(false),
  correccionMenor: z.boolean().default(false),
  porCorreo: z.boolean().default(false),
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
  if (esContratoDeFirma(contrato)) {
    return NextResponse.json(
      { error: 'Este contrato es de la etapa de firma electrónica y ya no admite envíos.', code: 'firma_retirada' },
      { status: 409 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Opciones de envío no válidas.' }, { status: 400 });
  const opciones = parsed.data;
  const tipo = contrato.tipo as ContratoTipo;

  const perfil = await perfilAgente(auth.agentId);
  const resultado = await enviar(
    contrato,
    perfil,
    {
      destino: opciones.destino,
      simultaneo: opciones.simultaneo,
      correccionMenor: opciones.correccionMenor,
      vigenciaHoras: opciones.vigenciaHoras ?? contrato.vigenciaHoras ?? vigenciaPorDefectoHoras(tipo),
    },
    solicitudDe(request.headers),
  );
  if (!resultado.ok) {
    return NextResponse.json(
      { error: resultado.error, code: resultado.code, ...(resultado.faltantes ? { faltantes: resultado.faltantes } : {}) },
      { status: resultado.status },
    );
  }

  const referencia = await referenciaInmueble(contrato, descifrarDatos(contrato.datosCifrados));
  const tipoDocumento = CONTRATO_DEFINICION[tipo].titulo.toLowerCase();
  const enlaces = resultado.enlaces.map((e) => {
    const url = `${baseUrl()}/aprobar/${e.token}`;
    const mensaje = mensajeParaCompartir({ nombre: e.nombre, tipoDocumento, referencia, enlace: url });
    return {
      parteId: e.parteId,
      nombre: e.nombre,
      rolEtiqueta: e.rolEtiqueta,
      etapa: e.etapa,
      correo: e.correo,
      url,
      mensaje,
      whatsapp: enlaceWhatsApp(e.telefono, mensaje),
      expiraAt: e.expiraAt,
    };
  });

  const correo = { enviados: 0, fallidos: [] as string[], sinConfigurar: false };
  const puedeCorreo = isEmailConfigured();
  if (opciones.porCorreo && !puedeCorreo) correo.sinConfigurar = true;

  if (opciones.porCorreo && puedeCorreo) {
    for (const e of resultado.enlaces) {
      if (!e.correo) continue;
      const mensaje = correoSolicitudAprobacion({
        nombreParte: e.nombre,
        nombreDocumento: resultado.nombreDocumento,
        numero: resultado.numero,
        agente: { nombre: perfil.nombre, empresa: perfil.empresa },
        url: `${baseUrl()}/aprobar/${e.token}`,
        venceEl: fechaLarga(e.expiraAt),
        cambios: resultado.cambios,
      });
      const envio = await sendEmailNotification({
        to: e.correo,
        ...mensaje,
        fromName: perfil.nombre,
        // Quien envía es el agente: la respuesta le llega a él.
        ...(perfil.correo ? { replyTo: perfil.correo } : {}),
      });
      if (envio.delivered) correo.enviados += 1;
      else {
        correo.fallidos.push(e.correo);
        logContratos(`no se pudo enviar por correo la versión ${resultado.numero}`, { agentId: auth.agentId, contratoId: id, error: envio.error });
      }
    }
  }

  // Corrección menor: la parte principal se entera de qué se corrigió. El
  // correo sale solo si tiene correo; el agente además puede avisarle por
  // WhatsApp con el mensaje que devuelve esta respuesta.
  let correccion = null;
  if (resultado.correccion) {
    const aviso = `Hola, te cuento que corregí datos de la otra parte en el borrador de ${tipoDocumento} del inmueble ${referencia} (${resultado.correccion.campos.join('; ') || 'datos de identificación'}). Las condiciones que aprobaste no cambiaron.`;
    if (puedeCorreo) {
      for (const p of resultado.correccion.avisar) {
        if (!p.correo) continue;
        const mensaje = correoCorreccionMenor({
          nombreParte: p.nombre,
          nombreDocumento: resultado.nombreDocumento,
          base: resultado.correccion.base,
          numero: resultado.numero,
          campos: resultado.correccion.campos,
          agente: { nombre: perfil.nombre, empresa: perfil.empresa },
        });
        await sendEmailNotification({ to: p.correo, ...mensaje, fromName: perfil.nombre, ...(perfil.correo ? { replyTo: perfil.correo } : {}) }).catch(
          (error) => logContratos('no se pudo avisar la corrección menor por correo', { agentId: auth.agentId, contratoId: id, error }),
        );
      }
    }
    correccion = {
      campos: resultado.correccion.campos,
      base: resultado.correccion.base,
      avisar: resultado.correccion.avisar.map((p) => ({
        nombre: p.nombre,
        whatsapp: enlaceWhatsApp(p.telefono, aviso.replace(/^Hola,/, `Hola ${p.nombre.split(/\s+/)[0]},`)),
      })),
    };
  }

  return NextResponse.json({ ok: true, numero: resultado.numero, etapa: resultado.etapa, simultaneo: resultado.simultaneo, enlaces, correo, correccion });
}
