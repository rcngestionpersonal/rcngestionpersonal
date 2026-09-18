import { useEffect } from 'react';

// "← Volver" no descarta en silencio lo que el usuario escribió.
//
// Cada formulario declara si tiene cambios sin guardar con
// useCambiosSinGuardar(hay). El botón "← Volver" (EncabezadoSecundario) y
// cualquier otro botón que salga del formulario llaman a confirmarSalida()
// antes de irse: si hay cambios, se pregunta.
//
// Es un registro del módulo y no una prop porque el formulario y el
// encabezado no siempre son el mismo componente (en Recuperar acceso, el
// encabezado está en la página y el formulario es un componente hijo).

export const MENSAJE_CAMBIOS_SIN_GUARDAR = 'Tienes cambios sin guardar. ¿Salir sin guardar?';

const pendientes = new Map<symbol, string>();

// Devuelve la función que quita el registro.
export function registrarCambiosSinGuardar(mensaje: string = MENSAJE_CAMBIOS_SIN_GUARDAR): () => void {
  const id = Symbol('cambios-sin-guardar');
  pendientes.set(id, mensaje);
  return () => {
    pendientes.delete(id);
  };
}

export function hayCambiosSinGuardar(): boolean {
  return pendientes.size > 0;
}

// true: se puede salir (no había cambios, o el usuario aceptó perderlos).
export function confirmarSalida(preguntar: (mensaje: string) => boolean = (m) => window.confirm(m)): boolean {
  if (pendientes.size === 0) return true;
  const [mensaje] = pendientes.values();
  return preguntar(mensaje);
}

// Mientras `hay` sea verdadero y el formulario esté montado, salir pregunta.
// Al guardar o al desmontarse el formulario, el registro se quita solo.
export function useCambiosSinGuardar(hay: boolean, mensaje?: string): void {
  useEffect(() => {
    if (!hay) return;
    return registrarCambiosSinGuardar(mensaje);
  }, [hay, mensaje]);
}
