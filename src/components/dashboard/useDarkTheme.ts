'use client';

import { useEffect, useState } from 'react';

// next-themes escribe el tema en <html data-theme="light|dark"> (ver ThemeProvider en
// layout.tsx). Los mapas Leaflet son imperativos (fuera de React), asi que necesitan
// leer este atributo directamente y reaccionar a sus cambios via MutationObserver en
// vez de useContext, para poder cambiar de teselas claras a oscuras sin remontar el mapa.
export function useDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setIsDark(root.getAttribute('data-theme') === 'dark');
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
