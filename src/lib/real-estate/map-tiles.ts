// Teselas de mapa (Fase 5, seccion 8): un unico proveedor gratuito y sin API key -
// OpenStreetMap raster - para no generar costo por carga a nuestro volumen de trafico
// proyectado (seccion 2.1 del pedido: nunca Google Maps). Probamos CARTO Dark Matter
// para el tema oscuro, pero su endpoint publico (basemaps.cartocdn.com) ahora exige
// API key y sirve teselas de placeholder ("API KEY REQUIRED") sin ella - por eso el
// tema oscuro usa un filtro CSS sobre las MISMAS teselas claras en vez de un segundo
// proveedor, tal como habilita explicitamente la seccion 8 del pedido ("una capa de
// teselas oscura O UN FILTRO que no queme la vista").
export function tileLayerConfig(): { url: string; attribution: string } {
  return {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  };
}

// Filtro CSS aplicado al panel de teselas (no al mapa completo, para que pines/popups/
// controles conserven sus propios colores) que invierte y re-rota el matiz: el fondo
// claro se vuelve oscuro sin quemar la vista, y el agua/vegetacion no quedan con colores
// invertidos absurdos (naranja en vez de azul, etc.).
export const DARK_TILE_FILTER = 'invert(1) hue-rotate(180deg) brightness(0.94) contrast(0.88) saturate(0.9)';
