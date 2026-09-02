// Abstraccion de pasarela de pago para el cobro recurrente (seccion 9 del
// pedido: "define una interfaz PaymentGateway con dos implementaciones").
// El cron de facturacion (paso 5) SIEMPRE cobra a traves de esta interfaz,
// nunca llamando a Payphone directo - asi la bateria de pruebas (paso 9)
// puede forzar rechazos, errores de red y timeouts con FakeGateway, algo que
// el ambiente de pruebas real de Payphone no permite (aprueba todo, seccion
// 1, punto 10 del pedido).
import crypto from 'crypto';

export type ChargeRequest = {
  cardToken: string;
  // Ya cifrado para Payphone (encryptCardHolder ya aplicado) - se reenvia tal
  // cual, nunca se re-cifra por intento (ver payphone.ts).
  cardHolderEnc: string;
  documentId: string;
  phoneNumber: string;
  email: string;
  amounts: {
    amount: number;
    amountWithoutTax: number;
    amountWithTax: number;
    tax: number;
    service: number;
    tip: number;
  };
  clientTransactionId: string;
  reference: string;
  billTo: {
    firstName: string;
    lastName: string;
    address1: string;
    address2: string;
    country: string;
    state: string;
    locality: string;
    postalCode: string;
    ipAddress: string;
  };
};

export type ChargeResult = {
  approved: boolean;
  statusCode: number;
  transactionId: number | null;
  authorizationCode: string | null;
  responseCode: string | null;
  responseMessage: string | null;
  raw: unknown;
  // true unicamente cuando Payphone respondio errorCode 23 ("ya existe una
  // transaccion con este ClientTransactionId", ver codigos-de-error): es la
  // señal de que un intento anterior con el MISMO id (reintentado tras un
  // timeout, ver buildRecurringClientTransactionId) ya llego a Payphone. No
  // es lo mismo que aprobado ni que rechazado - amerita revision manual
  // porque no sabemos cual de los dos fue sin consultar Payphone Business a
  // mano (no hay endpoint de consulta por id, ver nota en gateway.ts).
  duplicate?: boolean;
};

// error de red/timeout a medio cobro (seccion 9, caso 5): distinto de un
// ChargeResult con approved:false - aca no sabemos que paso del lado de
// Payphone, mientras que approved:false es una respuesta real y clara
// (aprobado o rechazado). El llamador debe reaccionar distinto a cada uno:
// un ChargeUnknownError dice "consulta el estado antes de reintentar", un
// ChargeResult con approved:false dice "ya sabes que fue rechazado".
export class ChargeUnknownError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ChargeUnknownError';
  }
}

export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

const PAYPHONE_CHARGE_URL = 'https://pay.payphonetodoesposible.com/api/transaction/web';

// Adaptador real: cobra contra /transaction/web usando el ctoken guardado.
// A diferencia de la Cajita (Flujo A, 100% client-side), esto corre
// enteramente en el servidor - no hay widget, no hay redireccion, el agente
// ni se entera de que corrio salvo por la notificacion (paso 7).
export class PayphoneGateway implements PaymentGateway {
  constructor(private readonly token: string, private readonly storeId?: string) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const body = {
      cardHolder: request.cardHolderEnc,
      cardToken: request.cardToken,
      documentId: request.documentId,
      phoneNumber: request.phoneNumber,
      email: request.email,
      amount: request.amounts.amount,
      amountWithoutTax: request.amounts.amountWithoutTax,
      amountWithTax: request.amounts.amountWithTax,
      tax: request.amounts.tax,
      service: request.amounts.service,
      tip: request.amounts.tip,
      clientTransactionId: request.clientTransactionId,
      currency: 'USD',
      ...(this.storeId ? { storeId: this.storeId } : {}),
      optionalParameter: request.reference,
      order: {
        billTo: {
          billToId: 1,
          address1: request.billTo.address1,
          address2: request.billTo.address2,
          country: request.billTo.country,
          state: request.billTo.state,
          locality: request.billTo.locality,
          firstName: request.billTo.firstName,
          lastName: request.billTo.lastName,
          phoneNumber: request.phoneNumber,
          email: request.email,
          postalCode: request.billTo.postalCode,
          ipAddress: request.billTo.ipAddress,
        },
        lineItems: [
          {
            productName: request.reference,
            unitPrice: request.amounts.amountWithTax,
            quantity: 1,
            totalAmount: request.amounts.amount,
            taxAmount: request.amounts.tax,
            productSKU: 'REDINMO-SUB',
            productDescription: request.reference,
          },
        ],
      },
    };

    let response: Response;
    try {
      response = await fetch(PAYPHONE_CHARGE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      // No hay respuesta en absoluto (red caida, timeout de fetch) - no
      // sabemos si Payphone alcanzo a procesar el cobro. Nunca se debe
      // interpretar esto como "rechazado" (seccion 9, caso 5).
      throw new ChargeUnknownError('No se pudo contactar a Payphone para el cobro.', err);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (err) {
      throw new ChargeUnknownError('Payphone respondio con un cuerpo invalido.', err);
    }

    if (!response.ok) {
      // errorCode 23 ("ya existe una transaccion con este ClientTransactionId")
      // es la unica respuesta de error que SI es informativa: significa que
      // un intento anterior con este mismo id (un reintento tras timeout, ver
      // buildRecurringClientTransactionId) ya llego a Payphone. No sabemos si
      // ese intento anterior fue aprobado o rechazado sin consultarlo a mano
      // (no hay endpoint de consulta por id), asi que se marca "duplicate"
      // para que el cron lo deje para revision en vez de asumir cualquiera
      // de los dos casos.
      const errorBody = json as { errorCode?: number; message?: string } | null;
      if (errorBody?.errorCode === 23) {
        return {
          approved: false,
          statusCode: -1,
          transactionId: null,
          authorizationCode: null,
          responseCode: '23',
          responseMessage: errorBody.message ?? 'ClientTransactionId duplicado',
          raw: json,
          duplicate: true,
        };
      }
      // Cualquier otro error HTTP (4xx/5xx) de la API de cobro tampoco es lo
      // mismo que "el banco rechazo la tarjeta" (eso llega como 200 +
      // statusCode=2, ver https://docs.payphone.app/codigos-de-error) - es un
      // fallo de la llamada en si, estado desconocido del lado del cobro real.
      throw new ChargeUnknownError(`Payphone devolvio HTTP ${response.status} al cobrar.`, json);
    }

    const parsed = json as {
      statusCode?: number;
      status?: string;
      transactionId?: number;
      authorizationCode?: string;
      messageCode?: number;
      message?: string;
    };
    const statusCode = parsed.statusCode ?? -1;
    return {
      approved: statusCode === 3,
      statusCode,
      transactionId: parsed.transactionId ?? null,
      authorizationCode: parsed.authorizationCode ?? null,
      responseCode: parsed.messageCode !== undefined ? String(parsed.messageCode) : null,
      responseMessage: parsed.status ?? parsed.message ?? null,
      raw: json,
    };
  }
}

// Adaptador falso para pruebas (seccion 9, punto 10 del pedido: "el ambiente
// de pruebas de Payphone aprueba todo, los rechazos solo se prueban con el
// falso"). `responder` decide el resultado por cada llamada - puede ser una
// funcion fija, una cola de resultados programados, o lanzar
// ChargeUnknownError para simular un timeout/red caida.
export class FakeGateway implements PaymentGateway {
  private readonly calls: ChargeRequest[] = [];

  constructor(
    private readonly responder: (request: ChargeRequest, callIndex: number) => ChargeResult | Promise<ChargeResult>,
  ) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const callIndex = this.calls.length;
    this.calls.push(request);
    return this.responder(request, callIndex);
  }

  get callCount(): number {
    return this.calls.length;
  }

  callAt(index: number): ChargeRequest | undefined {
    return this.calls[index];
  }
}

// Atajos comunes para armar un FakeGateway sin escribir la funcion a mano
// cada vez en las pruebas.
// El cron de cobro (paso 5) siempre pide el gateway por aca en vez de
// instanciar PayphoneGateway a mano - el dia que haya que inyectar un
// FakeGateway en una prueba automatizada, alcanza con mockear este modulo.
export function getPaymentGateway(): PaymentGateway {
  const token = process.env.PAYPHONE_TOKEN;
  if (!token) {
    throw new Error('PAYPHONE_TOKEN no esta configurado.');
  }
  return new PayphoneGateway(token, process.env.NEXT_PUBLIC_PAYPHONE_STORE_ID);
}

// clientTransactionId determinista para un cobro del cron (seccion 4, punto
// 3 del pedido): mismo subscriptionId+periodKey+attempt siempre produce el
// MISMO id. Esto es lo que hace posible reintentar con seguridad tras un
// timeout (seccion 9, caso 5): si Payphone SI llego a procesar el intento
// anterior, un reintento con el mismo id vuelve con el error 23 ("ya existe
// una transaccion con este ClientTransactionId", ver
// https://docs.payphone.app/codigos-de-error) en vez de cobrar dos veces.
// Maximo 50 caracteres (limite de Payphone) - un cuid de Prisma mide 25, asi
// que se usan los ultimos 12 (suficiente entropia para no colisionar entre
// suscripciones distintas) en vez del id completo.
export function buildRecurringClientTransactionId(subscriptionId: string, periodKey: string, attempt: number): string {
  const shortId = subscriptionId.slice(-12);
  return `RDNM-${shortId}-${periodKey}-${attempt}`.slice(0, 50);
}

export const FakeGatewayResults = {
  approved(transactionId = crypto.randomInt(1, 1_000_000)): ChargeResult {
    return {
      approved: true,
      statusCode: 3,
      transactionId,
      authorizationCode: `FAKE-${transactionId}`,
      responseCode: '0',
      responseMessage: 'Approved',
      raw: { fake: true },
    };
  },
  declined(reason = 'Fondos insuficientes'): ChargeResult {
    return {
      approved: false,
      statusCode: 2,
      transactionId: null,
      authorizationCode: null,
      responseCode: '2',
      responseMessage: reason,
      raw: { fake: true, reason },
    };
  },
};
