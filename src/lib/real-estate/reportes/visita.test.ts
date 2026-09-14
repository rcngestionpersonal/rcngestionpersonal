import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { cifrarBytes, cifrarTexto, descifrarBytes, descifrarTexto } from './cifrado';
import { fotoDescifrada, prepararFoto } from './foto';
import { cedulaEnmascarada, validarConsentimientoFoto } from './tipos';
import { visitaSchema } from './visitas';

// Reglas del reporte de visita que no pueden romperse: el consentimiento de la
// foto, el cifrado de los datos del visitante y lo que ve el propietario.

const CLAVE_ORIGINAL = process.env.ENCRYPTION_KEY;

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
});
afterAll(() => {
  if (CLAVE_ORIGINAL === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = CLAVE_ORIGINAL;
});

describe('consentimiento de la foto (punto 3.3)', () => {
  it('sin foto no hay nada que consentir', () => {
    expect(validarConsentimientoFoto(false, { respaldo: false, redes: false })).toEqual({ ok: true, guardarFoto: false, redes: false });
  });

  it('una foto sin el primer consentimiento se rechaza, no se guarda en silencio', () => {
    const r = validarConsentimientoFoto(true, { respaldo: false, redes: false });
    expect(r.ok).toBe(false);
  });

  it('el segundo consentimiento no salva una foto sin el primero', () => {
    expect(validarConsentimientoFoto(true, { respaldo: false, redes: true }).ok).toBe(false);
  });

  it('con respaldo y sin redes: la foto se guarda como solo respaldo', () => {
    expect(validarConsentimientoFoto(true, { respaldo: true, redes: false })).toEqual({ ok: true, guardarFoto: true, redes: false });
  });

  it('con los dos: se guarda y queda habilitada para redes', () => {
    expect(validarConsentimientoFoto(true, { respaldo: true, redes: true })).toEqual({ ok: true, guardarFoto: true, redes: true });
  });
});

describe('datos del visitante', () => {
  it('el propietario ve la cédula enmascarada, nunca completa', () => {
    expect(cedulaEnmascarada('4521')).toBe('•••••• 4521');
    expect(cedulaEnmascarada(null)).toBeNull();
  });

  it('nombre y cédula se cifran y vuelven intactos', () => {
    const cifrado = cifrarTexto('Andrés Cifuentes');
    expect(cifrado).not.toContain('Andrés');
    expect(descifrarTexto(cifrado)).toBe('Andrés Cifuentes');
  });

  it('un dato que no descifra no tumba el reporte', () => {
    expect(descifrarTexto('00:00:00')).toBeNull();
  });

  it('valida la cédula y la limpia', () => {
    const base = { listingId: 'x', visitadaAt: new Date().toISOString(), visitanteNombre: 'Ana Pérez', reaccion: 'MUY_INTERESADO' };
    expect(visitaSchema.safeParse({ ...base, visitanteCedula: '1712345678' }).success).toBe(true);
    expect(visitaSchema.safeParse({ ...base, visitanteCedula: '171-234-5678' }).data?.visitanteCedula).toBe('1712345678');
    expect(visitaSchema.safeParse({ ...base, visitanteCedula: '12345' }).success).toBe(false);
    expect(visitaSchema.safeParse({ ...base, visitanteCedula: null }).success).toBe(true);
  });

  it('una visita no puede tener fecha futura', () => {
    const futura = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const r = visitaSchema.safeParse({ listingId: 'x', visitadaAt: futura, visitanteNombre: 'Ana Pérez', reaccion: 'NO_INTERESADO' });
    expect(r.success).toBe(false);
  });
});

describe('foto cifrada', () => {
  it('los bytes cifrados no son un JPEG y vuelven idénticos', () => {
    const original = Buffer.from('contenido de prueba de una imagen');
    const cifrado = cifrarBytes(original);
    expect(cifrado.includes(original)).toBe(false);
    expect(descifrarBytes(cifrado).equals(original)).toBe(true);
  });

  it('con otra clave no se abre', () => {
    const cifrado = cifrarBytes(Buffer.from('foto'));
    process.env.ENCRYPTION_KEY = 'b'.repeat(64);
    expect(() => descifrarBytes(cifrado)).toThrow();
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  });

  it('quita los metadatos: la ubicación GPS del celular no llega a guardarse', async () => {
    const conExif = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#7f8c8d' } })
      .jpeg()
      .withExif({ IFD0: { Make: 'CelularDePrueba', Copyright: 'dato-que-no-debe-quedar' } })
      .toBuffer();
    expect((await sharp(conExif).metadata()).exif).toBeDefined();

    const { cifrada, ancho, alto } = await prepararFoto(conExif);
    const guardada = fotoDescifrada(cifrada);
    const meta = await sharp(guardada).metadata();

    expect(meta.exif).toBeUndefined();
    expect(guardada.includes(Buffer.from('dato-que-no-debe-quedar'))).toBe(false);
    // Y se reduce a un tamaño razonable para una hoja A4.
    expect(Math.max(ancho, alto)).toBe(1280);
  });
});
