import type { ContratoTipo } from './tipos';

// PENDIENTES LEGALES: qué texto del módulo está esperando la revisión de un
// abogado, y por qué.
//
// Es una lista INTERNA del equipo. No sale en el PDF, no la ve el cliente y no
// se muestra en la pantalla del agente: lo que el agente necesita saber ya está
// donde toma la decisión (la consecuencia de cada opción, o el aviso de
// plantilla sin revisar). Aquí se anota lo que hay que mandar a revisar y
// cuándo se anotó, para que no se pierda entre versiones.
//
// Cuando un abogado revisa y aprueba un texto, se borra su entrada de aquí (y,
// si era una plantilla entera, se pone PLANTILLA_REVISADA_POR_ABOGADO = true).

export type PendienteLegal = {
  tipo: ContratoTipo;
  // Versión de plantilla donde vive el texto.
  plantilla: string;
  // Cláusula concreta, o null si es la plantilla entera.
  clausula: string | null;
  titulo: string;
  motivo: string;
  // Cuándo se anotó (AAAA-MM-DD).
  desde: string;
};

export const PENDIENTES_REVISION_LEGAL: PendienteLegal[] = [
  {
    tipo: 'CORRETAJE',
    plantilla: 'corretaje-v4-2026-09',
    clausula: 'controversias',
    titulo: 'Ley aplicable y solución de controversias',
    motivo:
      'Cláusula nueva con tres mecanismos (mediación y jueces, arbitraje, solo jueces). Hay que confirmar la redacción de la cláusula arbitral, que renuncia a la jurisdicción ordinaria, y el nombre exacto de cada centro de mediación por ciudad.',
    desde: '2026-09-17',
  },
  {
    tipo: 'CORRETAJE',
    plantilla: 'corretaje-v4-2026-09',
    clausula: 'inmueble',
    titulo: 'El inmueble',
    motivo:
      'La identificación del inmueble pasó a ser el texto libre que escribe el agente, sin linderos. Conviene confirmar que basta para un encargo de venta.',
    desde: '2026-09-17',
  },
  {
    tipo: 'RESERVA_COMPRAVENTA',
    plantilla: 'reserva-compraventa-v4-2026-09',
    clausula: null,
    titulo: 'Reserva de compraventa (plantilla completa)',
    motivo: 'La plantilla nunca fue revisada por un abogado; se muestra con aviso a quien la revisa.',
    desde: '2026-09-16',
  },
  {
    tipo: 'RESERVA_ARRIENDO',
    plantilla: 'reserva-arriendo-v3-2026-09',
    clausula: null,
    titulo: 'Reserva de arrendamiento (plantilla completa)',
    motivo: 'La plantilla nunca fue revisada por un abogado; se muestra con aviso a quien la revisa.',
    desde: '2026-09-16',
  },
];
