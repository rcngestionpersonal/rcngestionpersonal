import { NextRequest, NextResponse } from 'next/server';
import {
  agenteConContratos,
  cambiosSinEnviar,
  contratoDelAgente,
  documentoDeTrabajo,
  esContratoDeFirma,
  etiquetaRol,
  huellaDeCondiciones,
  ultimaVersion,
} from '@/lib/real-estate/contratos/servidor';
import { leerEdicion, sinCambios } from '@/lib/real-estate/contratos/clausulas';
import { etapaCompleta, primeraEtapa } from '@/lib/real-estate/contratos/flujo';
import {
  AVISO_EXPORTAR_WORD,
  VIGENCIAS_HORAS,
  camposFaltantes,
  esEditable,
  etiquetasEtapas,
  identidadParte,
  ladoRepresentado,
  ladosDelTipo,
  rolesAdicionales,
  rolesPorEtapa,
  vigenciaPorDefectoHoras,
  type ContratoTipo,
  type Etapa,
} from '@/lib/real-estate/contratos/tipos';

// La copia de trabajo ya armada: las cláusulas para el editor (activas o no,
// con su texto modelo al lado del editado), el documento tal como se leerá y
// qué envío corresponde ahora: a quién le toca revisar.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await agenteConContratos(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const contrato = await contratoDelAgente(id, auth.agentId);
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 });

  const tipo = contrato.tipo as ContratoTipo;
  const trabajo = await documentoDeTrabajo(contrato);
  const visibles = Object.fromEntries(Object.entries(trabajo.datos).filter(([k]) => !k.startsWith('__')));
  const editable = !esContratoDeFirma(contrato) && esEditable(contrato.estado, tipo);
  const cambios = cambiosSinEnviar(contrato, trabajo.preparado.bloques);

  // Quiénes revisan en cada etapa, con las demás personas de cada lado.
  const roles = rolesPorEtapa(tipo, contrato.representa);
  const destinatarios = (etapa: Etapa) =>
    roles[etapa].flatMap((base) =>
      [base, ...rolesAdicionales(tipo, visibles, base)].map((rol) => {
        const identidad = identidadParte(tipo, visibles, rol);
        return {
          rol,
          rolEtiqueta: etiquetaRol(tipo, rol),
          nombre: identidad.aprobador.nombre,
          compania: identidad.juridica ? identidad.nombre : null,
          correo: identidad.correo,
          telefono: identidad.telefono,
          cedulaUlt4: identidad.aprobador.cedula.replace(/\D/g, '').slice(-4),
        };
      }),
    );

  // Qué envío corresponde según la versión vigente.
  const vigente = ultimaVersion(contrato);
  const partesVigentes = vigente ? contrato.partes.filter((p) => p.versionId === vigente.id) : [];
  const mismoLado = !vigente || ladoRepresentado(tipo, vigente.representa)?.clave === ladoRepresentado(tipo, contrato.representa)?.clave;
  const hayCambios = !vigente || !cambios || !sinCambios(cambios) || !mismoLado;
  const principalCompleta = vigente ? etapaCompleta(vigente, partesVigentes, 'PRINCIPAL') : false;
  const rechazo = partesVigentes.find((p) => p.estado === 'RECHAZADO');

  const puedeEnviarContraparte =
    Boolean(vigente) &&
    !hayCambios &&
    vigente!.estado === 'EN_APROBACION' &&
    roles.CONTRAPARTE.length > 0 &&
    principalCompleta &&
    !partesVigentes.some((p) => p.etapa === 'CONTRAPARTE');

  let correccionMenorPosible = false;
  if (vigente && hayCambios && mismoLado && roles.CONTRAPARTE.length > 0 && principalCompleta && vigente.huellaCondiciones) {
    const cerrada = vigente.estado === 'ANULADA' || vigente.estado === 'REEMPLAZADA' || rechazo?.etapa === 'PRINCIPAL';
    correccionMenorPosible = !cerrada && huellaDeCondiciones(contrato, trabajo.datos, trabajo.perfil, vigente.representa) === vigente.huellaCondiciones;
  }

  return NextResponse.json({
    editable,
    admiteEdicion: editable && trabajo.preparado.admiteEdicion,
    nombreDocumento: trabajo.preparado.nombreDocumento,
    ciudad: trabajo.ciudad,
    fechaLarga: trabajo.fechaLarga,
    clausulas: trabajo.preparado.clausulas,
    // La edición tal como está guardada: el editor la modifica y la devuelve
    // entera, sin reconstruirla desde la vista.
    edicion: leerEdicion(trabajo.datos),
    bloques: trabajo.preparado.bloques,
    versionActual: contrato.versionActual,
    cambiosSinEnviar: cambios,
    faltantes: camposFaltantes(tipo, visibles),
    avisoWord: AVISO_EXPORTAR_WORD,
    // Para el agente, en pantalla: el documento no lo imprime.
    avisoSinRevisar: trabajo.preparado.revisadaPorAbogado ? null : trabajo.preparado.avisoSinRevisar,
    envio: {
      representa: ladoRepresentado(tipo, contrato.representa)?.clave ?? null,
      lados: (ladosDelTipo(tipo)?.lados ?? []).map((l) => ({ clave: l.clave, etiqueta: l.etiqueta })),
      etiquetas: etiquetasEtapas(tipo, contrato.representa),
      primera: primeraEtapa(tipo, contrato.representa),
      destinatarios: { PRINCIPAL: destinatarios('PRINCIPAL'), CONTRAPARTE: destinatarios('CONTRAPARTE') },
      vigente: vigente
        ? {
            numero: vigente.numero,
            estado: vigente.estado,
            principalCompleta,
            contraparteEnviada: partesVigentes.some((p) => p.etapa === 'CONTRAPARTE'),
            rechazoEtapa: rechazo?.etapa ?? null,
          }
        : null,
      hayCambios,
      puedeEnviarContraparte,
      correccionMenorPosible,
      vigenciaHoras: contrato.vigenciaHoras ?? vigenciaPorDefectoHoras(tipo),
      vigencias: VIGENCIAS_HORAS,
    },
  });
}
