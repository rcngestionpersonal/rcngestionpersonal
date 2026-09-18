import type { BloqueFinal, CambiosEntreVersiones, ClausulaEditable, EdicionClausulas } from '@/lib/real-estate/contratos/clausulas';
import type { PasoIndicador } from '@/lib/real-estate/contratos/flujo';
import type { ContratoEstado, ContratoTipo, Etapa, ParteEstado, VersionEstado } from '@/lib/real-estate/contratos/tipos';

// Formas que viajan entre las rutas de contratos y la pantalla del agente.

export type EnlaceCompartir = { url: string; mensaje: string; whatsapp: string; vencido: boolean };

export type ParteResumen = {
  id: string;
  rol: string;
  rolEtiqueta?: string;
  etapa?: Etapa;
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
  // Enlace vigente para compartirlo otra vez, si aún no decidió.
  enlace?: EnlaceCompartir | null;
  puedeRegenerar?: boolean;
  // Intentos con los últimos 4 dígitos de la cédula que no coincidieron, y si
  // el enlace quedó bloqueado por llegar al límite.
  intentosFallidos?: number;
  bloqueado?: boolean;
};

export type EtiquetasEtapas = Record<Etapa, string | null>;

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
  etiquetas?: EtiquetasEtapas | null;
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
  simultanea: boolean;
  principalHeredadaDe: number | null;
  contraparteEnviadaAt: string | null;
  principalAprobadaAt: string | null;
  etiquetas: EtiquetasEtapas;
  resultado: string;
  cambios: CambiosEntreVersiones | null;
  partes: ParteResumen[];
};

export type EventoResumen = {
  id: string;
  tipo: string;
  actor: 'AGENTE' | 'PARTE' | 'SISTEMA';
  fecha: string;
  fechaEcuador: string | null;
  etapa: Etapa | null;
  rolEtiqueta: string | null;
  versionNumero: number | null;
  huella: string | null;
  nombre: string | null;
  comentario: string | null;
  canal: 'whatsapp' | 'correo' | null;
  campos: string[] | null;
  nota: string | null;
  ip: string | null;
  navegador: string | null;
};

export type Lado = { clave: string; etiqueta: string };

export type ContratoCompleto = ContratoResumen & {
  editable: boolean;
  representa: string | null;
  lados: Lado[];
  etiquetas: EtiquetasEtapas;
  indicador: PasoIndicador[];
  vigenciaHoras: number;
  vigencias: number[];
  plantillaVersion: string;
  datos: Record<string, string>;
  inmueble: { descripcion: string; ubicacion: string };
  versiones: VersionResumen[];
  cambiosSinEnviar: CambiosEntreVersiones | null;
  eventos: EventoResumen[];
};

export type Destinatario = {
  rol: string;
  rolEtiqueta: string;
  nombre: string;
  compania: string | null;
  correo: string;
  telefono: string;
  cedulaUlt4: string;
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
  avisoSinRevisar: string | null;
  envio: {
    representa: string | null;
    lados: Lado[];
    etiquetas: EtiquetasEtapas;
    primera: Etapa | null;
    destinatarios: Record<Etapa, Destinatario[]>;
    vigente: { numero: number; estado: VersionEstado; principalCompleta: boolean; contraparteEnviada: boolean; rechazoEtapa: Etapa | null } | null;
    hayCambios: boolean;
    puedeEnviarContraparte: boolean;
    correccionMenorPosible: boolean;
    vigenciaHoras: number;
    vigencias: number[];
  };
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
  areaM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
};

// Cada documento versiona su plantilla por separado: el módulo no tiene "una
// versión" sino una por tipo.
export type PlantillaVigente = { tipo: ContratoTipo; version: string; revisada: boolean };

export type AlertaContrato = {
  contratoId: string;
  tipo: 'enviar_contraparte' | 'cambios_pedidos' | 'por_vencer' | 'vencido' | 'enlace_bloqueado';
  tipoEtiqueta: string;
  quien: string;
  etapa: string | null;
  horas?: number;
};

export type DatosPantallaContratos = {
  contratos: ContratoResumen[];
  alertas: AlertaContrato[];
  listings: ListingOpcion[];
  agente: { nombre: string; empresa: string | null; tieneCedula: boolean; tieneDireccion: boolean; tieneCorreo: boolean };
  plantilla: { aviso: string; versiones: PlantillaVigente[] };
};
