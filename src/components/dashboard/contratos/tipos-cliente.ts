import type { ContratoEstado, ContratoTipo, FirmanteEstado } from '@/lib/real-estate/contratos/tipos';

// Formas que viajan entre las rutas de contratos y la pantalla del agente.

export type FirmanteResumen = {
  id: string;
  rol: string;
  rolEtiqueta?: string;
  nombre: string;
  correo: string;
  estado: FirmanteEstado;
  enviadoAt: string | null;
  abiertoAt: string | null;
  firmadoAt: string | null;
  rechazadoAt: string | null;
  motivoRechazo: string | null;
  expiraAt: string;
};

export type ContratoResumen = {
  id: string;
  tipo: ContratoTipo;
  estado: ContratoEstado;
  listingId: string | null;
  codigoVerificacion: string;
  createdAt: string;
  enviadoAt: string | null;
  firmadoAt: string | null;
  anuladoAt: string | null;
  anuladoNota: string | null;
  firmantes: FirmanteResumen[];
};

export type ContratoCompleto = ContratoResumen & {
  plantillaVersion: string;
  datos: Record<string, string>;
  inmueble: { descripcion: string; ubicacion: string };
};

export type ListingOpcion = {
  id: string;
  title: string;
  propertyType: string;
  city: string;
  zone: string | null;
};

export type DatosPantallaContratos = {
  contratos: ContratoResumen[];
  listings: ListingOpcion[];
  agente: { nombre: string; tieneCedula: boolean; tieneDireccion: boolean; tieneCorreo: boolean };
  plantilla: { version: string; revisada: boolean; aviso: string };
};
