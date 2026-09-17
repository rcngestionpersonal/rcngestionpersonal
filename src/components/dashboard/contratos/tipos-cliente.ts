import type { BloqueFinal, CambiosEntreVersiones, ClausulaEditable, EdicionClausulas } from '@/lib/real-estate/contratos/clausulas';
import type { ContratoEstado, ContratoTipo, ParteEstado, VersionEstado } from '@/lib/real-estate/contratos/tipos';

// Formas que viajan entre las rutas de contratos y la pantalla del agente.

export type ParteResumen = {
  id: string;
  rol: string;
  rolEtiqueta?: string;
  // Quien aprueba (en una compañía, su representante).
  nombre: string;
  // Cómo figura la parte: la persona o la compañía.
  nombreParte?: string;
  correo: string;
  estado: ParteEstado;
  enviadoAt: string | null;
  abiertoAt: string | null;
  aprobadoAt: string | null;
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
  // Tipo retirado: se puede abrir y descargar, pero no editar ni enviar.
  archivado?: boolean;
  // De la etapa de firma electrónica, retirada.
  deFirma?: boolean;
  estado: ContratoEstado;
  listingId: string | null;
  codigoVerificacion: string;
  versionActual: number;
  createdAt: string;
  enviadoAt: string | null;
  aprobadoAt: string | null;
  firmadoAt: string | null;
  anuladoAt: string | null;
  anuladoNota: string | null;
  // Partes de la versión vigente.
  partes: ParteResumen[];
};

export type VersionResumen = {
  numero: number;
  estado: VersionEstado;
  enviadaAt: string;
  aprobadaAt: string | null;
  cerradaAt: string | null;
  huella: string;
  resultado: string;
  cambios: CambiosEntreVersiones | null;
  partes: ParteResumen[];
};

export type ContratoCompleto = ContratoResumen & {
  editable: boolean;
  plantillaVersion: string;
  datos: Record<string, string>;
  inmueble: { descripcion: string; ubicacion: string };
  versiones: VersionResumen[];
  cambiosSinEnviar: CambiosEntreVersiones | null;
};

export type DocumentoTrabajo = {
  editable: boolean;
  admiteEdicion: boolean;
  nombreDocumento: string;
  ciudad: string;
  fechaLarga: string;
  clausulas: ClausulaEditable[];
  edicion: EdicionClausulas;
  bloques: BloqueFinal[];
  versionActual: number;
  cambiosSinEnviar: CambiosEntreVersiones | null;
  faltantes: string[];
  avisoWord: string;
};

export type ListingOpcion = {
  id: string;
  title: string;
  propertyType: string;
  operationType: string;
  city: string;
  zone: string | null;
  address: string | null;
  price: number;
  ownerName: string | null;
  ownerPhone: string | null;
};

// Cada documento versiona su plantilla por separado: el módulo no tiene "una
// versión" sino una por tipo.
export type PlantillaVigente = { tipo: ContratoTipo; version: string; revisada: boolean };

export type DatosPantallaContratos = {
  contratos: ContratoResumen[];
  listings: ListingOpcion[];
  agente: { nombre: string; empresa: string | null; tieneCedula: boolean; tieneDireccion: boolean; tieneCorreo: boolean };
  plantilla: { aviso: string; versiones: PlantillaVigente[] };
};
