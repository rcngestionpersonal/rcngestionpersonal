import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const TITLE = 'Redinmo.io | Tus Inmuebles y Pedidos ahora hacen Match';
const DESCRIPTION =
  'Redinmo.io conecta tu inventario de inmuebles y los pedidos de tus clientes con los de otros agentes verificados. Cuando hace match, te avisa. 30 días gratis.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/login',
    siteName: 'Redinmo.io',
    locale: 'es_ES',
    type: 'website',
  },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
