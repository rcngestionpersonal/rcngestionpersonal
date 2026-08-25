// Configuracion neutral de suscripcion/facturacion, independiente de cualquier
// pasarela de pago especifica. Tanto el adaptador de Payphone (activo) como el
// de PayPal (inactivo, ver payments/paypal.ts) importan de aqui - ninguno de
// los dos debe redefinir estos valores por su cuenta.

// Fuente unica de verdad para la duracion del trial gratuito - nunca hardcodear
// el numero de dias en otro archivo, siempre importar de aqui.
export const TRIAL_DAYS = 30;

// Duracion del periodo pagado que habilita cada cobro exitoso de la Cajita de
// Payphone (un cobro unico, no una suscripcion recurrente real - ver
// payments/payphone.ts). Hoy coincide numericamente con TRIAL_DAYS pero es un
// concepto distinto (ciclo de facturacion mensual vs. duracion del trial), por
// eso su propia constante en vez de reusar TRIAL_DAYS.
export const BILLING_CYCLE_DAYS = 30;

export function getBillingCycleMs(): number {
  return BILLING_CYCLE_DAYS * 24 * 60 * 60 * 1000;
}

// Precio base (sin impuestos) del plan mensual, en USD.
export const PRICE_USD = 8.99;

// IVA vigente en Ecuador. Si cambia, este es el unico lugar que hay que tocar.
export const TAX_RATE = 0.15;

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

export function getPriceAmountUsd(): number {
  return PRICE_USD;
}

export function getTaxAmountUsd(): number {
  return Math.round(PRICE_USD * TAX_RATE * 100) / 100;
}

export function getPriceWithTaxUsd(): number {
  return Math.round((PRICE_USD + getTaxAmountUsd()) * 100) / 100;
}

export type CheckoutAmountsCents = {
  amount: number;
  amountWithoutTax: number;
  amountWithTax: number;
  tax: number;
  service: number;
  tip: number;
};

// Mismos montos, en centavos (formato que exige el widget de pago de
// Payphone) - un solo lugar para no repetir la aritmetica de centavos en el
// cliente y en el servidor.
export function getCheckoutAmountsInCents(): CheckoutAmountsCents {
  const amountWithTax = Math.round(PRICE_USD * 100);
  const tax = Math.round(getTaxAmountUsd() * 100);
  return {
    amount: amountWithTax + tax,
    amountWithoutTax: 0,
    amountWithTax,
    tax,
    service: 0,
    tip: 0,
  };
}

export type PaymentProvider = 'PAYPHONE' | 'PAYPAL';

// Selector de proveedor de pago activo. Hoy siempre Payphone (unico mercado:
// Ecuador). PayPal queda como adaptador inactivo detras de este selector,
// listo para reactivarse el dia que Redinmo opere agentes fuera de Ecuador -
// ver src/lib/real-estate/payments/paypal.ts.
export function getActivePaymentProvider(): PaymentProvider {
  return 'PAYPHONE';
}
