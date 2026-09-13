// Banco de pruebas del generador de cartas CONTRA EL MODELO REAL.
//
// POR QUE EXISTE: las reglas de cero invencion viven en el prompt y en la
// auditoria, pero un prompt que dice "no inventes" no es una garantia: hay que
// mirar lo que el modelo escribe de verdad, sobre todo con un agente que no
// tiene nada que presumir todavia.
//
// No toca la base de datos: arma los datos del agente a mano.
//
//   npx tsx --env-file=.env.local scripts/probar-generador-cartas.ts
//   npx tsx --env-file=.env.local scripts/probar-generador-cartas.ts --json salida.json
import { writeFileSync } from 'node:fs';
import { generarCarta, CARTA_MODELO, type ResultadoGeneracion } from '@/lib/real-estate/cartas/generar';
import { auditarInvencion } from '@/lib/real-estate/cartas/auditoria';
import { resolverSaludo } from '@/lib/real-estate/cartas/saludo';
import { bloquesATexto, type CartaDatosAgente, type CartaDestinatarioTipo } from '@/lib/real-estate/cartas/tipos';

const BASE: CartaDatosAgente = {
  nombre: 'Daniela Ordóñez',
  empresa: null,
  aniosEnRedinmo: 0,
  anioIngreso: 2026,
  nivel: 'Agente Inicial',
  zonas: ['Cumbayá', 'Tumbaco'],
  especialidad: 'venta',
  inmueblesActivos: 0,
  composicionInventario: [],
  cierresRegistrados: 0,
  aniosExperienciaDeclarados: null,
  licencia: null,
  verificado: false,
};

// El agente de la carta que salio mal en produccion, con sus datos reales:
// 3 cierres, 4 inmuebles y 15 años DECLARADOS en su carnet.
const LEX_LUTOR: CartaDatosAgente = {
  ...BASE,
  nombre: 'Lex Lutor',
  empresa: 'Bienes 4A',
  nivel: 'Agente Activo',
  zonas: ['Norte', 'Centro-Norte', 'Cumbayá-Tumbaco'],
  inmueblesActivos: 4,
  composicionInventario: [
    { tipo: 'departamento', cantidad: 3 },
    { tipo: 'local comercial', cantidad: 1 },
  ],
  cierresRegistrados: 3,
  aniosExperienciaDeclarados: 15,
  licencia: '3156',
  verificado: true,
};

const ESCENARIOS_INVENCION: Array<{ clave: string; titulo: string; datos: CartaDatosAgente }> = [
  { clave: 'a', titulo: 'Agente con 0 cierres y 0 inmuebles', datos: BASE },
  {
    clave: 'b',
    titulo: 'Agente con 1 cierre y 2 inmuebles',
    datos: {
      ...BASE,
      nombre: 'Marco Villavicencio',
      aniosEnRedinmo: 1,
      anioIngreso: 2025,
      inmueblesActivos: 2,
      composicionInventario: [
        { tipo: 'departamento', cantidad: 1 },
        { tipo: 'casa', cantidad: 1 },
      ],
      cierresRegistrados: 1,
      verificado: true,
    },
  },
  {
    clave: 'c',
    titulo: 'Agente con historial amplio',
    datos: {
      ...BASE,
      nombre: 'Lucía Benalcázar',
      empresa: 'Benalcázar Propiedades',
      aniosEnRedinmo: 3,
      anioIngreso: 2023,
      nivel: 'Agente Elite',
      zonas: ['La Carolina', 'González Suárez', 'Bellavista'],
      especialidad: 'venta y arriendo',
      inmueblesActivos: 24,
      composicionInventario: [
        { tipo: 'departamento', cantidad: 14 },
        { tipo: 'casa', cantidad: 6 },
        { tipo: 'oficina', cantidad: 4 },
      ],
      cierresRegistrados: 31,
      aniosExperienciaDeclarados: 9,
      licencia: 'CBR-2210',
      verificado: true,
    },
  },
];

// Un destinatario por tipo, elegidos para cubrir tambien los casos del saludo.
const DESTINATARIOS: Array<{ tipo: CartaDestinatarioTipo; nombre: string; cargo: string | null; contexto: string }> = [
  {
    tipo: 'PROPIETARIO',
    nombre: 'ING. GABRIELA MUÑOZ',
    cargo: 'GERENTE',
    contexto: 'En virtud de nuestra conversación en la convención financiera en Guayaquil',
  },
  { tipo: 'COLEGA', nombre: 'Patricio Andrade', cargo: null, contexto: 'nos conocimos en el curso de avalúos de la Cámara de la Construcción' },
  { tipo: 'CONSTRUCTORA', nombre: 'Constructora Andrade S.A.', cargo: null, contexto: 'vi su proyecto de Cumbayá en la feria de vivienda de Quito' },
  { tipo: 'EMPRESA', nombre: 'Alex Morán', cargo: 'Gerente Administrativo', contexto: 'su asistente me comentó que buscan oficinas en el norte de Quito' },
];

type Fila = {
  seccion: string;
  caso: string;
  usoPlantilla: boolean;
  motivo?: string;
  tokensEntrada: number | null;
  tokensSalida: number | null;
  ms: number;
  hallazgos: string[];
  texto: Record<string, string>;
};

function estado(r: ResultadoGeneracion, ms: number, hallazgos: string[]): string {
  const origen = r.usoPlantilla ? `PLANTILLA (${r.motivoRespaldo})` : 'modelo';
  const auditoria = hallazgos.length === 0 ? 'auditoria limpia' : `AUDITORIA: ${hallazgos.join(' | ')}`;
  return `   ${origen} | ${ms} ms | tokens ${r.tokensEntrada}/${r.tokensSalida} | ${auditoria}`;
}

async function main() {
  const guardarEn = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
  console.log(`modelo: ${CARTA_MODELO}\n`);
  const filas: Fila[] = [];

  // ---- 1) Cuatro tipos, con y sin contexto: primeras cinco lineas ----
  console.log('################ 1. APERTURA: CUATRO TIPOS, CON Y SIN CONTEXTO ################\n');
  for (const d of DESTINATARIOS) {
    for (const conContexto of [true, false]) {
      const contexto = conContexto ? d.contexto : null;
      const t0 = Date.now();
      const r = await generarCarta({
        datos: LEX_LUTOR,
        destinatarioTipo: d.tipo,
        destinatarioNombre: d.nombre,
        destinatarioCargo: d.cargo,
        contexto,
      });
      const ms = Date.now() - t0;
      const saludo = resolverSaludo(d.nombre, d.cargo);
      const hallazgos = auditarInvencion(r.bloques, LEX_LUTOR, { contexto, trato: saludo.trato, nombreDestinatario: saludo.tratamiento });
      const caso = `${d.tipo} ${conContexto ? 'CON' : 'SIN'} contexto`;
      filas.push({ seccion: 'apertura', caso, usoPlantilla: r.usoPlantilla, motivo: r.motivoRespaldo, tokensEntrada: r.tokensEntrada, tokensSalida: r.tokensSalida, ms, hallazgos, texto: r.bloques });

      console.log(`=== ${caso} | destinatario: "${d.nombre}"${d.cargo ? ` (cargo "${d.cargo}")` : ''} ===`);
      console.log(estado(r, ms, hallazgos));
      console.log('   ----- primeras cinco lineas -----');
      for (const linea of bloquesATexto(r.bloques).split('\n').slice(0, 5)) console.log(`   | ${linea}`);
      console.log();
    }
  }

  // ---- 2) Saludo: los cinco casos pedidos ----
  console.log('################ 2. SALUDO ################\n');
  const CASOS_SALUDO: Array<[string, string, string | null]> = [
    ['nombre femenino', 'Verónica Paredes', null],
    ['nombre masculino', 'Patricio Andrade', null],
    ['nombre ambiguo', 'Alex Morán', null],
    ['destinatario con título', 'ING. GABRIELA MUÑOZ', 'GERENTE'],
    ['destinatario empresa', 'Constructora Andrade S.A.', null],
  ];
  for (const [caso, nombre, cargo] of CASOS_SALUDO) {
    const s = resolverSaludo(nombre, cargo);
    console.log(`   ${caso.padEnd(24)} "${nombre}"${cargo ? ` + cargo "${cargo}"` : ''}  ->  ${s.texto}   [${s.trato}]`);
  }
  console.log();

  // ---- 3) Cero invencion contra el modelo real ----
  console.log('################ 3. CERO INVENCION ################\n');
  for (const esc of ESCENARIOS_INVENCION) {
    const t0 = Date.now();
    const r = await generarCarta({
      datos: esc.datos,
      destinatarioTipo: 'PROPIETARIO',
      destinatarioNombre: 'Sr. Patricio Andrade',
      contexto: null,
    });
    const ms = Date.now() - t0;
    const hallazgos = auditarInvencion(r.bloques, esc.datos, { contexto: null, trato: 'masculino', nombreDestinatario: 'Sr. Patricio Andrade' });
    filas.push({ seccion: 'invencion', caso: `${esc.clave}) ${esc.titulo}`, usoPlantilla: r.usoPlantilla, motivo: r.motivoRespaldo, tokensEntrada: r.tokensEntrada, tokensSalida: r.tokensSalida, ms, hallazgos, texto: r.bloques });
    console.log(`=== ${esc.clave}) ${esc.titulo} ===`);
    console.log(estado(r, ms, hallazgos));
    for (const [k, v] of Object.entries(r.bloques)) if (v) console.log(`   [${k}] ${v}`);
    console.log();
  }

  // ---- 4) La auditoria frente al texto que salio en produccion ----
  console.log('################ 4. AUDITORIA SOBRE EL TEXTO DE PRODUCCION ################\n');
  const TEXTO_PRODUCCION =
    'Cuento con 15 años de experiencia en el sector y he registrado tres cierres en la plataforma Redinmo.io como Agente Activo. Mi licencia profesional es la número 3156 y mi identidad y teléfono están verificados en la plataforma.';
  const vacia = { saludo: '', apertura: '', presentacion: '', experiencia: TEXTO_PRODUCCION, inventario: '', propuesta: '', cierre: '' };
  for (const [caso, datos] of [
    ['con los 15 años declarados (dato real)', LEX_LUTOR],
    ['si NO hubiera declarado años', { ...LEX_LUTOR, aniosExperienciaDeclarados: null }],
  ] as const) {
    const h = auditarInvencion(vacia, datos);
    console.log(`   ${caso}:`);
    for (const x of h) console.log(`     - ${x}`);
    console.log();
  }

  const conModelo = filas.filter((f) => f.tokensEntrada !== null);
  if (conModelo.length > 0) {
    console.log('--- RESUMEN ---');
    console.log(`generaciones: ${filas.length} | con texto del modelo: ${filas.filter((f) => !f.usoPlantilla).length} | a plantilla: ${filas.filter((f) => f.usoPlantilla).length}`);
    console.log(`tokens de entrada, promedio: ${Math.round(conModelo.reduce((s, f) => s + (f.tokensEntrada ?? 0), 0) / conModelo.length)}`);
    console.log(`tokens de salida, promedio:  ${Math.round(conModelo.reduce((s, f) => s + (f.tokensSalida ?? 0), 0) / conModelo.length)}`);
    console.log(`hallazgos en las cartas entregadas: ${filas.reduce((a, f) => a + f.hallazgos.length, 0)}`);
  }

  if (guardarEn) {
    writeFileSync(guardarEn, JSON.stringify(filas, null, 2), 'utf8');
    console.log(`\nsalida completa en ${guardarEn}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
