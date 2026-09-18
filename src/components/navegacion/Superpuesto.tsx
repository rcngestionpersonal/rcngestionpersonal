'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Todo modal, hoja o visor se dibuja directamente en <body>.
//
// Dentro de la página, un ancestro con `transform` convierte el
// `position: fixed` del modal en relativo a ese ancestro. Pasaba en Ranking:
// la animación de entrada (fade-up) deja un transform puesto, y el modal de
// compartir el carnet quedaba corrido hacia arriba, con la X fuera de la
// pantalla y el encabezado del panel por encima. Desde <body> el modal cubre
// siempre la pantalla y queda sobre todo lo demás.
export default function Superpuesto({ children }: { children: ReactNode }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return null;
  return createPortal(
    // Los eventos de React cruzan el portal hacia el componente que abrió el
    // modal: un toque en el fondo no debe seguir subiendo y disparar, por
    // ejemplo, el clic de la tarjeta que lo contiene.
    <div style={{ display: 'contents' }} onClick={(e) => e.stopPropagation()}>
      {children}
    </div>,
    document.body,
  );
}
