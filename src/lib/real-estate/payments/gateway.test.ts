// PaymentGateway/FakeGateway (pedido de recurrencias, seccion 9: "define una
// interfaz PaymentGateway con dos implementaciones... los rechazos solo se
// prueban con el falso" porque el ambiente de pruebas real de Payphone
// aprueba todo).
import { describe, expect, it } from 'vitest';
import { buildBillToFromAgent } from './payphone';
import { ChargeUnknownError, FakeGateway, FakeGatewayResults, type ChargeRequest } from './gateway';

function sampleRequest(clientTransactionId: string): ChargeRequest {
  return {
    cardToken: 'ctoken-fake',
    cardHolderEnc: 'enc-fake',
    documentId: '0999999999',
    phoneNumber: '+593999999999',
    email: 'a@b.com',
    amounts: { amount: 1034, amountWithoutTax: 0, amountWithTax: 899, tax: 135, service: 0, tip: 0 },
    clientTransactionId,
    reference: 'Suscripcion Redinmo Basico - septiembre 2026',
    billTo: buildBillToFromAgent({ fullName: 'Juan Perez' }, '1.2.3.4'),
  };
}

describe('FakeGateway', () => {
  it('returns an approved result shaped like a real Payphone approval (statusCode 3)', async () => {
    const gateway = new FakeGateway(() => FakeGatewayResults.approved(555));
    const result = await gateway.charge(sampleRequest('T1'));
    expect(result.approved).toBe(true);
    expect(result.statusCode).toBe(3);
    expect(result.transactionId).toBe(555);
  });

  it('returns a declined result shaped like a real Payphone decline (statusCode 2)', async () => {
    const gateway = new FakeGateway(() => FakeGatewayResults.declined('Fondos insuficientes'));
    const result = await gateway.charge(sampleRequest('T2'));
    expect(result.approved).toBe(false);
    expect(result.statusCode).toBe(2);
    expect(result.responseMessage).toBe('Fondos insuficientes');
  });

  it('propagates ChargeUnknownError for a simulated network timeout, never a fake "declined"', async () => {
    const gateway = new FakeGateway(() => {
      throw new ChargeUnknownError('timeout simulado');
    });
    await expect(gateway.charge(sampleRequest('T3'))).rejects.toBeInstanceOf(ChargeUnknownError);
  });

  it('tracks every call for assertions in higher-level tests (e.g. idempotency: same clientTransactionId reused on retry)', async () => {
    const gateway = new FakeGateway(() => FakeGatewayResults.approved());
    await gateway.charge(sampleRequest('T4a'));
    await gateway.charge(sampleRequest('T4b'));
    expect(gateway.callCount).toBe(2);
    expect(gateway.callAt(0)?.clientTransactionId).toBe('T4a');
    expect(gateway.callAt(1)?.clientTransactionId).toBe('T4b');
  });

  it('supports a scripted sequence of results (e.g. day-0 decline then day-3 approval)', async () => {
    const results = [FakeGatewayResults.declined('CVV invalido'), FakeGatewayResults.approved(777)];
    const gateway = new FakeGateway((_req, i) => results[i]);
    const first = await gateway.charge(sampleRequest('T5-attempt1'));
    const second = await gateway.charge(sampleRequest('T5-attempt2'));
    expect(first.approved).toBe(false);
    expect(second.approved).toBe(true);
    expect(second.transactionId).toBe(777);
  });
});
