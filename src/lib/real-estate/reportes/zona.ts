import { QUITO_ZONES, type QuitoZone } from '@/lib/real-estate/quito-zones';

// El inmueble y el Mapa de Cierres no hablan el mismo idioma de ubicacion:
// Listing.zone guarda el barrio que eligio el agente ("Bellavista",
// "Carcelén"), y ClosedDeal.zone guarda la zona del mapa ("CENTRO_NORTE"). Sin
// esta traduccion, ningun reporte encontraria jamas un cierre comparable.
//
// Se compara sin tildes ni mayusculas: "Carcelen" y "Carcelén" son el mismo
// barrio escrito por dos personas.

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export function zonaDelMapa(valor: string | null | undefined): QuitoZone | null {
  if (!valor) return null;
  const buscado = normalizar(valor);
  return (
    QUITO_ZONES.find(
      (z) =>
        normalizar(z.key) === buscado ||
        normalizar(z.labelEs) === buscado ||
        z.sectors.some((s) => normalizar(s) === buscado),
    ) ?? null
  );
}

// Todos los valores con los que un inmueble de esa zona puede estar guardado:
// la clave, el nombre y cada barrio. Sirve para buscar inmuebles similares.
export function valoresDeZona(zona: QuitoZone): string[] {
  return [zona.key, zona.labelEs, ...zona.sectors];
}
