import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { correoGestion } from './correos/gestion';
import { correoTasacion } from './correos/tasacion';
import { correoVisita, type DatosCorreoVisita } from './correos/visita';
import { enlaceDeDescarga, verificarEnlace } from './documento';

// Los correos de reportes son correspondencia del agente con su cliente. Lo que
// no puede pasar: voz de sistema, bloques vacios, maquetacion que Outlook o
// Gmail rompen, o el nivel de interes pintado con el color equivocado.

const agente = {
  nombre: 'Lucía Benalcázar',
  empresa: 'Benalcázar Propiedades',
  telefono: '+593 99 123 4567',
  correo: 'lucia@benalcazar.ec',
  imagenUrl: 'https://ejemplo.test/foto.jpg',
  verificado: true,
  urlMiniSitio: 'https://redinmo.io/a/lucia',
};

const base: DatosCorreoVisita = {
  agente,
  propietario: 'Gabriela Muñoz',
  inmueble: { fotoUrl: 'https://ejemplo.test/portada.jpg', tipo: 'Departamento', sector: 'La Carolina', referencia: 'RDN-8F2A', precio: '$185.000' },
  visitadaAt: new Date('2026-09-12T22:30:00Z'),
  duracionMinutos: 45,
  visitante: 'Andrés Cifuentes',
  acompanantes: 'Su esposa',
  reaccion: 'MUY_INTERESADO',
  observaciones: 'Le gustó la luz de la sala.',
  objeciones: 'La cocina necesita remodelación.',
  proximoPaso: 'Segunda visita el sábado.',
  mensaje: null,
  conFoto: true,
  entrega: { modo: 'adjunto' },
  ahora: new Date('2026-09-12T23:00:00Z'),
};

const VOZ_DE_SISTEMA = /se ha generado|mensaje autom|el sistema ha|nuevo reporte disponible|autom[aá]tico|darse de baja|unsubscribe/i;

function estructuraSegura(html: string) {
  expect(html).not.toMatch(/<style/i);
  expect(html).not.toMatch(/display:\s*(flex|grid)/i);
  expect(html).not.toMatch(/gradient|box-shadow/i);
  for (const img of html.match(/<img[^>]*>/g) ?? []) {
    expect(img).toMatch(/alt="/);
    expect(img).toMatch(/width="\d+"/);
    expect(img).toMatch(/height="\d+"/);
    expect(img).toMatch(/src="https:\/\//);
  }
}

describe('correo del reporte de visita', () => {
  it('asunto específico, no genérico', () => {
    expect(correoVisita(base).asunto).toBe('Reporte de visita · Departamento en La Carolina · 12 de septiembre');
  });

  it('escrito en voz del agente, nunca del sistema', () => {
    const c = correoVisita(base);
    expect(c.html + c.texto).not.toMatch(VOZ_DE_SISTEMA);
    expect(c.texto).toContain('Le comparto el detalle de la visita realizada hoy a su inmueble en La Carolina.');
  });

  it('maquetación segura para clientes de correo', () => {
    estructuraSegura(correoVisita(base).html);
  });

  it('saludo con fórmula y línea propia; la cédula nunca va en el correo', () => {
    const c = correoVisita(base);
    expect(c.texto.split('\n')[0]).toBe('Estimada Gabriela Muñoz,');
    expect(c.texto.split('\n')[1]).toBe('');
    expect(c.html + c.texto).not.toMatch(/c[eé]dula|C\.I\./i);
  });

  it('el chip tiene el color de cada nivel', () => {
    expect(correoVisita(base).html).toMatch(/background-color:#0d9488[^>]*>Muy interesado/);
    expect(correoVisita({ ...base, reaccion: 'INTERESADO_CON_REPAROS' }).html).toMatch(/background-color:#f3d27a[^>]*color:#3b2a00[^>]*>Interesado, con reparos/);
    expect(correoVisita({ ...base, reaccion: 'NO_INTERESADO' }).html).toMatch(/background-color:#e6e3ef[^>]*color:#14121f[^>]*>No interesado/);
  });

  it('sin acompañantes, próximo paso, comentarios ni foto: ningún bloque vacío', () => {
    const c = correoVisita({ ...base, acompanantes: null, proximoPaso: null, objeciones: null, conFoto: false, duracionMinutos: null });
    expect(c.html).not.toContain('Acompañantes');
    expect(c.html).not.toContain('PRÓXIMO PASO');
    expect(c.html).not.toContain('COMENTARIOS DEL VISITANTE');
    expect(c.html).not.toContain('Duración');
    expect(c.html).toContain('El reporte completo va adjunto en PDF.');
    expect(c.html).not.toContain('constancia fotográfica');
  });

  it('con foto, la nota del adjunto lo dice', () => {
    expect(correoVisita(base).html).toContain('El reporte completo, con la constancia fotográfica, va adjunto en PDF.');
  });

  it('una visita de otro día no dice "hoy"', () => {
    const c = correoVisita({ ...base, visitadaAt: new Date('2026-09-10T15:00:00Z') });
    expect(c.texto).toContain('realizada el 10 de septiembre de 2026');
  });

  it('sin nombre del propietario, un saludo neutro que no invente uno', () => {
    expect(correoVisita({ ...base, propietario: null }).texto.split('\n')[0]).toBe('Reciba un cordial saludo,');
  });

  it('firma completa: nombre, empresa, teléfono, correo, sello y perfil', () => {
    const c = correoVisita(base);
    for (const parte of ['Lucía Benalcázar', 'Benalcázar Propiedades', '+593 99 123 4567', 'lucia@benalcazar.ec', 'Agente verificado en Redinmo', 'https://redinmo.io/a/lucia']) {
      expect(c.texto).toContain(parte);
    }
    expect(c.texto).toContain('Quedo atenta a cualquier consulta.');
  });

  it('el texto plano se sostiene solo: trae los datos y el resultado', () => {
    const c = correoVisita(base);
    for (const parte of ['Andrés Cifuentes', 'Su esposa', '45 minutos', 'RESULTADO: Muy interesado', 'Le gustó la luz', 'PRÓXIMO PASO: Segunda visita']) {
      expect(c.texto).toContain(parte);
    }
    expect(c.texto).not.toMatch(/navegador|browser/i);
  });

  it('con enlace de descarga no promete un adjunto', () => {
    const c = correoVisita({ ...base, entrega: { modo: 'enlace', url: 'https://redinmo.io/api/documentos/x', venceAt: new Date('2026-10-12T15:00:00Z') } });
    expect(c.html).toContain('Descargar el reporte completo (PDF)');
    expect(c.html).not.toContain('va adjunto');
  });
});

describe('correos de gestión y tasación', () => {
  it('gestión usa la misma estructura y la nota del período', () => {
    const c = correoGestion({
      agente, propietario: null, inmueble: base.inmueble, periodicidad: 'SEMANAL',
      desde: new Date('2026-09-05T15:00:00Z'), hasta: new Date('2026-09-12T15:00:00Z'),
      visitas: 1, consultas: 2, vistas: 3, compradores: 0, agendadas: 0, enNegociacion: 0,
      observaciones: null, acumulado: { semanas: 1, visitas: 1, consultas: 2 }, mensaje: null, entrega: { modo: 'adjunto' },
    });
    estructuraSegura(c.html);
    expect(c.asunto).toBe('Reporte de gestión · Departamento en La Carolina · 5 al 12 de septiembre');
    expect(c.html).toContain('El reporte completo del período va adjunto en PDF.');
    expect(c.html).not.toContain('MI ANÁLISIS');
    expect(c.html + c.texto).not.toMatch(VOZ_DE_SISTEMA);
  });

  it('tasación lleva la advertencia también en el cuerpo', () => {
    const c = correoTasacion({
      agente, propietario: 'Gabriela Muñoz', inmueble: { ...base.inmueble, sector: 'Centro-Norte' }, emitidoAt: new Date('2026-09-12T15:00:00Z'),
      minimo: '$129.000', central: '$133.000', maximo: '$138.000', conclusion: 'Conclusión.', cierres: 9, mensaje: null, entrega: { modo: 'adjunto' },
    });
    estructuraSegura(c.html);
    expect(c.html).toContain('No constituye un avalúo profesional');
    expect(c.texto).toContain('No constituye un avalúo profesional');
  });
});

describe('enlace de descarga', () => {
  const secreto = process.env.AUTH_SECRET;
  beforeAll(() => {
    process.env.AUTH_SECRET = 'secreto-de-prueba';
  });
  afterAll(() => {
    if (secreto === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = secreto;
  });

  it('un token válido abre, uno alterado no, uno vencido tampoco', () => {
    const ahora = new Date('2026-09-12T15:00:00Z');
    const { url } = enlaceDeDescarga('doc123', 'https://redinmo.io', ahora);
    const token = url.split('/api/documentos/')[1];

    expect(verificarEnlace(token, ahora)).toEqual({ documentoId: 'doc123' });
    expect(verificarEnlace(token.replace('doc123', 'doc999'), ahora)).toEqual({ error: 'invalido' });
    expect(verificarEnlace(token, new Date('2026-10-13T15:00:00Z'))).toEqual({ error: 'vencido' });
  });
});
