// Constantes compartidas por las 4 paginas de /legal/* y por los puntos de
// consentimiento que las referencian (registro, checkout de suscripcion,
// fase de cierre 2.3). Centralizar la identidad legal y las versiones aca
// evita que un dato quede desactualizado en una pagina y corregido en otra.
//
// Datos aportados por el dueño del negocio. Son los mismos que Payphone pide
// en su formulario de tokenizacion (seccion 2.5 del pedido de cierre), asi
// que tienen que coincidir con lo que se declare ahi.
//
// El operador del servicio es una PERSONA NATURAL: el RUC 1710804954001 es
// una cedula (1710804954) + 001, formato de persona natural, no de sociedad.
// Por eso razonSocial es el nombre de la persona - que es la razon social
// ante el SRI y el unico sujeto de derecho que contrae las obligaciones de
// los Terminos. "Redinmo" es solo el nombre comercial bajo el cual se presta
// el servicio: NO debe aparecer nunca como la entidad que se obliga.
export const LEGAL_ENTITY = {
  razonSocial: 'Rigoberto Carrera Negrete',
  ruc: '1710804954001',
  nombreComercial: 'Redinmo.io',
  domicilio: 'Av. República del Salvador N36-109 y Suecia, Edificio Terrasol, Quito',
  representanteLegal: 'Rigoberto Carrera Negrete',
  telefonoContacto: '+593 96 870 7200',
  // Buzon dedicado de privacidad, distinto del remitente transaccional
  // (notificaciones@, que se usa para ENVIAR y cuyas respuestas nadie lee).
  // Es la direccion que /legal/privacidad publica para ejercer derechos
  // ARCO, asi que tiene que existir y estar atendida de verdad.
  correoContacto: 'privacidad@redinmo.io',
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
