import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import { hashToken } from '@/lib/real-estate/contratos/aprobacion';
import { correoAprobacionPrincipal, correoVersionAprobada, correoVersionNoAprobada } from '@/lib/real-estate/contratos/correos';
import { solicitudDe } from '@/lib/real-estate/contratos/eventos';
import {
  aprobacionesDeVersion,
  baseUrl,
  congelada,
  contratoDelAgente,
  etiquetaRol,
  logContratos,
  nombreArchivoContrato,
  nombreDeParte,
  pdfDeVersion,
  perfilAgente,
} from '@/lib/real-estate/contratos/servidor';
import { parteDeToken, registrarDecision } from '@/lib/real-estate/contratos/versiones';
import { CONTRATO_DEFINICION, etiquetasEtapas, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';

// API pública de la aprobación de borrador. SIN sesión: la credencial es el
// enlace personal. El token se busca por su hash.
//
// Lo que se notifica sale SOLO hacia el agente (su cliente aprobó, alguien
// pidió cambios, la versión quedó aprobada). A los clientes no se les manda
// nada automático: el agente decide cuándo y cómo seguir.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const decisionSchema = z.discriminatedUnion('accion', [
  z.object({
    accion: z.literal('aprobar'),
    ultimos4: z.string().regex(/^\d{4}$/, 'Ingrese los últimos 4 dígitos.'),
    leyoCompleto: z.boolean(),
    declaracion: z.boolean(),
    zonaHoraria: z.string().max(80).optional(),
  }),
  z.object({
    accion: z.literal('rechazar'),
    ultimos4: z.string().regex(/^\d{4}$/, 'Ingrese los últimos 4 dígitos.'),
    motivo: z.string().trim().min(3, 'Indique qué necesita cambiar.').max(1000),
    leyoCompleto: z.boolean(),
    zonaHoraria: z.string().max(80).optional(),
  }),
]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parte = await parteDeToken(hashToken(token));
  if (!parte) return NextResponse.json({ error: 'Enlace no válido.', code: 'invalido' }, { status: 404 });

  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos incompletos.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const resultado = await registrarDecision(parte, parsed.data, solicitudDe(request.headers));
  if (!resultado.ok) return NextResponse.json({ error: resultado.error, code: resultado.code }, { status: resultado.status });

  const tipo = parte.contrato.tipo as ContratoTipo;
  const nombreDocumento = CONTRATO_DEFINICION[tipo].nombreDocumento;

  if (isEmailConfigured()) {
    try {
      const perfil = await perfilAgente(parte.contrato.agentId);
      const contrato = await contratoDelAgente(parte.contratoId, parte.contrato.agentId);
      const version = contrato?.versiones.find((v) => v.numero === resultado.numero);
      const doc = version ? congelada(version) : null;
      const etiquetas = etiquetasEtapas(tipo, version?.representa ?? null);
      // El panel no tiene dirección propia por pestaña: se entra por el inicio.
      const urlPanel = `${baseUrl()}/`;

      if (resultado.estado === 'RECHAZADO' && perfil.correo) {
        const correo = correoVersionNoAprobada({
          nombreAgente: perfil.nombre,
          nombreDocumento,
          numero: resultado.numero,
          quien: `${nombreDeParte(doc, tipo, parte)} (${etiquetaRol(tipo, parte.rol)})`,
          motivo: parsed.data.accion === 'rechazar' ? parsed.data.motivo : '',
        });
        await sendEmailNotification({ to: perfil.correo, ...correo });
      }

      // La parte principal terminó de aprobar y falta la contraparte: le toca
      // al agente decidir cuándo enviársela.
      if (resultado.estado === 'APROBADO' && resultado.contrato === 'APROBADO_PRINCIPAL' && perfil.correo && contrato && version) {
        const principales = contrato.partes.filter((p) => p.versionId === version.id && p.etapa === 'PRINCIPAL');
        const correo = correoAprobacionPrincipal({
          nombreAgente: perfil.nombre,
          nombreDocumento,
          numero: resultado.numero,
          quienes: principales.map((p) => nombreDeParte(doc, tipo, p)).join(' y '),
          contraparte: (etiquetas.CONTRAPARTE ?? 'la contraparte').toLowerCase(),
          urlPanel,
        });
        await sendEmailNotification({ to: perfil.correo, ...correo });
      }

      // Aprobación final: el agente recibe el PDF sin marca de borrador. Las
      // partes lo descargan desde su enlace; el agente decide cuándo enviarlo.
      if (resultado.estado === 'APROBADO' && resultado.final && perfil.correo && contrato && version) {
        const buffer = await pdfDeVersion(contrato, version.numero);
        const nombres = [...new Set(aprobacionesDeVersion(contrato, version).map(({ parte: p }) => nombreDeParte(doc, tipo, p)))];
        const aprobadaPor = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : nombres[0];
        const correo = correoVersionAprobada({
          nombre: perfil.nombre,
          nombreDocumento,
          numero: version.numero,
          aprobadaPor,
          codigo: contrato.codigoVerificacion,
          urlVerificacion: `${baseUrl()}/c/${contrato.codigoVerificacion}`,
        });
        await sendEmailNotification({
          to: perfil.correo,
          ...correo,
          ...(buffer
            ? { attachments: [{ filename: nombreArchivoContrato(tipo, contrato.codigoVerificacion, { version: version.numero }), content: buffer }] }
            : {}),
        });
      }
    } catch (error) {
      // La decisión ya quedó registrada: un correo que falla no la deshace.
      logContratos('la decisión se registró pero falló el aviso por correo', { contratoId: parte.contratoId, error });
    }
  }

  return NextResponse.json(resultado);
}
