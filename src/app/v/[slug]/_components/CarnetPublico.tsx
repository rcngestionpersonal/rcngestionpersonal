'use client';

import { BrokerCard, type BrokerCardData } from '@/components/dashboard/BrokerCard';

// Envoltura de cliente para la pagina publica del carnet. Existe solo por dos
// razones tecnicas: BrokerCard es un componente de cliente y necesita una
// funcion t(), y esta ruta -como la landing- no monta LanguageProvider (es
// 100% espanol, decision del 2026-08-29). Ni una linea de diseño vive aca:
// el carnet lo dibuja BrokerCard, que es el unico lugar donde existe.
const CARNET_STRINGS_ES: Record<string, string> = {
  'ranking.carnet.tipo': '· CARNET DE AGENTE',
  'shell.verificado': 'Agente Verificado en Redinmo.io',
  'ranking.carnet.cierresLabel': 'CIERRES',
  'ranking.carnet.puntosLabel': 'PUNTOS',
};

function carnetPublicoT(key: string): string {
  return CARNET_STRINGS_ES[key] ?? key;
}

export default function CarnetPublico({ data }: { data: BrokerCardData }) {
  return (
    // Tema claro por defecto para visitantes sin sesion (punto 2.5): el
    // ThemeProvider del layout raiz ya cubre esta ruta con defaultTheme="light"
    // y enableSystem, asi que aca solo se usan los tokens de globals.css.
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12 text-text">
      <div className="w-full max-w-[360px]">
        {/* audience="clientes": cierres, año de ingreso e inmuebles activos.
            Nunca puntos ni posicion en el ranking - son datos internos de la
            Red y esta pagina la ve cualquiera que escanee el QR. */}
        <BrokerCard data={data} audience="clientes" lang="es" t={carnetPublicoT} variante="publica" />
      </div>

      <p className="mt-6 text-[10px] text-text-3">
        <span className="font-bold text-accent">redinmo.io</span> · el hub que conecta colegas
      </p>
    </main>
  );
}
