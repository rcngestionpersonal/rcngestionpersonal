// Comprobacion de configuracion al ARRANQUE del servidor.
//
// POR QUE EXISTE: el modulo de contratos estuvo caido en produccion sin que
// nada lo dijera. Faltaba ENCRYPTION_KEY, la guarda devolvia 503 y el unico
// sintoma aparecia cuando un agente abria la pestaña. Desde fuera se leia
// igual que una base caida.
//
// Next llama a register() una sola vez, al iniciar el servidor, antes de
// atender la primera peticion. Es el momento correcto para gritar: si falta
// una variable, se sabe al desplegar y no cuando alguien tropieza con ella.
//
// NUNCA se imprime el valor de una variable, solo su nombre y si esta o no.

type Requisito = {
  nombre: string;
  // Que deja de funcionar sin ella. Se dice en el log para que quien lo lea
  // no tenga que ir al codigo a averiguarlo.
  rompe: string;
  // Sin esto la aplicacion entera no deberia levantarse.
  critica: boolean;
};

const REQUISITOS: Requisito[] = [
  { nombre: 'DATABASE_URL', rompe: 'toda la aplicación', critica: true },
  { nombre: 'AUTH_SECRET', rompe: 'el inicio de sesión', critica: true },
  {
    nombre: 'ENCRYPTION_KEY',
    rompe: 'el módulo de contratos y el cifrado de los medios de pago',
    critica: false,
  },
  { nombre: 'RESEND_API_KEY', rompe: 'el envío de correos, incluidos los enlaces de firma', critica: false },
  {
    nombre: 'BLOB_READ_WRITE_TOKEN',
    rompe: 'la subida de fotos de inmuebles y de perfil, y la de logotipos',
    critica: false,
  },
];

export function register(): void {
  // Solo en el runtime de Node: el edge middleware no tiene estas variables ni
  // las necesita, y avisar alli seria ruido en cada arranque.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const faltantes = REQUISITOS.filter((r) => !process.env[r.nombre]);
  const entorno = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'desconocido';

  if (faltantes.length === 0) {
    console.log(`[arranque] configuración completa (${entorno}): ${REQUISITOS.length} variables presentes`);
    return;
  }

  const cuantas =
    faltantes.length === 1 ? 'FALTA 1 variable de entorno' : `FALTAN ${faltantes.length} variables de entorno`;
  console.error(
    `[arranque] ${cuantas} en "${entorno}". Las funciones que dependen de ${
      faltantes.length === 1 ? 'ella' : 'ellas'
    } van a negarse a operar:`,
  );
  for (const r of faltantes) {
    console.error(`[arranque]   ${r.nombre} → sin ella no funciona ${r.rompe}${r.critica ? ' (CRÍTICA)' : ''}`);
  }

  // Aviso especifico, porque es el que ya nos costo caro y porque perder esta
  // clave no es un incidente reversible.
  if (faltantes.some((r) => r.nombre === 'ENCRYPTION_KEY')) {
    console.error(
      '[arranque]   ATENCIÓN: sin ENCRYPTION_KEY el módulo de contratos responde 503 a todo. ' +
        'Si ya existen contratos cifrados, deben descifrarse con LA MISMA clave con la que se crearon: ' +
        'una clave nueva no da error, devuelve documentos en blanco. Ver docs/operacion-claves.md.',
    );
  }

  // Una variable critica ausente no se tolera: es preferible que el despliegue
  // falle a que la aplicacion atienda peticiones a medias.
  const criticas = faltantes.filter((r) => r.critica);
  if (criticas.length > 0) {
    throw new Error(
      `Faltan variables de entorno críticas: ${criticas.map((r) => r.nombre).join(', ')}. Ver docs/operacion-claves.md.`,
    );
  }
}
