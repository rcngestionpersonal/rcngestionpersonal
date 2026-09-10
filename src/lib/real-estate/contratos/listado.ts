import { CONTRATO_DEFINICION, type ContratoTipo } from './tipos';

// Preparación de las filas del listado para la pantalla del agente.
//
// Vive en su propio archivo, sin Prisma ni Next, por dos razones: se puede
// probar sin base de datos, y deja claro que aquí no se consulta nada. Solo se
// transforma lo que ya se leyó.
//
// LA REGLA: un registro problemático se degrada, nunca tumba la lista. Un
// contrato viejo o mal formado no puede dejar sin módulo a todo el agente, que
// es exactamente lo que pasaba cuando la pantalla resolvía el tipo por su
// cuenta y un valor desconocido lanzaba al pintar la fila.

export type ContratoFila = { id: string; tipo: string; [clave: string]: unknown };

export type FilaListado = Record<string, unknown> & {
  id: string;
  tipo: string;
  tipoEtiqueta: string;
  tipoConocido: boolean;
  ilegible?: boolean;
};

function filaDeContrato(contrato: ContratoFila): FilaListado {
  // El acceso al catálogo se hace AQUÍ y una sola vez, no en la pantalla: si el
  // tipo no existe en este despliegue, la etiqueta cae a un genérico en vez de
  // dejar un `undefined.titulo` esperando a reventar en el render.
  const definicion = CONTRATO_DEFINICION[contrato.tipo as ContratoTipo] as { titulo: string } | undefined;
  return {
    ...contrato,
    id: contrato.id,
    tipo: contrato.tipo,
    tipoEtiqueta: definicion?.titulo ?? 'Documento',
    tipoConocido: Boolean(definicion),
  };
}

// Fila mínima para un registro que ni siquiera se pudo transformar. Tiene todos
// los campos que la pantalla lee, con valores inertes, para que se dibuje
// marcada como ilegible en lugar de desaparecer sin explicación.
function filaDegradada(contrato: Partial<ContratoFila> | null | undefined, indice: number): FilaListado {
  return {
    id: typeof contrato?.id === 'string' ? contrato.id : `desconocido-${indice}`,
    tipo: typeof contrato?.tipo === 'string' ? contrato.tipo : 'CORRETAJE',
    estado: 'BORRADOR',
    listingId: null,
    codigoVerificacion: '—',
    createdAt: new Date(0).toISOString(),
    enviadoAt: null,
    firmadoAt: null,
    anuladoAt: null,
    anuladoNota: null,
    firmantes: [],
    tipoEtiqueta: 'Documento',
    tipoConocido: false,
    ilegible: true,
  };
}

export function filasTolerantes(
  contratos: Array<ContratoFila | null | undefined>,
  alFallar: (contrato: Partial<ContratoFila> | null | undefined, error: unknown) => void,
): FilaListado[] {
  const filas: FilaListado[] = [];
  contratos.forEach((contrato, indice) => {
    try {
      if (!contrato || typeof contrato.id !== 'string') throw new Error('fila sin identificador');
      filas.push(filaDeContrato(contrato));
    } catch (error) {
      alFallar(contrato, error);
      filas.push(filaDegradada(contrato, indice));
    }
  });
  return filas;
}
