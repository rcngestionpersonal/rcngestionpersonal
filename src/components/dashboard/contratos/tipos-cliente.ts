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
  // El servidor resuelve la etiqueta: la pantalla NO vuelve a buscar el tipo en
  // el catálogo. Si la base trae un tipo que este despliegue no conoce, la fila
  // se dibuja igual con un nombre genérico en vez de tumbar la lista entera.
  tipoEtiqueta: string;
  tipoConocido: boolean;
  // La fila no se pudo preparar y viene con lo mínimo. Se muestra marcada.
  ilegible?: boolean;
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

// Cada documento versiona su plantilla por separado (punto 1.4): el modulo ya
// no tiene "una version" sino una por tipo.
export type PlantillaVigente = { tipo: ContratoTipo; version: string; revisada: boolean };

export type DatosPantallaContratos = {
  contratos: ContratoResumen[];
  listings: ListingOpcion[];
  agente: { nombre: string; tieneCedula: boolean; tieneDireccion: boolean; tieneCorreo: boolean };
  plantilla: { revisada: boolean; aviso: string; versiones: PlantillaVigente[] };
  // Aviso de modelo referencial: si toca aceptarlo, no se genera nada hasta
  // que el agente lo acepte (punto 4.2.a).
  avisoLegal: { debeAceptar: boolean; aceptadoAt: string | null; version: string };
};
