import { obtenerPlantilla, type BloqueDocumento, type DatosDocumento } from './plantillas';
import {
  aplicarEdicion,
  clausulasParaEditor,
  documentoFinal,
  edicionVacia,
  leerEdicion,
  textoPlano,
  type BloqueFinal,
  type ClausulaEditable,
  type EstiloNumeracion,
  type LineaFirma,
} from './clausulas';
import {
  CONTRATO_DEFINICION,
  PARTES_POR_TIPO,
  esTipoArchivado,
  identidadAgente,
  identidadParte,
  partesDocumento,
  rolesAdicionales,
  type ContratoTipo,
  type IdentidadParte,
} from './tipos';

export { romano } from './clausulas';

// Ensambla el documento: toma los datos crudos del formulario y produce los
// bloques que la plantilla define. Aca vive la traduccion de "valores de
// formulario" a "texto legible", para que las plantillas se ocupen solo de
// redaccion.

export type DatosAgenteDocumento = {
  licencia: string | null;
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

// Valor numerico de un campo de dinero. Un importe mal escrito vale 0 y no
// rompe el documento: el formulario ya valida que sea un numero.
function aNumero(valor: string): number {
  const numero = Number(String(valor).replace(/[^\d.-]/g, ''));
  return Number.isFinite(numero) ? numero : 0;
}

function formatearImporte(numero: number): string {
  const conMiles = numero.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `USD $${conMiles} (${enLetras(numero)})`;
}

function formatearDinero(valor: string): string {
  const numero = Number(String(valor).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(numero) || numero === 0) return valor || '—';
  return formatearImporte(numero);
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

export type EntradaDocumento = {
  tipo: ContratoTipo;
  version: string;
  datos: Record<string, string>;
  agente: DatosAgenteDocumento;
  inmueble: DatosInmuebleDocumento;
  fecha: Date;
};

function identidadDe(input: EntradaDocumento, rol: string): IdentidadParte {
  const esAgente = PARTES_POR_TIPO[input.tipo]?.find((p) => p.rol === rol)?.esAgente;
  return esAgente
    ? identidadAgente(input.tipo, input.datos, rol, input.agente)
    : identidadParte(input.tipo, input.datos, rol);
}

// Los bloques tal como los escribe la plantilla, antes de las ediciones del
// agente y de numerar.
export function construirDocumento(input: EntradaDocumento): {
  bloques: BloqueDocumento[];
  version: string;
  revisadaPorAbogado: boolean;
  avisoSinRevisar: string;
  estilo: EstiloNumeracion;
  admiteEdicion: boolean;
} {
  const plantilla = obtenerPlantilla(input.tipo, input.version);

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
    numero: (clave) => aNumero(input.datos[clave] ?? ''),
    // A diferencia de dinero(), aca el cero SI es un importe: es el resultado
    // de un calculo, no un campo vacio, y tiene que imprimirse como cifra.
    dineroDe: (valor) => formatearImporte(valor),
    opcion: (clave) => etiquetaDeOpcion(input.tipo, clave, (input.datos[clave] ?? '').trim()),
    lista: (clave) =>
      (input.datos[clave] ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => etiquetaDeOpcion(input.tipo, clave, v)),
    parte: (rol) => identidadDe(input, rol),
    adicionales: (rol) =>
      identidadDe(input, rol).juridica
        ? []
        : rolesAdicionales(input.tipo, input.datos, rol).map((r) => ({
            identidad: identidadParte(input.tipo, input.datos, r),
            estadoCivil: (input.datos[`${r}_estadoCivil`] ?? '').trim(),
          })),
  };

  return {
    bloques: plantilla.construirBloques(input.tipo, contexto),
    version: plantilla.version,
    revisadaPorAbogado: plantilla.revisadaPorAbogado,
    avisoSinRevisar: plantilla.avisoSinRevisar,
    estilo: plantilla.estilo,
    admiteEdicion: plantilla.admiteEdicion,
  };
}

// Líneas de firma manuscrita, en el orden en que comparecen las partes, con una
// línea por cada persona de un mismo lado. En una compañía firma su
// representante, por ella.
export function lineasDeFirma(input: EntradaDocumento): LineaFirma[] {
  return partesDocumento(input.tipo, input.datos).map((definicion) => {
    const p = identidadDe(input, definicion.rol);
    const pasaporte = p.tipoDocumento === 'pasaporte';
    return {
      calidad: definicion.etiqueta.toUpperCase(),
      nombre: p.aprobador.nombre || '—',
      documento: p.aprobador.cedula || '—',
      tipoDocumento: pasaporte ? 'Pasaporte' : 'C.I.',
      enRepresentacionDe: p.juridica ? { razonSocial: p.nombre || '—', ruc: p.documento || '—' } : null,
    };
  });
}

export type DocumentoPreparado = {
  bloques: BloqueFinal[];
  // Todas las cláusulas, activas o no, para el editor.
  clausulas: ClausulaEditable[];
  texto: string;
  nombreDocumento: string;
  version: string;
  revisadaPorAbogado: boolean;
  avisoSinRevisar: string;
  admiteEdicion: boolean;
};

// El documento completo, tal como se lee y se imprime: la plantilla con las
// ediciones del agente aplicadas, numerado y con sus líneas de firma. Es lo
// que se congela al enviar cada versión.
//
// "firmas" permite a los contratos del flujo retirado imprimir sus firmantes y
// su leyenda de firma electrónica tal como fueron.
export function prepararDocumento(
  input: EntradaDocumento,
  firmas?: { leyenda: string | null; partes: LineaFirma[] },
): DocumentoPreparado {
  const base = construirDocumento(input);
  // Un tipo archivado nunca aplica ediciones: se reimprime como se generó.
  const edicion = base.admiteEdicion && !esTipoArchivado(input.tipo) ? leerEdicion(input.datos) : edicionVacia();
  const items = aplicarEdicion(base.bloques, edicion);
  const bloques = documentoFinal(items, base.estilo, firmas ?? { leyenda: null, partes: lineasDeFirma(input) });
  return {
    bloques,
    clausulas: clausulasParaEditor(items, base.estilo),
    texto: textoPlano(bloques),
    nombreDocumento: CONTRATO_DEFINICION[input.tipo].nombreDocumento,
    version: base.version,
    revisadaPorAbogado: base.revisadaPorAbogado,
    avisoSinRevisar: base.avisoSinRevisar,
    admiteEdicion: base.admiteEdicion && !esTipoArchivado(input.tipo),
  };
}
