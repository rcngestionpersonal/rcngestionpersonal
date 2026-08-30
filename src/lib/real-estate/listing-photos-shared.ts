// Constante compartida entre cliente y servidor (Fase 4) - vive en su propio
// archivo sin dependencias para poder importarla desde componentes de
// cliente sin arrastrar mock-store.ts (que si tiene dependencias de
// servidor).
export const MAX_LISTING_PHOTOS = 8;
