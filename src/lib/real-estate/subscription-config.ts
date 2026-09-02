// Configuracion neutral de suscripcion/facturacion, independiente de cualquier
// pasarela de pago especifica y del plan elegido (para precios y features por
// plan ver src/config/planes.ts). Tanto el adaptador de Payphone (activo) como
// el de PayPal (inactivo, ver payments/paypal.ts) importan de aqui - ninguno
// de los dos debe redefinir estos valores por su cuenta.

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

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

// Monto minimo para re-tokenizar una tarjeta sin que el agente este al dia
// de pago (pedido de recurrencias, seccion 7: "Cambiar tarjeta ... si esta
// al dia, usa el monto minimo que Payphone permita para generar el token
// nuevo"). Payphone no publica un minimo exacto en su documentacion - $1.00
// es un valor nominal conservador (claramente no es el precio del plan, asi
// el agente entiende que es solo para validar la tarjeta) elegido a falta de
// ese dato; ajustar aca si Payphone confirma un minimo distinto o rechaza
// este monto en la practica.
export const CARD_UPDATE_MIN_CENTS = 100;

export type PaymentProvider = 'PAYPHONE' | 'PAYPAL';

// Selector de proveedor de pago activo. Hoy siempre Payphone (unico mercado:
// Ecuador). PayPal queda como adaptador inactivo detras de este selector,
// listo para reactivarse el dia que Redinmo opere agentes fuera de Ecuador -
// ver src/lib/real-estate/payments/paypal.ts.
export function getActivePaymentProvider(): PaymentProvider {
  return 'PAYPHONE';
}
