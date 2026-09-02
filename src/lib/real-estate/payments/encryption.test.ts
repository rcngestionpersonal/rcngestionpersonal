// Cifrado en reposo del ctoken (AES-256-GCM, clave propia - distinta de la
// coding password de Payphone que usa encryptCardHolder, ver payphone.ts).
import crypto from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { decryptAtRest, encryptAtRest } from './encryption';

describe('encryptAtRest / decryptAtRest', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  });

  it('round-trips a ctoken back to its original value', () => {
    const token = 'ctoken_sample_1234567890abcdef';
    expect(decryptAtRest(encryptAtRest(token))).toBe(token);
  });

  it('rejects a tampered ciphertext instead of silently returning garbage', () => {
    const enc = encryptAtRest('ctoken_sample');
    const parts = enc.split(':');
    parts[2] = parts[2].slice(0, -1) + (parts[2].slice(-1) === '0' ? '1' : '0');
    expect(() => decryptAtRest(parts.join(':'))).toThrow();
  });

  it('rejects a tampered auth tag', () => {
    const enc = encryptAtRest('ctoken_sample');
    const parts = enc.split(':');
    parts[1] = parts[1].slice(0, -1) + (parts[1].slice(-1) === '0' ? '1' : '0');
    expect(() => decryptAtRest(parts.join(':'))).toThrow();
  });

  it('produces a different ciphertext each time (random IV), even for the same plaintext', () => {
    const a = encryptAtRest('same-token');
    const b = encryptAtRest('same-token');
    expect(a).not.toBe(b);
    expect(decryptAtRest(a)).toBe('same-token');
    expect(decryptAtRest(b)).toBe('same-token');
  });

  it('derives a 32-byte key via SHA-256 when ENCRYPTION_KEY is not 64 hex chars, instead of failing', () => {
    process.env.ENCRYPTION_KEY = 'a human-readable passphrase, not hex';
    const token = 'ctoken_sample';
    expect(decryptAtRest(encryptAtRest(token))).toBe(token);
  });

  it('throws a clear error when ENCRYPTION_KEY is missing, instead of silently using an insecure default', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptAtRest('x')).toThrow(/ENCRYPTION_KEY/);
  });
});
