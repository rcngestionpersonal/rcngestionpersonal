'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { marcarNavegacionInterna } from '@/lib/navegacion/volver';

// Anota que hubo navegación entre rutas dentro de la app sin recargar la
// página (enlaces de Next). Con eso "← Volver" sabe que hay una pantalla
// anterior aunque document.referrer no lo diga. Va en el layout raíz, que no se
// desmonta entre rutas.
//
// Solo mira la ruta, no la query: que el panel cambie ?tab= no es navegar.
export default function RastreoNavegacion() {
  const ruta = usePathname();
  const ultima = useRef(ruta);

  useEffect(() => {
    if (ruta === ultima.current) return;
    ultima.current = ruta;
    marcarNavegacionInterna();
  }, [ruta]);

  return null;
}
