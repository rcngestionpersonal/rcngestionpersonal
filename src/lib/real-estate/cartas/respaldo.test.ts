import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generarCarta } from './generar';
import { bloquesATexto, CARTA_BLOQUES, type CartaDatosAgente } from './tipos';

// El agente NUNCA puede quedarse sin poder generar una carta por un fallo del
// proveedor. Estas pruebas recorren las formas en que la llamada puede salir
// mal y comprueban que en todas se entrega igual un borrador completo, armado
// con los datos reales del agente.

const DATOS: CartaDatosAgente = {
  nombre: 'Lucía Bermeo',
  empresa: 'Bermeo Propiedades',
  aniosEnRedinmo: 2,
  anioIngreso: 2024,
  nivel: 'Agente Activo',
  zonas: ['Cumbayá', 'Tumbaco'],
  especialidad: 'venta',
  inmueblesActivos: 8,
  composicionInventario: [{ tipo: 'casa', cantidad: 8 }],
  cierresRegistrados: 5,
  aniosExperienciaDeclarados: 6,
  licencia: '9012',
  verificado: true,
};

const ENTRADA = {
  datos: DATOS,
  destinatarioTipo: 'PROPIETARIO' as const,
  destinatarioNombre: 'Andrés Cifuentes',
};

function esBorradorUsable(bloques: Record<string, string>) {
  // Completo: todos los bloques con texto, y con los datos reales adentro. La
  // apertura es la excepcion: sin contexto va vacia a proposito.
  for (const clave of CARTA_BLOQUES) {
    if (clave === 'apertura') continue;
    expect(bloques[clave]?.trim(), `el bloque "${clave}" no puede venir vacío`).toBeTruthy();
  }
  expect(bloques.apertura).toBe('');
  const texto = bloquesATexto(bloques as never);
  expect(texto).toContain('Lucía Bermeo');
  expect(texto).toContain('Andrés Cifuentes');
  expect(texto).not.toContain('undefined');
}

describe('cartas: respaldo cuando el generador falla', () => {
  const claveOriginal = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'clave-de-prueba';
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (claveOriginal === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = claveOriginal;
    vi.restoreAllMocks();
  });

  it('cae a la plantilla si el proveedor responde 500, y reintenta una vez', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await generarCarta(ENTRADA);

    expect(fetchMock).toHaveBeenCalledTimes(2); // el 500 es transitorio: 1 intento + 1 reintento
    expect(r.usoPlantilla).toBe(true);
    expect(r.motivoRespaldo).toBe('http');
    esBorradorUsable(r.bloques);
  });

  it('no reintenta ante un 401: esa falla no se arregla sola', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('no autorizado', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await generarCarta(ENTRADA);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r.usoPlantilla).toBe(true);
    esBorradorUsable(r.bloques);
  });

  it('cae a la plantilla si la red falla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));

    const r = await generarCarta(ENTRADA);

    expect(r.usoPlantilla).toBe(true);
    expect(r.motivoRespaldo).toBe('red');
    esBorradorUsable(r.bloques);
  });

  it('cae a la plantilla si el modelo devuelve un JSON inválido', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ choices: [{ message: { content: 'esto no es json' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
      ),
    );

    const r = await generarCarta(ENTRADA);

    expect(r.usoPlantilla).toBe(true);
    esBorradorUsable(r.bloques);
  });

  it('cae a la plantilla si el modelo devuelve bloques incompletos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          choices: [{ message: { content: JSON.stringify({ saludo: 'Hola:', presentacion: '', experiencia: '', inventario: '', propuesta: '', cierre: '' }) } }],
        }),
      ),
    );

    const r = await generarCarta(ENTRADA);

    expect(r.usoPlantilla).toBe(true);
    esBorradorUsable(r.bloques);
  });

  it('usa el texto del modelo cuando la respuesta es válida', async () => {
    const delModelo = Object.fromEntries(CARTA_BLOQUES.map((c) => [c, `Párrafo ${c} escrito por el modelo.`]));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          choices: [{ message: { content: JSON.stringify(delModelo) } }],
          usage: { prompt_tokens: 812, completion_tokens: 430 },
        }),
      ),
    );

    const r = await generarCarta(ENTRADA);

    expect(r.usoPlantilla).toBe(false);
    expect(r.bloques.presentacion).toBe('Párrafo presentacion escrito por el modelo.');
    expect(r.tokensEntrada).toBe(812);
    expect(r.tokensSalida).toBe(430);
  });

  it('el saludo y la apertura NO los decide el modelo', async () => {
    // Lo que paso en produccion: el modelo fundio saludo y contexto en una
    // linea. Aunque lo vuelva a hacer, la carta sale con el saludo correcto y,
    // sin contexto, sin apertura.
    const delModelo = {
      ...Object.fromEntries(CARTA_BLOQUES.map((c) => [c, `Párrafo ${c} escrito por el modelo.`])),
      saludo: 'Andrés Cifuentes, un gusto saludarlo tras nuestra conversación.',
      apertura: 'Fue un gusto conocerlo en la feria.',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify(delModelo) } }] })),
    );

    const r = await generarCarta(ENTRADA);

    expect(r.bloques.saludo).toBe('Estimado Andrés Cifuentes,');
    expect(r.bloques.apertura).toBe('');
  });

  it('con contexto, exige la apertura: si el modelo no la escribe, cae a la plantilla', async () => {
    const delModelo = { ...Object.fromEntries(CARTA_BLOQUES.map((c) => [c, `Párrafo ${c} escrito por el modelo.`])), apertura: '' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify(delModelo) } }] })),
    );

    const r = await generarCarta({ ...ENTRADA, contexto: 'nos conocimos en la feria' });

    expect(r.usoPlantilla).toBe(true);
    expect(r.bloques.apertura).toBe('Nos conocimos en la feria.');
  });
});
