// Piezas compartidas por TODAS las versiones de plantilla: los tipos de bloque
// que el generador sabe dibujar y los fragmentos de redaccion que se repiten
// igual en varios documentos (comparecencia, antecedente del inmueble,
// jurisdiccion).
//
// Vive aparte de las versiones a proposito. Una version de plantilla es un
// TEXTO congelado; esto es la maquinaria que lo imprime. Si mañana se publica
// una v3, reusa esta maquinaria sin tocar el texto de la v1 ni de la v2.
//
// REGLA que no se rompe: nada de lo que hay aca puede cambiar la redaccion de
// una version ya publicada. Se agregan helpers nuevos; no se editan los que
// una version publicada esta usando.

// Un bloque del documento. "clausula" numera automaticamente; el resto no.
export type BloqueDocumento =
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'clausula'; titulo: string; texto: string }
  | { tipo: 'aviso'; texto: string }
  // Tabla de dos columnas para la ficha resumen de la negociacion: lo que
  // alguien quiere ver de un vistazo antes de leer las clausulas.
  | { tipo: 'ficha'; titulo: string; filas: Array<{ etiqueta: string; valor: string }> }
  | { tipo: 'firmas' };

// Datos ya resueltos que la plantilla consume. La plantilla NO conoce Prisma
// ni el formulario: recibe strings listos para imprimir.
export type DatosDocumento = {
  ciudad: string;
  fechaLarga: string;
  agente: { nombre: string; cedula: string; ruc: string | null; licencia: string | null; direccion: string; telefono: string; correo: string };
  inmueble: { descripcion: string; ubicacion: string; caracteristicas: string };
  // Los campos del formulario, ya normalizados a texto legible.
  campo: (clave: string) => string;
  dinero: (clave: string) => string;
  // Valor numerico crudo de un campo de dinero, para calcular saldos.
  numero: (clave: string) => number;
  // Formatea un importe ya calculado con el mismo estilo que dinero().
  dineroDe: (valor: number) => string;
  // Etiqueta legible de un campo de opcion.
  opcion: (clave: string) => string;
  lista: (clave: string) => string[];
};

// Las etiquetas de opcion empiezan con articulo ('El comprador'), y al
// insertarlas tras una preposicion sale 'de el comprador'. Se contrae.
export function contraer(preposicion: 'de' | 'a', frase: string): string {
  const texto = frase.trim().toLowerCase();
  if (preposicion === 'de' && texto.startsWith('el ')) return `del ${texto.slice(3)}`;
  if (preposicion === 'a' && texto.startsWith('el ')) return `al ${texto.slice(3)}`;
  return `${preposicion} ${texto}`;
}

export function comparecientes(d: DatosDocumento, partes: Array<{ rol: string; titulo: string }>): BloqueDocumento[] {
  const bloques: BloqueDocumento[] = [{ tipo: 'subtitulo', texto: 'COMPARECIENTES' }];
  for (const p of partes) {
    const nombre = d.campo(`${p.rol}_nombre`);
    const cedula = d.campo(`${p.rol}_cedula`);
    const direccion = d.campo(`${p.rol}_direccion`);
    const estadoCivil = d.campo(`${p.rol}_estadoCivil`);
    const detalle = [
      estadoCivil ? `de estado civil ${estadoCivil}` : null,
      `titular de la cédula/RUC N.º ${cedula}`,
      direccion ? `con domicilio en ${direccion}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    bloques.push({
      tipo: 'parrafo',
      texto: `${p.titulo.toUpperCase()}: ${nombre}, ${detalle}, en adelante "${p.titulo}".`,
    });
  }
  return bloques;
}

// "enAdelante" tiene que coincidir con el nombre que usan las cláusulas de esa
// plantilla; si no, el documento define una parte y luego habla de otra. Por
// defecto es "el Agente", que es lo que dice la v1 y no puede cambiar.
export function agenteCompareciente(
  d: DatosDocumento,
  etiqueta = 'EL AGENTE',
  enAdelante = 'el Agente',
): BloqueDocumento {
  const ruc = d.agente.ruc ? ` y RUC N.º ${d.agente.ruc}` : '';
  return {
    tipo: 'parrafo',
    texto: `${etiqueta}: ${d.agente.nombre}, titular de la cédula N.º ${d.agente.cedula}${ruc}, con oficina en ${d.agente.direccion}, en adelante "${enAdelante}".`,
  };
}

export function inmuebleAntecedente(d: DatosDocumento): BloqueDocumento {
  return {
    tipo: 'parrafo',
    texto: `El inmueble objeto de este contrato es: ${d.inmueble.descripcion}, ubicado en ${d.inmueble.ubicacion}. ${d.inmueble.caracteristicas}`.trim(),
  };
}

export function jurisdiccion(d: DatosDocumento): BloqueDocumento[] {
  return [
    {
      tipo: 'clausula',
      titulo: 'NOTIFICACIONES',
      texto: `Las partes señalan como direcciones para notificaciones las indicadas en la comparecencia y los correos electrónicos consignados en la constancia de firma de este documento. Cualquier cambio deberá comunicarse por escrito.`,
    },
    {
      tipo: 'clausula',
      titulo: 'DOMICILIO Y JURISDICCIÓN',
      texto: `Para todos los efectos de este contrato las partes se someten a la jurisdicción de los jueces competentes de ${d.ciudad}, renunciando a fuero y domicilio distintos, y a los procedimientos previstos en la legislación ecuatoriana.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Fragmentos que estrenan las plantillas basadas en los formatos reales.
// ---------------------------------------------------------------------------

// Descripcion del inmueble tal como la pide el formato de corretaje: ficha
// catastral. Los datos que el agente no cargo simplemente no se imprimen.
export function fichaInmuebleCorretaje(d: DatosDocumento): BloqueDocumento {
  const filas: Array<{ etiqueta: string; valor: string }> = [
    { etiqueta: 'Inmueble', valor: d.inmueble.descripcion },
    { etiqueta: 'Ubicación', valor: d.inmueble.ubicacion },
  ];
  const predio = d.campo('predio');
  const cubierta = d.campo('areaCubierta');
  const abierta = d.campo('areaAbierta');
  const anio = d.campo('anioConstruccion');
  if (predio) filas.push({ etiqueta: 'Predio', valor: predio });
  if (cubierta) filas.push({ etiqueta: 'Área de construcción cubierta', valor: `${cubierta} m²` });
  if (abierta) filas.push({ etiqueta: 'Área de construcción abierta', valor: `${abierta} m²` });
  if (anio) filas.push({ etiqueta: 'Año de construcción', valor: anio });
  if (d.inmueble.caracteristicas) filas.push({ etiqueta: 'Características', valor: d.inmueble.caracteristicas });
  return { tipo: 'ficha', titulo: 'DESCRIPCIÓN DEL INMUEBLE', filas };
}

// Mediacion y arbitraje ante la Camara de Comercio de Quito, como en los dos
// formatos de referencia. Sustituye a jurisdiccion() en esas plantillas: son
// caminos distintos de solucion de controversias y no se acumulan.
export function mediacionYArbitraje(d: DatosDocumento): BloqueDocumento[] {
  return [
    {
      tipo: 'clausula',
      titulo: 'NOTIFICACIONES',
      texto:
        'Las partes señalan como direcciones para notificaciones las indicadas en la comparecencia y los correos electrónicos consignados en la constancia de firma de este documento. Cualquier cambio deberá comunicarse por escrito.',
    },
    {
      tipo: 'clausula',
      titulo: 'JURISDICCIÓN Y COMPETENCIA',
      texto: `En caso de suscitarse divergencias o controversias en la interpretación o ejecución del presente contrato, las partes tratarán de llegar a un acuerdo directo en el plazo de treinta (30) días. De no lograrlo, podrán acudir a la mediación en el Centro de Mediación de la Cámara de Comercio de ${d.ciudad}. De no acordarse una mediación, toda controversia derivada de este contrato se someterá a un Tribunal de Arbitraje integrado por un solo árbitro, que fallará conforme a derecho y se sujetará a la Ley de Arbitraje y Mediación y al Reglamento del Centro de Arbitraje y Mediación de la Cámara de Comercio de ${d.ciudad}, República del Ecuador. Las partes renuncian a la jurisdicción ordinaria, se obligan a acatar el laudo que expida el Tribunal Arbitral y se comprometen a no interponer recurso alguno en su contra. Para la ejecución de medidas cautelares el Tribunal podrá solicitar el auxilio de funcionarios públicos, judiciales, policiales y administrativos, sin que sea necesario acudir a juez ordinario alguno. El lugar del arbitraje serán las instalaciones de dicho Centro.`,
    },
  ];
}

// Proteccion de datos personales, en los terminos del formato de reserva.
export function proteccionDatos(quien: string): BloqueDocumento {
  return {
    tipo: 'clausula',
    titulo: 'PROTECCIÓN DE DATOS PERSONALES',
    texto: `Las partes autorizan el tratamiento de sus datos personales por parte de las demás y ${quien}, con la finalidad exclusiva de ejecutar el presente contrato y perfeccionar la operación, conforme a la Ley Orgánica de Protección de Datos Personales. Los datos no serán cedidos a terceros salvo obligación legal o necesidad de cumplir con el trámite notarial y registral.`,
  };
}

// Cierre estandar: las partes declaran haber leido y aceptado.
export function aceptacionYRatificacion(ciudad: string, ejemplares = 'tres ejemplares de igual valor'): BloqueDocumento {
  return {
    tipo: 'clausula',
    titulo: 'ACEPTACIÓN Y RATIFICACIÓN',
    texto: `Las partes declaran que han leído y aceptan cada una de las estipulaciones que anteceden, y se ratifican en su contenido, obligándose a su fiel cumplimiento. En constancia suscriben el presente instrumento en ${ciudad}, por ${ejemplares}.`,
  };
}

// Nombres que el agente listó como interesados presentados por él. Un nombre
// por linea en el formulario; se normaliza a una lista limpia.
export function nombresDeLista(bruto: string): string[] {
  return bruto
    .split(/[\n;]+/)
    .map((n) => n.trim())
    .filter(Boolean);
}

// Un texto libre del formulario que se inserta a media frase: baja la inicial
// para que no quede una mayuscula en mitad de la clausula.
export function enMediaFrase(texto: string): string {
  const limpio = texto.trim();
  if (!limpio) return '';
  return limpio.charAt(0).toLowerCase() + limpio.slice(1);
}

// Valor de un campo OPCIONAL. Si está vacío imprime un marcador visible en vez
// de un hueco: un espacio en blanco pasa desapercibido al revisar y termina en
// el documento firmado sin que nadie lo note.
export function opcional(valor: string, marcador = '[ POR COMPLETAR ]'): string {
  const limpio = valor.trim();
  return limpio.length > 0 ? limpio : marcador;
}
