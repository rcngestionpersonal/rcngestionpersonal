'use client';

import { useEffect } from 'react';

// El salto nativo a un #ancla lo resuelve <html>, no <main> - un scroll-behavior
// en el CSS module de esta pagina no tiene ningun efecto ahi. Se aplica por JS,
// scopeado a esta pagina (se limpia al desmontar), respetando reduced-motion.
export default function SmoothScroll() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const html = document.documentElement;
    const previous = html.style.scrollBehavior;
    html.style.scrollBehavior = 'smooth';
    return () => {
      html.style.scrollBehavior = previous;
    };
  }, []);

  return null;
}
