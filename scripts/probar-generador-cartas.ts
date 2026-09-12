// Banco de pruebas del generador de cartas CONTRA EL MODELO REAL.
//
// POR QUE EXISTE: las reglas de cero invencion vivian en el prompt pero nunca
// se habian ejercitado. Un prompt que dice "no inventes" no es una garantia:
// hay que mirar lo que el modelo escribe de verdad, sobre todo con un agente
// que no tiene nada que presumir todavia.
//
// No toca la base de datos: arma los datos del agente a mano.
//
//   npx tsx --env-file=.env.local scripts/probar-generador-cartas.ts
//   npx tsx --env-file=.env.local scripts/probar-generador-cartas.ts --json salida.json
import { writeFileSync } from 'node:fs';
import { generarCarta, CARTA_MODELO } from '@/lib/real-estate/cartas/generar';
import { auditarInvencion } from '@/lib/real-estate/cartas/auditoria';
import { CARTA_DESTINATARIOS, type CartaDatosAgente, type CartaDestinatarioTipo } from '@/lib/real-estate/cartas/tipos';

const BASE: CartaDatosAgente = {
  nombre: 'Daniela Ordóñez',
  empresa: null,
  aniosEnRedinmo: 0,
  anioIngreso: 2026,
  nivel: 'Inicial',
  zonas: ['Cumbayá', 'Tumbaco'],
  especialidad: 'venta',
  inmueblesActivos: 0,
  composicionInventario: [],
  cierresRegistrados: 0,
  aniosDeExperiencia: null,
  licencia: null,
  verificado: false,
};

const ESCENARIOS: Array<{ clave: string; titulo: string; datos: CartaDatosAgente }> = [
  {
    clave: 'a',
    titulo: 'Agente con 0 cierres y 0 inmuebles',
    datos: BASE,
  },
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
      nivel: 'Avanzado',
      zonas: ['La Carolina', 'González Suárez', 'Bellavista'],
      especialidad: 'venta y arriendo',
      inmueblesActivos: 24,
      composicionInventario: [
        { tipo: 'departamento', cantidad: 14 },
        { tipo: 'casa', cantidad: 6 },
        { tipo: 'oficina', cantidad: 4 },
      ],
      cierresRegistrados: 31,
      aniosDeExperiencia: 9,
      licencia: 'CBR-2210',
      verificado: true,
    },
  },
];

type Fila = {
  caso: string;
  destinatario: string;
  usoPlantilla: boolean;
  motivo?: string;
  tokensEntrada: number | null;
  tokensSalida: number | null;
  ms: number;
  hallazgos: string[];
  texto: Record<string, string>;
};

async function main() {
  const guardarEn = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
  console.log(`modelo: ${CARTA_MODELO}\n`);

  const filas: Fila[] = [];

  // 1) Cero invencion: los tres escenarios, con el destinatario mas exigente.
  for (const esc of ESCENARIOS) {
    const t0 = Date.now();
    const r = await generarCarta({
      datos: esc.datos,
      destinatarioTipo: 'PROPIETARIO',
      destinatarioNombre: 'Sr. Patricio Andrade',
      contexto: null,
    });
    const ms = Date.now() - t0;
    const hallazgos = auditarInvencion(r.bloques, esc.datos);
    filas.push({
      caso: `${esc.clave}) ${esc.titulo}`,
      destinatario: 'PROPIETARIO',
      usoPlantilla: r.usoPlantilla,
      motivo: r.motivoRespaldo,
      tokensEntrada: r.tokensEntrada,
      tokensSalida: r.tokensSalida,
      ms,
      hallazgos,
      texto: r.bloques,
    });
    console.log(`=== ${esc.clave}) ${esc.titulo} ===`);
    console.log(`   plantilla: ${r.usoPlantilla ? `SI (${r.motivoRespaldo})` : 'no'} | ${ms} ms | tokens ${r.tokensEntrada}/${r.tokensSalida}`);
    console.log(hallazgos.length === 0 ? '   AUDITORIA: limpia' : `   AUDITORIA: ${hallazgos.length} hallazgos\n     - ${hallazgos.join('\n     - ')}`);
    for (const [k, v] of Object.entries(r.bloques)) console.log(`   [${k}] ${v}`);
    console.log();
  }

  // 2) Los cuatro destinatarios, sobre el agente con historial.
  const conHistorial = ESCENARIOS[2].datos;
  for (const tipo of CARTA_DESTINATARIOS as readonly CartaDestinatarioTipo[]) {
    const t0 = Date.now();
    const r = await generarCarta({
      datos: conHistorial,
      destinatarioTipo: tipo,
      destinatarioNombre: 'Sra. Verónica Paredes',
      destinatarioCargo: tipo === 'EMPRESA' ? 'Gerente Administrativa' : null,
      contexto: null,
    });
    const ms = Date.now() - t0;
    const hallazgos = auditarInvencion(r.bloques, conHistorial);
    filas.push({
      caso: `destinatario ${tipo}`,
      destinatario: tipo,
      usoPlantilla: r.usoPlantilla,
      motivo: r.motivoRespaldo,
      tokensEntrada: r.tokensEntrada,
      tokensSalida: r.tokensSalida,
      ms,
      hallazgos,
      texto: r.bloques,
    });
    console.log(`=== destinatario ${tipo} ===`);
    console.log(`   plantilla: ${r.usoPlantilla ? `SI (${r.motivoRespaldo})` : 'no'} | ${ms} ms | tokens ${r.tokensEntrada}/${r.tokensSalida}`);
    console.log(hallazgos.length === 0 ? '   AUDITORIA: limpia' : `   AUDITORIA: ${hallazgos.join(' | ')}`);
    console.log(`   [propuesta] ${r.bloques.propuesta}`);
    console.log(`   [cierre] ${r.bloques.cierre}`);
    console.log();
  }

  const conModelo = filas.filter((f) => !f.usoPlantilla && f.tokensEntrada !== null);
  if (conModelo.length > 0) {
    const e = conModelo.reduce((s, f) => s + (f.tokensEntrada ?? 0), 0) / conModelo.length;
    const s = conModelo.reduce((a, f) => a + (f.tokensSalida ?? 0), 0) / conModelo.length;
    const ms = conModelo.reduce((a, f) => a + f.ms, 0) / conModelo.length;
    console.log('--- CONSUMO MEDIDO ---');
    console.log(`generaciones con modelo: ${conModelo.length} de ${filas.length}`);
    console.log(`tokens de entrada, promedio: ${Math.round(e)}`);
    console.log(`tokens de salida, promedio:  ${Math.round(s)}`);
    console.log(`latencia, promedio:          ${Math.round(ms)} ms`);
    const totalHallazgos = filas.reduce((a, f) => a + f.hallazgos.length, 0);
    console.log(`hallazgos de auditoria:      ${totalHallazgos}`);
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
