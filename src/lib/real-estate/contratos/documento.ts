import { obtenerPlantilla, type BloqueDocumento, type DatosDocumento } from './plantillas';
import { CONTRATO_DEFINICION, type ContratoTipo } from './tipos';

// Ensambla el documento: toma los datos crudos del formulario y produce los
// bloques que la plantilla define. Aca vive la traduccion de "valores de
// formulario" a "texto legible", para que las plantillas se ocupen solo de
// redaccion.

export type DatosAgenteDocumento = {
  nombre: string;
  cedula: string;
  ruc: string | null;
  direccion: string;
  telefono: string;
  correo: string;
  ciudad: string;
};

export type DatosInmuebleDocumento = {
  descripcion: string;
  ubicacion: string;
  caracteristicas: string;
};

function formatearDinero(valor: string): string {
  const numero = Number(String(valor).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(numero) || numero === 0) return valor || '—';
  const conMiles = numero.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `USD $${conMiles} (${enLetras(numero)})`;
}

// Los montos de un contrato se escriben en numero y en letras: es la practica
// habitual y evita discusiones por un digito.
const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte'];
const DECENAS = ['', '', 'veinti', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function menorAMil(n: number): string {
  if (n <= 20) return UNIDADES[n];
  if (n < 30) return n === 20 ? 'veinte' : `veinti${UNIDADES[n - 20]}`;
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`;
  }
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  return resto === 0 ? CENTENAS[c] : `${CENTENAS[c]} ${menorAMil(resto)}`;
}

function enLetras(valor: number): string {
  const entero = Math.floor(Math.abs(valor));
  const centavos = Math.round((Math.abs(valor) - entero) * 100);
  let texto: string;
  if (entero === 0) texto = 'cero';
  else if (entero < 1000) texto = menorAMil(entero);
  else if (entero < 1_000_000) {
    const miles = Math.floor(entero / 1000);
    const resto = entero % 1000;
    const prefijo = miles === 1 ? 'mil' : `${menorAMil(miles)} mil`;
    texto = resto === 0 ? prefijo : `${prefijo} ${menorAMil(resto)}`;
  } else {
    const millones = Math.floor(entero / 1_000_000);
    const resto = entero % 1_000_000;
    const prefijo = millones === 1 ? 'un millón' : `${menorAMil(millones)} millones`;
    texto = resto === 0 ? prefijo : `${prefijo} ${enLetras(resto).replace(/ con .*$/, '')}`;
  }
  return `${texto} dólares con ${String(centavos).padStart(2, '0')}/100`.toUpperCase();
}

function formatearFecha(valor: string): string {
  if (!valor) return '—';
  const fecha = new Date(`${valor}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Etiqueta legible de un valor de opcion: el documento no puede decir
// "PRECIO_VENTA", tiene que decir "el precio final de venta".
function etiquetaDeOpcion(tipo: ContratoTipo, clave: string, valor: string): string {
  for (const seccion of CONTRATO_DEFINICION[tipo].secciones) {
    for (const campo of seccion.campos) {
      if (campo.clave !== clave) continue;
      const encontrada = campo.opciones?.find((o) => o.valor === valor);
      if (encontrada) return encontrada.etiqueta;
    }
  }
  return valor;
}

export function construirDocumento(input: {
  tipo: ContratoTipo;
  version: string;
  datos: Record<string, string>;
  agente: DatosAgenteDocumento;
  inmueble: DatosInmuebleDocumento;
  fecha: Date;
}): { bloques: BloqueDocumento[]; version: string; revisadaPorAbogado: boolean; avisoSinRevisar: string } {
  const plantilla = obtenerPlantilla(input.version);

  const contexto: DatosDocumento = {
    ciudad: input.agente.ciudad || 'Quito',
    fechaLarga: input.fecha.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' }),
    agente: input.agente,
    inmueble: input.inmueble,
    campo: (clave) => {
      const valor = (input.datos[clave] ?? '').trim();
      const definicion = CONTRATO_DEFINICION[input.tipo].secciones
        .flatMap((s) => s.campos)
        .find((c) => c.clave === clave);
      if (definicion?.tipo === 'fecha') return formatearFecha(valor);
      return valor;
    },
    dinero: (clave) => formatearDinero((input.datos[clave] ?? '').trim()),
    opcion: (clave) => etiquetaDeOpcion(input.tipo, clave, (input.datos[clave] ?? '').trim()),
    lista: (clave) =>
      (input.datos[clave] ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => etiquetaDeOpcion(input.tipo, clave, v)),
  };

  return {
    bloques: plantilla.construirBloques(input.tipo, contexto),
    version: plantilla.version,
    revisadaPorAbogado: plantilla.revisadaPorAbogado,
    avisoSinRevisar: plantilla.avisoSinRevisar,
  };
}

// Texto plano del documento completo. Se usa para calcular el hash SHA-256 y
// para la version de texto de los correos.
export function bloquesATextoPlano(bloques: BloqueDocumento[]): string {
  let numero = 0;
  const partes: string[] = [];
  for (const bloque of bloques) {
    if (bloque.tipo === 'titulo' || bloque.tipo === 'subtitulo') partes.push(bloque.texto.toUpperCase());
    else if (bloque.tipo === 'parrafo' || bloque.tipo === 'aviso') partes.push(bloque.texto);
    else if (bloque.tipo === 'clausula') {
      numero += 1;
      partes.push(`${romano(numero)}. ${bloque.titulo}\n${bloque.texto}`);
    }
  }
  return partes.join('\n\n');
}

export function romano(n: number): string {
  const tabla: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let resto = n;
  let salida = '';
  for (const [valor, simbolo] of tabla) {
    while (resto >= valor) {
      salida += simbolo;
      resto -= valor;
    }
  }
  return salida;
}
