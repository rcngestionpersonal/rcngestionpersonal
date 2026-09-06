// Constantes del mini-sitio del agente (Fase 3), compartidas entre cliente y
// servidor. Sin imports de Prisma ni mock-store a proposito: la pantalla de
// personalizacion es un componente de cliente y tiene que poder importar esto.
// La logica que toca la base vive en mini-sitio-server.ts.

export const MINI_SITIO_FRASE_MAX = 160;

// Paleta ACOTADA (punto 3.2): cinco acentos elegidos para convivir con el
// design system en tema claro y oscuro. A proposito no hay selector libre de
// color - un agente eligiendo fucsia sobre verde degrada la percepcion de
// toda la plataforma, y el costo de esa decision no lo paga solo el.
//
// Cada entrada trae el acento y el color de texto que va ENCIMA de el, para
// que el contraste AA (punto 8.3) sea una propiedad de la paleta y no algo
// que cada componente tenga que resolver por su cuenta.
export const MINI_SITIO_COLORES = {
  violeta: { label: 'Violeta', acento: '#7c5cff', contraste: '#ffffff' },
  esmeralda: { label: 'Esmeralda', acento: '#0d9488', contraste: '#ffffff' },
  azul: { label: 'Azul', acento: '#2563eb', contraste: '#ffffff' },
  ambar: { label: 'Ámbar', acento: '#b45309', contraste: '#ffffff' },
  grafito: { label: 'Grafito', acento: '#334155', contraste: '#ffffff' },
} as const;

export type MiniSitioColor = keyof typeof MINI_SITIO_COLORES;

export const MINI_SITIO_COLOR_DEFECTO: MiniSitioColor = 'violeta';

export function esMiniSitioColor(valor: unknown): valor is MiniSitioColor {
  return typeof valor === 'string' && Object.prototype.hasOwnProperty.call(MINI_SITIO_COLORES, valor);
}

export function resolverColor(clave: string | null | undefined) {
  return esMiniSitioColor(clave) ? MINI_SITIO_COLORES[clave] : MINI_SITIO_COLORES[MINI_SITIO_COLOR_DEFECTO];
}

// Por que el sitio puede no verse. Se distingue "no disponible" de "no existe"
// porque son dos paginas distintas (puntos 7.1-7.3): la primera es neutra y
// digna para un agente que existe pero hoy no tiene la feature, la segunda es
// un 404. Nunca un 500 ni una pagina rota.
export type MiniSitioEstado = 'visible' | 'no_disponible' | 'inexistente';

export function urlMiniSitio(slug: string, base = 'https://redinmo.io'): string {
  return `${base}/a/${slug}`;
}

// Mensaje precargado del boton de WhatsApp del hero (punto 2.1).
export function mensajeWhatsAppMiniSitio(nombreAgente: string): string {
  const primerNombre = nombreAgente.trim().split(/\s+/)[0] ?? nombreAgente;
  return `Hola ${primerNombre} 👋 Vi tu perfil en Redinmo.io y quiero consultarte sobre un inmueble.`;
}
