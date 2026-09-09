import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isEmailConfigured, sendEmailNotification } from '@/lib/real-estate/email';
import { agenteConContratos, baseUrl, contratoDelAgente } from '@/lib/real-estate/contratos/servidor';
import { cifrarDatos, descifrarDatos, fechaExpiracion, generarToken, ultimos4 } from '@/lib/real-estate/contratos/firma';
import { correoSolicitudFirma } from '@/lib/real-estate/contratos/correos';
import { encryptAtRest } from '@/lib/real-estate/payments/encryption';
import {
  CONTRATO_DEFINICION,
  FIRMANTES_POR_TIPO,
  camposFaltantes,
  correoValido,
  type ContratoTipo,
} from '@/lib/real-estate/contratos/tipos';

// "Enviar para firma" (punto 3.2). Crea un enlace unico por firmante y manda
// un correo independiente a cada uno.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });
  if (contrato.estado !== 'BORRADOR') {
    return NextResponse.json({ error: 'Este contrato ya fue enviado.', code: 'ya_enviado' }, { status: 409 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: 'El envío por correo no está configurado.' }, { status: 503 });
  }

  const tipo = contrato.tipo as ContratoTipo;
  const datos = descifrarDatos(contrato.datosCifrados);
  const visibles = Object.fromEntries(Object.entries(datos).filter(([k]) => !k.startsWith('__')));

  const faltantes = camposFaltantes(tipo, visibles);
  if (faltantes.length > 0) {
    return NextResponse.json({ error: 'Faltan datos obligatorios.', code: 'incompleto', faltantes }, { status: 400 });
  }

  const agente = await prisma.agent.findUnique({
    where: { id: auth.agentId },
    select: { fullName: true, company: true, idNumber: true, email: true },
  });
  if (!agente?.idNumber) {
    return NextResponse.json(
      { error: 'Necesitas tu cédula registrada en el perfil para emitir contratos.', code: 'agente_sin_cedula' },
      { status: 409 },
    );
  }

  // Se arma la lista de firmantes desde la definicion del tipo, no desde lo
  // que mande el cliente: el navegador no decide quien firma un contrato.
  const definidos = FIRMANTES_POR_TIPO[tipo];
  const aCrear: Array<{ rol: string; nombre: string; correo: string; cedula: string }> = [];

  for (const def of definidos) {
    if (def.esAgente) {
      if (!agente.email) {
        return NextResponse.json(
          { error: 'Necesitas un correo confirmado para firmar como agente.', code: 'agente_sin_correo' },
          { status: 409 },
        );
      }
      aCrear.push({ rol: def.rol, nombre: agente.fullName, correo: agente.email, cedula: agente.idNumber });
      continue;
    }
    const nombre = (visibles[`${def.rol}_nombre`] ?? '').trim();
    const correo = (visibles[`${def.rol}_correo`] ?? '').trim();
    const cedula = (visibles[`${def.rol}_cedula`] ?? '').trim();
    if (!nombre || !cedula || !correoValido(correo)) {
      return NextResponse.json(
        { error: `Faltan datos de ${def.etiqueta.toLowerCase()} o el correo no es válido.`, code: 'firmante_incompleto' },
        { status: 400 },
      );
    }
    aCrear.push({ rol: def.rol, nombre, correo, cedula });
  }

  const nombreDocumento = CONTRATO_DEFINICION[tipo].nombreDocumento;
  const expira = fechaExpiracion();
  const ahora = new Date();

  // Los tokens en claro solo viven en memoria el tiempo de mandar los correos.
  const tokens = aCrear.map(() => generarToken());

  await prisma.$transaction([
    prisma.contratoFirmante.createMany({
      data: aCrear.map((f, i) => ({
        contratoId: id,
        rol: f.rol,
        nombre: f.nombre,
        correo: f.correo,
        cedulaCifrada: encryptAtRest(f.cedula),
        cedulaUlt4: ultimos4(f.cedula),
        tokenHash: tokens[i].hash,
        expiraAt: expira,
        enviadoAt: ahora,
      })),
    }),
    prisma.contrato.update({
      where: { id },
      data: {
        estado: 'PENDIENTE_FIRMA',
        enviadoAt: ahora,
        // Se vuelve a cifrar igual: deja el updatedAt fresco sin tocar datos.
        datosCifrados: cifrarDatos(datos),
      },
    }),
  ]);

  const venceEl = expira.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
  const fallidos: string[] = [];

  for (let i = 0; i < aCrear.length; i += 1) {
    const f = aCrear[i];
    const url = `${baseUrl()}/firmar/${tokens[i].token}`;
    const correo = correoSolicitudFirma({
      nombreFirmante: f.nombre,
      nombreDocumento,
      agente: { nombre: agente.fullName, empresa: agente.company },
      url,
      venceEl,
    });
    const resultado = await sendEmailNotification({
      to: f.correo,
      subject: correo.subject,
      text: correo.text,
      html: correo.html,
      // Quien envia es el agente, no Redinmo: la respuesta le llega a el.
      ...(agente.email ? { replyTo: agente.email } : {}),
    });
    if (!resultado.delivered) fallidos.push(f.correo);
  }

  return NextResponse.json({ ok: true, enviados: aCrear.length, fallidos });
}
