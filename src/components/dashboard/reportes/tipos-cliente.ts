import type { DatosGestion, EntradaDifusion, Periodicidad, ReaccionVisita } from '@/lib/real-estate/reportes/tipos';
import type { DatosTasacion } from '@/lib/real-estate/reportes/tasacion-datos';

// El PDF congelado del primer envio, sin sus bytes.
export type DocumentoEnviado = { nombreArchivo: string; paleta: string; bytes: number; creadoAt: string };

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
  documento: DocumentoEnviado | null;
  propietario: string | null;
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
  tasaciones: TasacionResumen[];
  tieneCorreo: boolean;
};

export type TasacionResumen = {
  id: string;
  listingId: string | null;
  titulo: string;
  sector: string;
  enviadoAt: string | null;
  enviadoA: string | null;
  createdAt: string;
};

export type TasacionCompleta = TasacionResumen & { datos: DatosTasacion; paleta: string; documento: DocumentoEnviado | null };

export type GestionCompleta = GestionResumen & {
  inmueble: string;
  difusion: EntradaDifusion[];
  observaciones: string | null;
  datos: DatosGestion;
  paleta: string;
  documento: DocumentoEnviado | null;
  createdAt: string;
};

export type BorradorGestion = {
  periodicidad: Periodicidad;
  datos: DatosGestion;
  // Solo para el agente (punto 2.3): nunca va al documento.
  senal: { consultasPorSemana: number; promedioSector: number; similares: number } | null;
  difusion: EntradaDifusion[];
  observaciones: string;
  anterior: { id: string; periodoHasta: string } | null;
};
