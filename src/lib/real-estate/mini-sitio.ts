// Constantes del mini-sitio del agente (Fase 3), compartidas entre cliente y
// servidor. Sin imports de Prisma ni mock-store a proposito: la pantalla de
// personalizacion es un componente de cliente y tiene que poder importar esto.
// La logica que toca la base vive en mini-sitio-server.ts.

export const MINI_SITIO_FRASE_MAX = 160;

// Un tono completo del acento del agente. Todo lo que un componente puede
// necesitar para pintar con el color elegido esta aca: nunca se construye un
// rgba() a mano dentro de un componente ni se repite un hex.
export type MiniSitioTono = {
  // Relleno solido: boton de WhatsApp, chips de operacion, anillo de la foto.
  acento: string;
  // Texto ENCIMA del relleno solido. Es parte de la paleta y no algo que cada
  // componente resuelva, para que el contraste AA sea una propiedad del color.
  contraste: string;
  // Fondo tenue de chips y superficies destacadas (el acento sobre el fondo
  // de la pagina, no un gris).
  suave: string;
  // Borde de tarjetas destacadas, chips y lineas divisorias de seccion.
  borde: string;
  // Resplandor radial detras del hero.
  glow: string;
};

// Paleta ACOTADA (punto 3.2): cinco acentos elegidos para convivir con el
// design system. A proposito no hay selector libre de color - un agente
// eligiendo fucsia sobre verde degrada la percepcion de toda la plataforma, y
// el costo de esa decision no lo paga solo el.
//
// Cada color trae su version clara y su version oscura (pedido 4.5): el mismo
// hex no puede servir para las dos: un grafito #334155 sobre fondo casi negro
// es invisible, y un pastel #cbd5e1 sobre blanco tampoco se lee. La pagina
// inyecta AMBAS versiones como variables y globals.css elige segun el tema
// del visitante - ningun componente repite estos valores.
//
// Los tonos solidos estan verificados a contraste AA (>=4.5:1) contra su
// propio `contraste`; el test de scripts/verificar-contraste-mini-sitio.ts lo
// comprueba para los cinco colores en los dos temas.
export const MINI_SITIO_COLORES = {
  violeta: {
    label: 'Violeta',
    claro: {
      acento: '#6841e8',
      contraste: '#ffffff',
      suave: 'rgba(104, 65, 232, 0.10)',
      borde: 'rgba(104, 65, 232, 0.30)',
      glow: 'rgba(104, 65, 232, 0.16)',
    },
    oscuro: {
      acento: '#b7a5ff',
      contraste: '#16102b',
      suave: 'rgba(183, 165, 255, 0.13)',
      borde: 'rgba(183, 165, 255, 0.30)',
      glow: 'rgba(183, 165, 255, 0.20)',
    },
  },
  esmeralda: {
    label: 'Esmeralda',
    claro: {
      acento: '#0b7568',
      contraste: '#ffffff',
      suave: 'rgba(11, 117, 104, 0.10)',
      borde: 'rgba(11, 117, 104, 0.30)',
      glow: 'rgba(11, 117, 104, 0.16)',
    },
    oscuro: {
      acento: '#5eead4',
      contraste: '#04201c',
      suave: 'rgba(94, 234, 212, 0.13)',
      borde: 'rgba(94, 234, 212, 0.30)',
      glow: 'rgba(94, 234, 212, 0.20)',
    },
  },
  azul: {
    label: 'Azul',
    claro: {
      acento: '#1d4ed8',
      contraste: '#ffffff',
      suave: 'rgba(29, 78, 216, 0.10)',
      borde: 'rgba(29, 78, 216, 0.30)',
      glow: 'rgba(29, 78, 216, 0.16)',
    },
    oscuro: {
      acento: '#93c5fd',
      contraste: '#0b1836',
      suave: 'rgba(147, 197, 253, 0.13)',
      borde: 'rgba(147, 197, 253, 0.30)',
      glow: 'rgba(147, 197, 253, 0.20)',
    },
  },
  ambar: {
    label: 'Ámbar',
    claro: {
      acento: '#a45309',
      contraste: '#ffffff',
      suave: 'rgba(164, 83, 9, 0.10)',
      borde: 'rgba(164, 83, 9, 0.30)',
      glow: 'rgba(164, 83, 9, 0.16)',
    },
    oscuro: {
      acento: '#fcd34d',
      contraste: '#2a1a02',
      suave: 'rgba(252, 211, 77, 0.13)',
      borde: 'rgba(252, 211, 77, 0.30)',
      glow: 'rgba(252, 211, 77, 0.20)',
    },
  },
  grafito: {
    label: 'Grafito',
    claro: {
      acento: '#334155',
      contraste: '#ffffff',
      suave: 'rgba(51, 65, 85, 0.10)',
      borde: 'rgba(51, 65, 85, 0.30)',
      glow: 'rgba(51, 65, 85, 0.16)',
    },
    oscuro: {
      acento: '#cbd5e1',
      contraste: '#0f172a',
      suave: 'rgba(203, 213, 225, 0.13)',
      borde: 'rgba(203, 213, 225, 0.30)',
      glow: 'rgba(203, 213, 225, 0.20)',
    },
  },
} as const satisfies Record<string, { label: string; claro: MiniSitioTono; oscuro: MiniSitioTono }>;

export type MiniSitioColor = keyof typeof MINI_SITIO_COLORES;

export const MINI_SITIO_COLOR_DEFECTO: MiniSitioColor = 'violeta';

export const MINI_SITIO_CLAVES_COLOR = Object.keys(MINI_SITIO_COLORES) as MiniSitioColor[];

export function esMiniSitioColor(valor: unknown): valor is MiniSitioColor {
  return typeof valor === 'string' && Object.prototype.hasOwnProperty.call(MINI_SITIO_COLORES, valor);
}

export function resolverColor(clave: string | null | undefined) {
  return esMiniSitioColor(clave) ? MINI_SITIO_COLORES[clave] : MINI_SITIO_COLORES[MINI_SITIO_COLOR_DEFECTO];
}

// Las variables que la pagina publica inyecta en su raiz. Se mandan LOS DOS
// temas: el visitante decide cual se aplica (punto 8.4) y un server component
// no puede saberlo, asi que globals.css hace la eleccion con
// `.mini-sitio` / `[data-theme='light'] .mini-sitio`.
//
// Nada de esto pisa los tokens de marca: el sello de verificado, el chip de
// nivel, el pie y el patron de puntos siguen usando --brand/--accent, porque
// son los elementos que CERTIFICAN y tienen que verse igual en todos los
// sitios (punto 4.4).
export function variablesDeColor(clave: string | null | undefined): Record<string, string> {
  const { claro, oscuro } = resolverColor(clave);
  return {
    '--ms-acento-claro': claro.acento,
    '--ms-contraste-claro': claro.contraste,
    '--ms-suave-claro': claro.suave,
    '--ms-borde-claro': claro.borde,
    '--ms-glow-claro': claro.glow,
    '--ms-acento-oscuro': oscuro.acento,
    '--ms-contraste-oscuro': oscuro.contraste,
    '--ms-suave-oscuro': oscuro.suave,
    '--ms-borde-oscuro': oscuro.borde,
    '--ms-glow-oscuro': oscuro.glow,
  };
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
