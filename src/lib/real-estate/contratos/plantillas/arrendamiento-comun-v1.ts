// ===========================================================================
// PIEZAS COMUNES DE LOS ARRENDAMIENTOS — v1-2026-09
//
// Las usan las tres plantillas v1 (residencial, comercial e industrial) y
// quedan CONGELADAS con ellas: el texto de las cláusulas opcionales forma parte
// de esos documentos. Si mañana cambia una redacción, se publica una pieza v2
// junto con las plantillas que la usen; esta no se edita.
// ===========================================================================

import { NOTA_CLAUSULA_DISCUTIBLE } from '../tipos';
import { comparecenciaParte, opcional, type BloqueDocumento, type DatosDocumento } from './base';

export type Denominaciones = { arrendador: string; arrendatario: string };

// Valor de un campo, o el marcador visible si falta.
export function v(d: DatosDocumento, clave: string): string {
  return opcional(d.campo(clave));
}

// Párrafos subnumerados con el número de la propia cláusula: 3.1., 3.2.… Los
// que no aplican se omiten y los siguientes suben: nunca queda un hueco.
export function subnumerar(parrafos: Array<string | false | null | undefined>): string {
  return parrafos
    .filter((p): p is string => Boolean(p))
    .map((p, i) => `{{n}}.${i + 1}. ${p}`)
    .join('\n');
}

// Una enumeración con literales, cada uno en su línea, con "y" antes del
// último. Los que no aplican se omiten y las letras se corren.
export function literales(introduccion: string, items: Array<string | false | null | undefined>, cierre = ''): string {
  const vigentes = items.filter((i): i is string => Boolean(i));
  const lineas = vigentes.map((item, i) => {
    const letra = String.fromCharCode(97 + i);
    const fin = i === vigentes.length - 1 ? '.' : i === vigentes.length - 2 ? '; y' : ';';
    return `${letra}) ${item}${fin}`;
  });
  return [introduccion, ...lineas, cierre].filter(Boolean).join('\n');
}

export function comparecencia(d: DatosDocumento, den: Denominaciones): BloqueDocumento[] {
  return [
    { tipo: 'subtitulo', texto: 'COMPARECIENTES' },
    {
      tipo: 'parrafo',
      texto: `Comparecen a la celebración del presente contrato de arrendamiento, por una parte, ${comparecenciaParte(
        d,
        'arrendador',
        den.arrendador,
      )}; y, por otra, ${comparecenciaParte(
        d,
        'arrendatario',
        den.arrendatario,
      )}. Los comparecientes son legalmente capaces para contratar y obligarse, y libre y voluntariamente convienen en celebrar el presente contrato al tenor de las siguientes cláusulas:`,
    },
  ];
}

const DISCUTIBLE = { activaPorDefecto: false, nota: NOTA_CLAUSULA_DISCUTIBLE };

// Las cuatro renuncias de uso frecuente cuya validez puede discutirse cuando
// recaen sobre normas de orden público. Existen en el modelo, pero apagadas:
// solo el agente las activa, y con la nota a la vista.
export function renunciaCanon(den: Denominaciones): BloqueDocumento {
  return {
    tipo: 'clausula',
    clave: 'renuncia-canon',
    titulo: 'DECLARACIÓN Y RENUNCIA SOBRE EL CANON',
    opcional: DISCUTIBLE,
    texto: `${den.arrendatario} declara que el canon fue acordado libremente entre las partes, sin considerar los valores que puedan fijar las entidades competentes en materia de inquilinato, y renuncia a cualquier reclamación administrativa o judicial orientada a su revisión o modificación con base en dichos valores.`,
  };
}

export function renunciaDesahucio(): BloqueDocumento {
  return {
    tipo: 'clausula',
    clave: 'renuncia-desahucio',
    titulo: 'TERMINACIÓN SIN DESAHUCIO',
    opcional: DISCUTIBLE,
    texto:
      'El presente contrato terminará de pleno derecho al vencimiento del plazo pactado, sin necesidad de desahucio, notificación ni requerimiento judicial o extrajudicial alguno, a lo que las partes renuncian expresamente.',
  };
}

export function desalojo(d: DatosDocumento, den: Denominaciones): BloqueDocumento {
  return {
    tipo: 'clausula',
    clave: 'desalojo',
    titulo: 'RESTITUCIÓN Y RETIRO DE BIENES',
    opcional: DISCUTIBLE,
    texto: `Terminado el contrato por cualquier causa, si ${den.arrendatario} no restituyere el inmueble dentro de los ${v(
      d,
      'desalojoDias',
    )} días siguientes, faculta a ${den.arrendador} para retirar los bienes que se encuentren en él, y renuncia a cualquier acción civil o penal por este hecho.`,
  };
}

export function tituloEjecutivo(): BloqueDocumento {
  return {
    tipo: 'clausula',
    clave: 'titulo-ejecutivo',
    titulo: 'TÍTULO EJECUTIVO',
    opcional: DISCUTIBLE,
    texto:
      'Para el cobro de las obligaciones económicas derivadas de este contrato, las partes le atribuyen la calidad de título ejecutivo, bastando su sola presentación, y renuncian al reconocimiento de firmas, a la declaratoria de mora y a toda diligencia previa.',
  };
}

// Solución de controversias: mediación y, sin acuerdo, jueces o arbitraje.
export function controversiasTexto(d: DatosDocumento, arbitros: 'UNO' | 'TRES' = 'UNO'): string {
  const ciudad = d.campo('ciudadJurisdiccion') || d.ciudad;
  if (d.campo('viaControversias') === 'ARBITRAJE') {
    return `De no lograrse un acuerdo directo, las partes se someterán a arbitraje en derecho administrado por el Centro de Arbitraje y Mediación de la Cámara de Comercio de ${ciudad}, con ${
      arbitros === 'TRES' ? 'tres árbitros' : 'un árbitro'
    } designado${arbitros === 'TRES' ? 's' : ''} conforme a su reglamento. El tribunal podrá ejecutar medidas cautelares solicitando el auxilio de funcionarios públicos, judiciales, policiales y administrativos, sin que sea necesario recurrir a juez ordinario alguno. El arbitraje tendrá lugar en las instalaciones del centro.`;
  }
  return `De no lograrse un acuerdo directo, las partes acudirán a mediación en un centro legalmente autorizado de ${ciudad} y, agotada la mediación sin acuerdo, se someterán a los jueces competentes de ${ciudad} y al procedimiento que corresponda según la ley.`;
}
