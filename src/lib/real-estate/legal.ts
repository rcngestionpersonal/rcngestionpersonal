// Constantes compartidas por las 4 paginas de /legal/* y por los puntos de
// consentimiento que las referencian (registro, checkout de suscripcion,
// fase de cierre 2.3). Centralizar la identidad legal y las versiones aca
// evita que un dato quede desactualizado en una pagina y corregido en otra.
//
// LEGAL_ENTITY tiene datos placeholder que un abogado/el dueño del negocio
// debe completar antes de publicar (ver el punto 2.2.a del pedido: razon
// social, RUC, domicilio y representante legal son obligatorios en los
// Terminos, y Payphone los pide tal cual en su formulario de tokenizacion,
// seccion 2.5). Buscar "COMPLETAR" en este archivo para encontrar los
// pendientes.
export const LEGAL_ENTITY = {
  razonSocial: '[RAZÓN SOCIAL — COMPLETAR]',
  ruc: '[RUC — COMPLETAR]',
  nombreComercial: 'Redinmo',
  domicilio: '[DOMICILIO FISCAL — COMPLETAR]',
  representanteLegal: '[REPRESENTANTE LEGAL — COMPLETAR]',
  correoContacto: 'notificaciones@redinmo.io',
  sitioWeb: 'https://redinmo.io',
};

// Fecha de la ultima revision sustancial de cada politica - se muestra en la
// pagina y es lo que se guarda como "version aceptada" en Agent.termsAcceptedVersion
// (registro) y, para el consentimiento de tokenizacion, ya viaja aparte como
// texto literal en SubscriptionEvent (ver CONSENT_TEXT en
// api/subscription/checkout/route.ts). Actualizar esta fecha cuando el
// contenido de la pagina correspondiente cambie de forma sustancial - eso es
// lo que dispara, a futuro, que los agentes activos deban volver a aceptar
// (punto 2.3.3 del pedido; el mecanismo de re-aceptacion forzada todavia no
// esta construido, ver el resumen de la fase de cierre).
export const LEGAL_VERSIONS = {
  terminos: '2026-09-02',
  privacidad: '2026-09-02',
  suscripcion: '2026-09-02',
  cookies: '2026-09-02',
};

export const TERMS_VERSION = LEGAL_VERSIONS.terminos;
