// Semántica de una rotación de ENCRYPTION_KEY.
//
// Fija por escrito las dos cosas que hay que saber el día que haya contratos de
// clientes reales y toque cambiar la clave:
//
//   1. Recifrar de una clave a otra conserva el contenido exacto.
//   2. Cambiar la clave SIN recifrar no explota. Devuelve vacío. Ese es el
//      peligro real, y por eso está escrito aquí y no solo en un documento.
//
// La lógica que ejerce es la misma de scripts/rotar-encryption-key.ts, que es
// la que se ejecuta de verdad contra la base.
import crypto from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { decryptAtRest, encryptAtRest } from '../payments/encryption';
import { cifrarDatos, descifrarDatos } from './firma';

const original = process.env.ENCRYPTION_KEY;

function conClave<T>(clave: string, fn: () => T): T {
  process.env.ENCRYPTION_KEY = clave;
  return fn();
}

afterEach(() => {
  if (original === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = original;
});

const CLAVE_VIEJA = crypto.randomBytes(32).toString('hex');
const CLAVE_NUEVA = crypto.randomBytes(32).toString('hex');

const DATOS = {
  propietario_nombre: 'Marta Salgado',
  propietario_cedula: '1712345678',
  propietario_correo: 'marta@ejemplo.test',
  precioSalida: '185000',
};

describe('rotación de ENCRYPTION_KEY', () => {
  it('recifrar de una clave a otra conserva el contenido exacto', () => {
    const conVieja = conClave(CLAVE_VIEJA, () => cifrarDatos(DATOS));

    // Lo que hace el script: abrir con la vieja, cerrar con la nueva.
    const claro = conClave(CLAVE_VIEJA, () => decryptAtRest(conVieja));
    const conNueva = conClave(CLAVE_NUEVA, () => encryptAtRest(claro));

    expect(conClave(CLAVE_NUEVA, () => descifrarDatos(conNueva))).toEqual(DATOS);
  });

  it('el texto cifrado cambia aunque el contenido sea el mismo', () => {
    const conVieja = conClave(CLAVE_VIEJA, () => cifrarDatos(DATOS));
    const claro = conClave(CLAVE_VIEJA, () => decryptAtRest(conVieja));
    const conNueva = conClave(CLAVE_NUEVA, () => encryptAtRest(claro));
    expect(conNueva).not.toBe(conVieja);
  });

  // EL PELIGRO. Si esto alguna vez empieza a lanzar, es una buena noticia y
  // hay que actualizar el test; mientras tanto, queda documentado que no lo hace.
  it('cambiar la clave sin recifrar NO da error: devuelve un objeto vacío', () => {
    const conVieja = conClave(CLAVE_VIEJA, () => cifrarDatos(DATOS));
    const leidoConLaNueva = conClave(CLAVE_NUEVA, () => descifrarDatos(conVieja));

    expect(leidoConLaNueva).toEqual({});
    expect(leidoConLaNueva.propietario_nombre).toBeUndefined();
  });

  it('la capa de cifrado sí lanza: el silencio lo añade descifrarDatos', () => {
    const conVieja = conClave(CLAVE_VIEJA, () => cifrarDatos(DATOS));
    expect(() => conClave(CLAVE_NUEVA, () => decryptAtRest(conVieja))).toThrow();
  });

  it('una clave en hexadecimal y la misma frase en texto NO son la misma clave', () => {
    const hex = crypto.randomBytes(32).toString('hex');
    const cifrado = conClave(hex, () => cifrarDatos(DATOS));
    // Derivar la frase con SHA-256 da 32 bytes distintos de los 32 del hex.
    expect(conClave(`clave: ${hex}`, () => descifrarDatos(cifrado))).toEqual({});
  });
});
