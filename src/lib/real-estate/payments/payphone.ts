// Adaptador de Payphone - proveedor de pago activo (unico mercado: Ecuador).
//
// Integra la "Cajita de Pagos" (widget embebido, tarjeta + saldo Payphone) via
// https://docs.payphone.app/cajita-de-pagos. El widget en si corre 100% en el
// cliente (PayphoneCheckoutBox.tsx); este modulo solo cubre la parte
// server-side: confirmar la transaccion contra la API de Payphone despues de
// que el usuario vuelve del pago, y los helpers para armar/leer el
// clientTransactionId que identifica a que agente pertenece cada pago.
import crypto from 'crypto';
import { getCheckoutAmountsInCents, isPlanTipo, type PlanTipo } from '@/config/planes';

const PAYPHONE_CONFIRM_URL = 'https://paymentbox.payphonetodoesposible.com/api/confirm';

// Cifra el nombre del titular para el campo `cardHolder` de un cobro
// tokenizado (https://docs.payphone.app/tokenizacion): "AES 256 CBC sin
// vector de inicializacion", clave = la coding password de Payphone
// Developer, salida en base64. La documentacion solo da el algoritmo, no un
// vector de prueba (nombre+clave+cifrado esperado) - la implementacion se
// valido cruzando el resultado contra `openssl enc -aes-256-cbc` con la
// misma clave/IV derivadas a mano (ver payphone.test.mjs), no contra un
// ejemplo oficial porque no existe.
//
// Replica exactamente lo que hacen los dos ejemplos oficiales (PHP con
// openssl_encrypt() e IV "", CryptoJS con iv vacio) una vez se resuelven sus
// comportamientos por defecto, no lo que dicen literalmente:
// - Clave: openssl_encrypt trunca una clave mas larga que 32 bytes y rellena
//   con \0 una mas corta - Buffer.alloc(32) + copy() hace exactamente eso.
// - IV: un IV vacio no es valido para CBC (exige 16 bytes); tanto PHP como
//   CryptoJS lo resuelven internamente como 16 bytes en cero (por eso el PHP
//   de la doc silencia E_NOTICE/E_WARNING: ese es el warning que tapan).
export function encryptCardHolder(cardHolderName: string, codingPassword: string): string {
  const key = Buffer.alloc(32);
  Buffer.from(codingPassword, 'utf8').copy(key);
  const iv = Buffer.alloc(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([cipher.update(cardHolderName, 'utf8'), cipher.final()]).toString('base64');
}

// Arma los datos listos para guardar en PaymentMethod a partir de la
// respuesta de /api/confirm y el ctoken (que llega por separado, en la URL
// de retorno - ver seccion 3.3 del pedido). Devuelve null si falta cualquier
// dato imprescindible: mejor no tokenizar este mes que guardar un
// PaymentMethod a medias que despues rompa un cobro (seccion 3.8, "el
// sistema debe funcionar sin tokenizacion" - esto incluye el caso donde
// Payphone confirma el pago pero no manda todo lo necesario para tokenizar).
export function buildPaymentMethodDataFromConfirm(input: {
  ctoken: string | null;
  confirmResult: PayphoneConfirmResult;
  codingPassword: string;
}): {
  cardHolderEnc: string;
  brand: string;
  lastDigits: string;
  bin: string | null;
  email: string;
  phoneNumber: string;
  documentId: string;
} | null {
  const { ctoken, confirmResult, codingPassword } = input;
  if (!ctoken) return null;
  const { email, phoneNumber, document, optionalParameter4, cardBrand, lastDigits } = confirmResult;
  if (!email || !phoneNumber || !document || !optionalParameter4 || !cardBrand || !lastDigits) {
    return null;
  }
  return {
    cardHolderEnc: encryptCardHolder(optionalParameter4, codingPassword),
    brand: cardBrand,
    lastDigits,
    bin: confirmResult.bin ?? null,
    email,
    phoneNumber,
    documentId: document,
  };
}

// Arma el `order.billTo` que exige un cobro tokenizado (seccion 1, punto 7
// del pedido: "el objeto order es obligatorio") a partir de los datos de
// perfil del agente (unico mercado: Ecuador, country siempre 'EC'). Todos los
// campos de direccion de Agent son opcionales (se cargan en "Editar perfil",
// no en el registro) - donde falten se manda un valor neutro en vez de
// fallar el cobro por un dato que ni siquiera es el titular de la tarjeta
// verificando (eso ya lo hizo Payphone al aprobar la primera transaccion).
export function buildBillToFromAgent(agent: {
  fullName: string;
  direccion?: string | null;
  referenciaDireccion?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  codigoPostal?: string | null;
}, ipAddress: string) {
  const [firstName, ...rest] = agent.fullName.trim().split(/\s+/);
  return {
    firstName: firstName || agent.fullName,
    lastName: rest.join(' ') || firstName || agent.fullName,
    address1: agent.direccion?.trim() || agent.ciudad?.trim() || 'Ecuador',
    address2: agent.referenciaDireccion?.trim() || '',
    country: 'EC',
    state: agent.provincia?.trim() || agent.ciudad?.trim() || 'Pichincha',
    locality: agent.ciudad?.trim() || 'Quito',
    postalCode: agent.codigoPostal?.trim() || '000000',
    ipAddress,
  };
}

export function isPayphoneConfigured(): boolean {
  return Boolean(process.env.PAYPHONE_TOKEN && process.env.NEXT_PUBLIC_PAYPHONE_TOKEN);
}

// El clientTransactionId es el unico dato que Payphone nos devuelve intacto al
// confirmar - codificamos adentro tanto el agentId como el plan elegido (en
// vez de mantener una tabla aparte). Esto importa especialmente para el plan:
// la URL a la que Payphone redirige de vuelta se configura una vez en su
// dashboard (no por request), asi que un ?plan= en la URL de checkout NO
// sobrevive el viaje de ida y vuelta - el clientTransactionId si.
export function buildClientTransactionId(agentId: string, plan: PlanTipo): string {
  return `${agentId}::${plan}::${Date.now()}`;
}

export function parseAgentIdFromClientTransactionId(clientTransactionId: string): string | null {
  const [agentId] = clientTransactionId.split('::');
  return agentId || null;
}

export function parsePlanFromClientTransactionId(clientTransactionId: string): PlanTipo | null {
  const [, plan] = clientTransactionId.split('::');
  return isPlanTipo(plan) ? plan : null;
}

// "Cambiar tarjeta" estando al dia (seccion 7 del pedido de recurrencias)
// cobra un monto NOMINAL solo para obtener un token nuevo - no es un pago de
// plan, y el monto no va a coincidir con isExpectedCheckoutAmount(). Se
// marca con "CARDCHANGE" en el segundo segmento (donde normalmente va el
// plan) para que /billing/payphone/confirm lo detecte ANTES de validar el
// monto contra el precio del plan, y tome la rama que solo reemplaza el
// PaymentMethod sin tocar Agent.subscriptionPaidUntil ni crear una
// Transaccion (seria enganoso registrar "pagaste tu plan" por $1).
const CARD_CHANGE_MARKER = 'CARDCHANGE';

export function buildCardChangeClientTransactionId(agentId: string): string {
  return `${agentId}::${CARD_CHANGE_MARKER}::${Date.now()}`;
}

export function isCardChangeClientTransactionId(clientTransactionId: string): boolean {
  const [, marker] = clientTransactionId.split('::');
  return marker === CARD_CHANGE_MARKER;
}

// Los campos de card/titular (phoneNumber, document, optionalParameter4,
// lastDigits, bin) no estan en la documentacion publica de Payphone con un
// ejemplo de respuesta completo - cardBrand ya se usaba aca antes de esta
// tarea (alguien lo debe haber confirmado contra una respuesta real). Se
// agregan como opcionales a proposito: si en produccion no vienen, el codigo
// que guarda el PaymentMethod (route.ts del checkout) debe tratarlo igual
// que "no llego ctoken" (seccion 3.8 del pedido: el sistema sigue
// funcionando sin tokenizacion) en vez de asumir que existen.
export type PayphoneConfirmResult = {
  transactionStatus: 'Approved' | 'Canceled' | 'Pending' | string;
  statusCode: number;
  authorizationCode?: string;
  transactionId: number;
  clientTransactionId: string;
  amount: number;
  email?: string;
  cardBrand?: string;
  currency?: string;
  phoneNumber?: string;
  document?: string;
  optionalParameter4?: string;
  lastDigits?: string;
  bin?: string;
};

// Debe ejecutarse dentro de los primeros 5 minutos tras el pago - pasado ese
// tiempo Payphone revierte la transaccion automaticamente (ver docs).
export async function confirmPayphoneTransaction(input: { id: number; clientTransactionId: string }): Promise<PayphoneConfirmResult> {
  const token = process.env.PAYPHONE_TOKEN;
  if (!token) {
    throw new Error('PAYPHONE_TOKEN no esta configurado.');
  }

  const response = await fetch(PAYPHONE_CONFIRM_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: input.id, clientTxId: input.clientTransactionId }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`No se pudo confirmar el pago con Payphone: ${detail.slice(0, 300)}`);
  }

  return (await response.json()) as PayphoneConfirmResult;
}

// Verifica que lo efectivamente cobrado coincida con el precio esperado del
// plan elegido - una defensa simple contra una respuesta de Payphone
// manipulada o desactualizada antes de activar la suscripcion. `founderTotalCents`
// (Fase 7, seccion 9.4) permite aceptar el precio fundador congelado del
// agente como alternativa valida al precio vigente, solo para Basico.
export function isExpectedCheckoutAmount(amountCents: number, plan: PlanTipo, founderTotalCents?: number | null): boolean {
  return amountCents === getCheckoutAmountsInCents(plan, founderTotalCents).amount;
}
