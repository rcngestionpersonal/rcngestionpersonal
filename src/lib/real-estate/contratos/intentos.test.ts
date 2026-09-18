import { beforeEach, describe, expect, it, vi } from 'vitest';

// Límite de intentos con los últimos 4 dígitos de la cédula. SIN base de datos:
// Prisma se reemplaza por una tabla en memoria con lo justo que usan
// registrarDecision y regenerarEnlace. Todos los datos son inventados.

type Fila = Record<string, unknown>;

const db = vi.hoisted(() => {
  const tablas: Record<string, Fila[]> = { contratoParte: [], contratoVersion: [], contrato: [], contratoEvento: [] };

  const cumple = (fila: Fila, where: Fila = {}): boolean =>
    Object.entries(where).every(([clave, cond]) => {
      const valor = fila[clave] ?? null;
      if (cond === null) return valor === null;
      if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
        const c = cond as { in?: unknown[]; lt?: number; not?: unknown };
        if (c.in) return c.in.includes(valor);
        if (c.lt !== undefined) return (valor as number) < c.lt;
        if ('not' in c) return valor !== c.not;
      }
      return valor === cond;
    });

  const aplicar = (fila: Fila, data: Fila) => {
    for (const [clave, valor] of Object.entries(data)) {
      if (valor && typeof valor === 'object' && 'increment' in (valor as Fila)) {
        fila[clave] = ((fila[clave] as number) ?? 0) + ((valor as { increment: number }).increment);
      } else fila[clave] = valor;
    }
  };

  const modelo = (nombre: string) => ({
    updateMany: async ({ where, data }: { where: Fila; data: Fila }) => {
      const filas = tablas[nombre].filter((f) => cumple(f, where));
      filas.forEach((f) => aplicar(f, data));
      return { count: filas.length };
    },
    update: async ({ where, data }: { where: Fila; data: Fila }) => {
      const fila = tablas[nombre].find((f) => cumple(f, where));
      if (!fila) throw new Error(`${nombre}: no existe`);
      aplicar(fila, data);
      return fila;
    },
    findUnique: async ({ where }: { where: Fila }) => tablas[nombre].find((f) => cumple(f, where)) ?? null,
    findMany: async ({ where }: { where?: Fila } = {}) => tablas[nombre].filter((f) => cumple(f, where)),
    create: async ({ data }: { data: Fila }) => {
      tablas[nombre].push({ ...data });
      return data;
    },
  });

  const prisma: Record<string, unknown> = {
    contratoParte: modelo('contratoParte'),
    contratoVersion: modelo('contratoVersion'),
    contrato: modelo('contrato'),
    contratoEvento: modelo('contratoEvento'),
  };
  prisma.$transaction = async (fn: (tx: unknown) => unknown) => fn(prisma);
  return { tablas, prisma };
});

vi.mock('@/lib/prisma', () => ({ prisma: db.prisma }));
vi.mock('./pdf', () => ({ renderContratoPdf: vi.fn() }));

process.env.ENCRYPTION_KEY = 'clave-de-prueba-solo-para-este-archivo';

const { MAX_INTENTOS_CEDULA, mensajeDigitosIncorrectos } = await import('./aprobacion');
const { decryptAtRest } = await import('@/lib/real-estate/payments/encryption');
const { motivoCerrado, registrarDecision, regenerarEnlace, statusDeMotivo } = await import('./versiones');
type ParteConContexto = Parameters<typeof registrarDecision>[0];
type ContratoCompleto = Parameters<typeof regenerarEnlace>[0];

const SOLICITUD = { ip: '203.0.113.7', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1' };
const CORRECTOS = '4321';
const MALOS = '0000';

function sembrar() {
  const version = {
    id: 'ver-1', contratoId: 'ctr-1', numero: 1, huella: 'huella-1', estado: 'EN_APROBACION', representa: null,
    requierePrincipal: true, requiereContraparte: false, principalHeredadaDe: null, simultanea: false,
    contraparteEnviadaAt: null, principalAprobadaAt: null, enviadaAt: new Date(), aprobadaAt: null, cerradaAt: null,
  };
  const parte = {
    id: 'parte-1', contratoId: 'ctr-1', versionId: 'ver-1', rol: 'propietario', etapa: 'PRINCIPAL', nombre: 'Propietaria Ficticia',
    correo: 'propietaria@ejemplo.test', cedulaUlt4: CORRECTOS, estado: 'ENVIADO', expiraAt: new Date(Date.now() + 86_400_000),
    enviadoAt: new Date(), abiertoAt: null, aprobadoAt: null, rechazadoAt: null, motivoRechazo: null,
    intentosFallidos: 0, bloqueadoAt: null, tokenHash: 'hash-1', tokenCifrado: null, evidenciaCifrada: null,
  };
  const contrato = { id: 'ctr-1', agentId: 'agente-1', tipo: 'CORRETAJE', estado: 'EN_REVISION_PRINCIPAL', versionActual: 1, vigenciaHoras: null };
  db.tablas.contratoVersion.splice(0, Infinity, version);
  db.tablas.contratoParte.splice(0, Infinity, parte);
  db.tablas.contrato.splice(0, Infinity, contrato);
  db.tablas.contratoEvento.splice(0);
}

// Lo que devolvería parteDeToken en este momento.
function parteActual(): ParteConContexto {
  const fila = db.tablas.contratoParte[0];
  const version = db.tablas.contratoVersion[0];
  return {
    ...fila,
    version,
    contrato: { ...db.tablas.contrato[0], partes: db.tablas.contratoParte, versiones: db.tablas.contratoVersion },
  } as unknown as ParteConContexto;
}

const decidir = (ultimos4: string, p = parteActual()) =>
  registrarDecision(p, { accion: 'aprobar', ultimos4, leyoCompleto: true, declaracion: true }, SOLICITUD);

const eventos = (tipo: string) => db.tablas.contratoEvento.filter((e) => e.tipo === tipo);

beforeEach(sembrar);

describe('límite de intentos con los dígitos de la cédula', () => {
  it(`cuenta cada fallo, dice cuántos quedan y bloquea al ${MAX_INTENTOS_CEDULA}.º`, async () => {
    for (let n = 1; n < MAX_INTENTOS_CEDULA; n++) {
      const r = await decidir(MALOS);
      expect(r).toMatchObject({ ok: false, status: 403, code: 'cedula_no_coincide', restantes: MAX_INTENTOS_CEDULA - n });
      expect(db.tablas.contratoParte[0].intentosFallidos).toBe(n);
    }
    expect(db.tablas.contratoParte[0].bloqueadoAt).toBeNull();

    const ultimo = await decidir(MALOS);
    expect(ultimo).toMatchObject({ ok: false, status: 423, code: 'bloqueado', recienBloqueado: true });
    expect(db.tablas.contratoParte[0].bloqueadoAt).toBeInstanceOf(Date);
    expect(eventos('INTENTO_FALLIDO')).toHaveLength(MAX_INTENTOS_CEDULA);
    expect(eventos('BLOQUEO')).toHaveLength(1);
  });

  it('cada intento fallido queda en el historial con IP, navegador y fecha', async () => {
    await decidir(MALOS);
    const [evento] = eventos('INTENTO_FALLIDO');
    expect(evento).toMatchObject({ actor: 'PARTE', parteId: 'parte-1', versionNumero: 1, huella: 'huella-1' });
    expect(evento.createdAt).toBeInstanceOf(Date);
    const detalle = JSON.parse(decryptAtRest(evento.detalleCifrado as string));
    expect(detalle).toMatchObject({ ip: SOLICITUD.ip, userAgent: SOLICITUD.userAgent, navegador: 'Safari en iOS', nota: `Intento 1 de ${MAX_INTENTOS_CEDULA}` });
    expect(detalle.fechaEcuador).toMatch(/GMT-5/);
  });

  it('bloqueado, ni los dígitos correctos pasan, y el aviso al agente sale una sola vez', async () => {
    for (let n = 0; n < MAX_INTENTOS_CEDULA; n++) await decidir(MALOS);
    const despues = await decidir(CORRECTOS);
    expect(despues).toMatchObject({ ok: false, status: 423, code: 'bloqueado' });
    expect(despues).not.toHaveProperty('recienBloqueado', true);
    expect(db.tablas.contratoParte[0].estado).toBe('ENVIADO');
    expect(eventos('BLOQUEO')).toHaveLength(1);
  });

  it('un acierto que llega a la par del bloqueo no se cuela', async () => {
    // Lo que leyó esta solicitud antes de que los otros intentos bloquearan.
    const leidaAntes = parteActual();
    for (let n = 0; n < MAX_INTENTOS_CEDULA; n++) await decidir(MALOS);
    const r = await decidir(CORRECTOS, leidaAntes);
    expect(r).toMatchObject({ ok: false, status: 423, code: 'bloqueado' });
    expect(db.tablas.contratoParte[0].estado).toBe('ENVIADO');
    expect(eventos('APROBACION')).toHaveLength(0);
  });

  it('antes del límite, los dígitos correctos aprueban', async () => {
    await decidir(MALOS);
    await decidir(MALOS);
    const r = await decidir(CORRECTOS);
    expect(r).toMatchObject({ ok: true, estado: 'APROBADO' });
    expect(db.tablas.contratoParte[0].estado).toBe('APROBADO');
  });

  it('pedir cambios también cuenta los fallos', async () => {
    const r = await registrarDecision(parteActual(), { accion: 'rechazar', ultimos4: MALOS, motivo: 'Cambiar el plazo.', leyoCompleto: true }, SOLICITUD);
    expect(r).toMatchObject({ code: 'cedula_no_coincide', restantes: MAX_INTENTOS_CEDULA - 1 });
  });

  it('el enlace bloqueado no abre: la página, la API y el PDF dicen lo mismo', async () => {
    for (let n = 0; n < MAX_INTENTOS_CEDULA; n++) await decidir(MALOS);
    expect(motivoCerrado(parteActual())).toBe('bloqueado');
    expect(statusDeMotivo('bloqueado')).toBe(423);
  });

  it('el enlace nuevo que genera el agente vuelve a cero', async () => {
    for (let n = 0; n < MAX_INTENTOS_CEDULA; n++) await decidir(MALOS);
    const contrato = {
      ...db.tablas.contrato[0],
      partes: db.tablas.contratoParte,
      versiones: db.tablas.contratoVersion,
    } as unknown as ContratoCompleto;
    const r = await regenerarEnlace(contrato, 'parte-1', null, SOLICITUD);
    expect(r.ok).toBe(true);
    expect(db.tablas.contratoParte[0]).toMatchObject({ intentosFallidos: 0, bloqueadoAt: null });
    expect(motivoCerrado(parteActual())).toBeNull();
  });

  it('el mensaje dice cuántos intentos quedan, en singular y en plural', () => {
    expect(mensajeDigitosIncorrectos(1)).toContain('Le queda 1 intento;');
    expect(mensajeDigitosIncorrectos(3)).toContain('Le quedan 3 intentos;');
  });
});
