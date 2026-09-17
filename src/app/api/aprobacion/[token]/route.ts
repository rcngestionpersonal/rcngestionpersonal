import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import { describirNavegador, hashToken, ipDeSolicitud } from '@/lib/real-estate/contratos/aprobacion';
import { correoVersionAprobada, correoVersionNoAprobada } from '@/lib/real-estate/contratos/correos';
import {
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
import { CONTRATO_DEFINICION, type ContratoTipo } from '@/lib/real-estate/contratos/tipos';

// API pública de la aprobación de borrador. SIN sesión: la credencial es el
// acceso al correo donde llegó el enlace. El token nunca se guarda en claro,
// así que se busca por su hash.
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

  const resultado = await registrarDecision(parte, parsed.data, {
    ip: ipDeSolicitud(request.headers),
    navegador: describirNavegador(request.headers.get('user-agent')),
  });
  if (!resultado.ok) return NextResponse.json({ error: resultado.error, code: resultado.code }, { status: resultado.status });

  const tipo = parte.contrato.tipo as ContratoTipo;
  const nombreDocumento = CONTRATO_DEFINICION[tipo].nombreDocumento;

  if (isEmailConfigured()) {
    try {
      const perfil = await perfilAgente(parte.contrato.agentId);
      const contrato = await contratoDelAgente(parte.contratoId, parte.contrato.agentId);
      const version = contrato?.versiones.find((v) => v.numero === resultado.numero);
      const doc = version ? congelada(version) : null;

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

      // Aprobada por todas: cada parte y el agente reciben el PDF de esa
      // versión con la constancia como anexo.
      if (resultado.estado === 'APROBADO' && resultado.versionAprobada && contrato && version) {
        const buffer = await pdfDeVersion(contrato, version.numero);
        const partes = contrato.partes.filter((p) => p.versionId === version.id);
        const nombres = partes.map((p) => nombreDeParte(doc, tipo, p));
        const aprobadaPor = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : nombres[0];
        const destinatarios = new Map<string, string>();
        for (const p of partes) destinatarios.set(p.correo, p.nombre);
        if (perfil.correo) destinatarios.set(perfil.correo, perfil.nombre);

        for (const [correoDestino, nombre] of destinatarios) {
          const correo = correoVersionAprobada({
            nombre,
            nombreDocumento,
            numero: version.numero,
            aprobadaPor,
            codigo: contrato.codigoVerificacion,
            urlVerificacion: `${baseUrl()}/c/${contrato.codigoVerificacion}`,
          });
          await sendEmailNotification({
            to: correoDestino,
            ...correo,
            fromName: perfil.nombre,
            ...(buffer
              ? {
                  attachments: [
                    { filename: nombreArchivoContrato(tipo, contrato.codigoVerificacion, { version: version.numero }), content: buffer },
                  ],
                }
              : {}),
          });
        }
      }
    } catch (error) {
      // La decisión ya quedó registrada: un correo que falla no la deshace.
      logContratos('la decisión se registró pero falló el aviso por correo', { contratoId: parte.contratoId, error });
    }
  }

  return NextResponse.json(resultado);
}
