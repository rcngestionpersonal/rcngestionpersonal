// encryptCardHolder(): la documentacion de Payphone (docs.payphone.app/
// tokenizacion) no publica un vector de prueba (nombre+clave+cifrado
// esperado), solo el algoritmo ("AES 256 CBC sin IV") y ejemplos en PHP/
// CryptoJS con valores de relleno. Se valida cruzando el resultado contra
// `openssl enc -aes-256-cbc` (el mismo primitivo que PHP's openssl_encrypt
// llama por debajo) con la clave/IV derivadas a mano, no contra un ejemplo
// oficial porque no existe. Ademas se prueban isCardChangeClientTransactionId/
// buildBillToFromAgent, que no tocan la red ni la base.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  buildBillToFromAgent,
  buildCardChangeClientTransactionId,
  buildClientTransactionId,
  encryptCardHolder,
  isCardChangeClientTransactionId,
  parseAgentIdFromClientTransactionId,
  parsePlanFromClientTransactionId,
} from './payphone';

function opensslEncryptReference(plaintext: string, codingPassword: string): string {
  const key = Buffer.alloc(32);
  Buffer.from(codingPassword, 'utf8').copy(key);
  const ivHex = '0'.repeat(32);
  const out = execFileSync(
    'openssl',
    ['enc', '-aes-256-cbc', '-K', key.toString('hex'), '-iv', ivHex, '-nosalt', '-base64', '-A'],
    { input: plaintext },
  );
  return out.toString('utf8').trim();
}

describe('encryptCardHolder', () => {
  it.each([
    ['Juan Perez', 'coding_password_123'],
    ['Maria Jose Alvarez Suarez', 'x'],
    ['A', 'thisIsExactlyThirtyTwoBytesLong!'], // clave de 32 bytes exactos - sin relleno ni truncado
    ['Ñañez Núñez José', 'clave-con-utf8'], // acentos/enye - confirma que el charset UTF-8 se preserva
  ])('matches independent AES-256-CBC/openssl reference for %s', (name, pass) => {
    expect(encryptCardHolder(name, pass)).toBe(opensslEncryptReference(name, pass));
  });

  it('is deterministic (same name+key always produce the same ciphertext, so it can be reused on every recurring charge)', () => {
    const a = encryptCardHolder('Roberto Tapia', 'clave');
    const b = encryptCardHolder('Roberto Tapia', 'clave');
    expect(a).toBe(b);
  });
});

describe('clientTransactionId helpers', () => {
  it('round-trips agentId and plan through buildClientTransactionId', () => {
    const id = buildClientTransactionId('agent123', 'PRO');
    expect(parseAgentIdFromClientTransactionId(id)).toBe('agent123');
    expect(parsePlanFromClientTransactionId(id)).toBe('PRO');
  });

  it('marks card-change transactions distinctly from plan purchases', () => {
    const changeId = buildCardChangeClientTransactionId('agent123');
    expect(isCardChangeClientTransactionId(changeId)).toBe(true);
    expect(parsePlanFromClientTransactionId(changeId)).toBeNull(); // "CARDCHANGE" is not a valid PlanTipo
    expect(parseAgentIdFromClientTransactionId(changeId)).toBe('agent123');

    const normalId = buildClientTransactionId('agent123', 'BASICO');
    expect(isCardChangeClientTransactionId(normalId)).toBe(false);
  });

  it('stays under Payphone\'s 50-character clientTransactionId limit for a realistic cuid-length agent id', () => {
    // Un cuid de Prisma real mide 25 caracteres (p.ej. "cmtkg1udp0000cprfm8gtuhft")
    // - buildClientTransactionId NO trunca, asi que si un id de agente mas
    // largo alguna vez apareciera, este test dejaria de pasar y avisaria
    // antes de que Payphone lo rechace en produccion.
    const id = buildClientTransactionId('cmtkg1udp0000cprfm8gtuhft', 'BASICO');
    expect(id.length).toBeLessThanOrEqual(50);
  });
});

describe('buildBillToFromAgent', () => {
  it('splits full name into first/last and defaults missing address fields to Ecuador', () => {
    const billTo = buildBillToFromAgent({ fullName: 'Maria Jose Alvarez' }, '5.6.7.8');
    expect(billTo.firstName).toBe('Maria');
    expect(billTo.lastName).toBe('Jose Alvarez');
    expect(billTo.country).toBe('EC');
    expect(billTo.state).toBe('Pichincha');
    expect(billTo.locality).toBe('Quito');
    expect(billTo.ipAddress).toBe('5.6.7.8');
  });

  it('prefers the agent\'s own address fields when present', () => {
    const billTo = buildBillToFromAgent(
      { fullName: 'Ana Gomez', direccion: 'Av. Amazonas', ciudad: 'Cuenca', provincia: 'Azuay', codigoPostal: '010101' },
      '1.1.1.1',
    );
    expect(billTo.address1).toBe('Av. Amazonas');
    expect(billTo.locality).toBe('Cuenca');
    expect(billTo.state).toBe('Azuay');
    expect(billTo.postalCode).toBe('010101');
  });

  it('handles a single-word name without throwing', () => {
    const billTo = buildBillToFromAgent({ fullName: 'Cher' }, '1.2.3.4');
    expect(billTo.firstName).toBe('Cher');
    expect(billTo.lastName).toBe('Cher');
  });
});
