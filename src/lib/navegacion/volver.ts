// "← Volver" que nunca deja al usuario atrapado ni lo saca de la app.
//
// En la app instalada en el iPhone (modo standalone) no hay barra de Safari ni
// botón "Atrás": si una pantalla secundaria no ofrece salida, el agente queda
// encerrado en ella. La regla del botón:
//
//   1. Si se llegó desde otra pantalla de la app, se vuelve en el historial.
//      Así se conserva dónde estaba (la pestaña, el contrato abierto).
//   2. Si no hay una pantalla anterior de la app (entró por un enlace directo,
//      una notificación, un correo), va al PADRE LÓGICO de la pantalla.
//   3. Nunca retrocede hacia un sitio de fuera de la app, y el botón nunca se
//      queda sin hacer nada.

// Hubo navegación entre rutas dentro de este documento (enlaces de Next, que
// no recargan la página). Lo marca RastreoNavegacion, montado en el layout.
let navegoDentro = false;

export function marcarNavegacionInterna(): void {
  navegoDentro = true;
}

export type ContextoVuelta = {
  // document.referrer: de dónde se cargó este documento.
  referrer: string;
  origen: string;
  urlActual: string;
  largoHistorial: number;
  navegoDentro: boolean;
};

// historial:              hay una pantalla anterior de la app, seguro.
// historial-con-respaldo: probablemente la hay, pero esta pudo ser la primera
//                         pantalla del documento: si el paso atrás no ocurre,
//                         se va al padre.
// padre:                  no hay a dónde volver dentro de la app.
export type Vuelta = 'historial' | 'historial-con-respaldo' | 'padre';

export function decidirVuelta(c: ContextoVuelta): Vuelta {
  // Con una sola entrada (pestaña nueva, app recién abierta en esta pantalla)
  // no hay nada atrás, venga de donde venga.
  if (c.largoHistorial <= 1) return 'padre';
  if (c.referrer) {
    try {
      const anterior = new URL(c.referrer);
      // El documento se cargó desde una pantalla de la app: cualquier paso
      // atrás desde aquí cae dentro de la app.
      if (anterior.origin === c.origen && anterior.href !== c.urlActual) return 'historial';
    } catch {
      // Referrer ilegible: se trata como si no hubiera.
    }
  }
  if (c.navegoDentro) return 'historial-con-respaldo';
  return 'padre';
}

// Lo que tarda como mucho un paso atrás dentro del mismo documento. Si pasado
// este tiempo la URL no cambió, no había a dónde volver.
const ESPERA_RESPALDO_MS = 450;

export function volverSeguro(router: { replace: (href: string) => void }, padre: string): void {
  const vuelta = decidirVuelta({
    referrer: document.referrer,
    origen: window.location.origin,
    urlActual: window.location.href,
    largoHistorial: window.history.length,
    navegoDentro,
  });
  if (vuelta === 'padre') {
    router.replace(padre);
    return;
  }
  const antes = window.location.href;
  window.history.back();
  // Solo con respaldo: en el caso 'historial' el paso atrás puede cargar otro
  // documento y tardar más, y un respaldo a destiempo competiría con él.
  if (vuelta === 'historial-con-respaldo') {
    window.setTimeout(() => {
      if (window.location.href === antes) router.replace(padre);
    }, ESPERA_RESPALDO_MS);
  }
}
