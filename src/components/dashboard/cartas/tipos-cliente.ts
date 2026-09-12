import type { CartaBloques, CartaDatosAgente, CartaDestinatarioTipo, CartaImagenTipo, CartaPaleta } from '@/lib/real-estate/cartas/tipos';

// Formas que viajan entre las rutas de cartas y la pantalla. Viven aparte de
// tipos.ts (que es compartido con el servidor) para no mezclar el contrato de
// la API con la configuracion del dominio.

export type CartaResumen = {
  id: string;
  destinatarioTipo: CartaDestinatarioTipo;
  destinatarioNombre: string;
  destinatarioCargo: string | null;
  estado: 'BORRADOR' | 'ENVIADA';
  revisadaAt: string | null;
  enviadaAt: string | null;
  enviadaA: string | null;
  paleta: CartaPaleta;
  createdAt: string;
};

export type CartaCompleta = CartaResumen & {
  contexto: string | null;
  bloques: CartaBloques;
  imagenTipo: CartaImagenTipo;
};

export type EstadoCuotaCliente = {
  usadas: number;
  limite: number;
  restantes: number;
  reiniciaEl: string;
};

export type DatosPantallaCartas = {
  cartas: CartaResumen[];
  cuota: EstadoCuotaCliente;
  datos: CartaDatosAgente | null;
  inventarioEscaso: boolean;
  agente: {
    imagenTipoPreferida: CartaImagenTipo;
    logoUrl: string | null;
    photoUrl: string | null;
    tieneCorreo: boolean;
  };
  // Decide si el interruptor del enlace tiene sentido y si hay que invitar al
  // agente a publicar su perfil.
  miniSitio: { activo: boolean; url: string | null };
};
