import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const TITLE = 'Redinmo.io | Tus Inmuebles y Pedidos ahora hacen Match';
const DESCRIPTION =
  'Redinmo.io es el hub donde los agentes inmobiliarios conectan sus inmuebles y pedidos: carga tu inventario y recibe matches en segundos.';

// Next.js no mezcla (deep-merge) el objeto openGraph entre layout padre e hijo -
// hay que repetirlo completo aca, no solo el titulo/descripcion que cambian.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/agentes/registro',
    siteName: 'Redinmo.io',
    locale: 'es_ES',
    type: 'website',
  },
};

export default function RegistroLayout({ children }: { children: ReactNode }) {
  return children;
}
