import type { Periodicidad, ReaccionVisita } from '@/lib/real-estate/reportes/tipos';

// Formas que viajan entre las rutas de reportes y la pantalla.

export type InmuebleReporte = {
  id: string;
  title: string;
  propertyType: string;
  operationType: string;
  city: string;
  zone: string | null;
  status: string;
  price: number;
  currency: string;
  areaM2: number | null;
  coverPhotoUrl: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
};

export type VisitaResumen = {
  id: string;
  listingId: string;
  visitadaAt: string;
  reaccion: ReaccionVisita;
  visitanteNombre: string;
  foto: { redes: boolean } | null;
  enviadoAt: string | null;
};

export type VisitaCompleta = VisitaResumen & {
  inmueble: string;
  duracionMinutos: number | null;
  visitanteCedula: string | null;
  acompanantes: string | null;
  observaciones: string | null;
  objeciones: string | null;
  proximoPaso: string | null;
  paleta: string;
  enviadoA: string | null;
};

export type GestionResumen = {
  id: string;
  listingId: string;
  periodicidad: Periodicidad;
  periodoDesde: string;
  periodoHasta: string;
  enviadoAt: string | null;
  enviadoA: string | null;
};

export type DatosPantallaReportes = {
  inmuebles: InmuebleReporte[];
  visitas: VisitaResumen[];
  gestiones: GestionResumen[];
  tieneCorreo: boolean;
};
