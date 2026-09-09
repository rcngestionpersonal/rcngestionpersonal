import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cifrarEvidencia,
  coincidenUltimos4,
  describirNavegador,
  descifrarDatos,
  descifrarEvidencia,
  cifrarDatos,
  fechaExpiracion,
  generarCodigoVerificacion,
  generarToken,
  hashToken,
  ultimos4,
} from './firma';
import { FIRMA_VIGENCIA_DIAS } from './tipos';

// La firma remota es la parte del módulo donde un error se paga caro: un token
// adivinable o una comparación floja de la cédula convertirían la "constancia
// probatoria" en un adorno. Estas pruebas cubren esos puntos.

describe('contratos: tokens de firma', () => {
  it('genera tokens largos e impredecibles, y nunca dos iguales', () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const { token } = generarToken();
      // 32 bytes en base64url: 43 caracteres.
      expect(token.length).toBeGreaterThanOrEqual(43);
      expect(vistos.has(token)).toBe(false);
      vistos.add(token);
    }
  });

  it('guarda el hash y no el token: del hash no se vuelve al token', () => {
    const { token, hash } = generarToken();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    // El mismo token siempre da el mismo hash: así se busca la fila.
    expect(hashToken(token)).toBe(hash);
    expect(hashToken(`${token}x`)).not.toBe(hash);
  });

  it('los enlaces caducan a los días definidos', () => {
    const desde = new Date('2026-09-01T12:00:00Z');
    const expira = fechaExpiracion(desde);
    const dias = (expira.getTime() - desde.getTime()) / (24 * 60 * 60 * 1000);
    expect(dias).toBe(FIRMA_VIGENCIA_DIAS);
  });

  it('el código público no usa caracteres que se confundan al dictarlo', () => {
    for (let i = 0; i < 200; i += 1) {
      const codigo = generarCodigoVerificacion();
      expect(codigo).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
      // Sin I, O, 0 ni 1: son los que se confunden por teléfono.
      expect(codigo).not.toMatch(/[IO01]/);
    }
  });
});

describe('contratos: verificación de identidad del firmante', () => {
  it('acepta solo los últimos 4 dígitos correctos', () => {
    expect(coincidenUltimos4('5432', '5432')).toBe(true);
    expect(coincidenUltimos4('0000', '5432')).toBe(false);
    expect(coincidenUltimos4('543', '5432')).toBe(false);
    expect(coincidenUltimos4('', '5432')).toBe(false);
    expect(coincidenUltimos4('54321', '5432')).toBe(false);
  });

  it('ignora guiones y espacios que la persona pueda teclear', () => {
    expect(coincidenUltimos4('54-32', '5432')).toBe(true);
    expect(coincidenUltimos4(' 5432 ', '5432')).toBe(true);
  });

  it('extrae los últimos 4 dígitos de una cédula o RUC', () => {
    expect(ultimos4('1712345678')).toBe('5678');
    expect(ultimos4('1712345678001')).toBe('8001');
    expect(ultimos4('171-234-5678')).toBe('5678');
  });
});

describe('contratos: cifrado en reposo', () => {
  const original = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'clave-de-prueba-para-los-tests-de-contratos';
  });

  afterEach(() => {
    if (original === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = original;
  });

  it('los datos de las partes no quedan legibles en la base', () => {
    const datos = { comprador_nombre: 'Ana Ruiz', comprador_cedula: '1712223334', precioTotal: '240000' };
    const cifrado = cifrarDatos(datos);

    // Nada del contenido sensible aparece en el texto guardado.
    expect(cifrado).not.toContain('Ana Ruiz');
    expect(cifrado).not.toContain('1712223334');
    expect(cifrado).not.toContain('240000');
    // Y vuelve entero al descifrar.
    expect(descifrarDatos(cifrado)).toEqual(datos);
  });

  it('el registro probatorio también va cifrado y vuelve completo', () => {
    const evidencia = {
      ip: '190.12.44.7',
      userAgent: 'Safari en iOS',
      leyoCompleto: true,
      hashDocumento: 'a'.repeat(64),
      aceptoLectura: true,
      aceptoValorFirma: true,
      zonaHoraria: 'America/Guayaquil',
    };
    const cifrada = cifrarEvidencia(evidencia);
    expect(cifrada).not.toContain('190.12.44.7');
    expect(descifrarEvidencia(cifrada)).toEqual(evidencia);
  });

  it('un dato corrupto no revienta: devuelve null', () => {
    expect(descifrarEvidencia('esto-no-es-cifrado')).toBeNull();
    expect(descifrarEvidencia(null)).toBeNull();
    expect(descifrarDatos('basura')).toEqual({});
  });
});

describe('contratos: descripción del dispositivo para la constancia', () => {
  it('resume el navegador y el sistema en algo legible', () => {
    expect(describirNavegador('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Safari/605.1')).toBe('Safari en iOS');
    expect(describirNavegador('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537')).toBe('Chrome en Windows');
    expect(describirNavegador('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537')).toBe('Chrome en Android');
    expect(describirNavegador(null)).toBe('—');
  });
});
