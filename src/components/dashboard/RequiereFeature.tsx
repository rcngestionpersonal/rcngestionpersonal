'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { tieneAcceso, type AccesoInput, type Feature } from '@/lib/real-estate/access';
import { IconLock } from './icons';

// Bloqueo elegante para features Pro (seccion 4.2/4.3 del pedido de
// arquitectura de planes): en vez de romper la interfaz u ocultar la seccion
// sin explicacion, muestra una tarjeta con candado, el nombre de la feature,
// una linea de valor, y un boton a la pantalla de planes. Nunca es la unica
// defensa: la ruta de servidor detras de esta feature debe validar tambien
// con tieneAccesoPorAgenteId() (ver access-server.ts).
export default function RequiereFeature({
  suscripcion,
  feature,
  children,
}: {
  suscripcion: AccesoInput;
  feature: Feature;
  children: ReactNode;
}) {
  const { t } = useLanguage();

  if (tieneAcceso(suscripcion, feature)) {
    return <>{children}</>;
  }

  const valorKey = `feature.${feature}.valor`;
  const valor = t(valorKey);

  return (
    <div className="glass-card flex flex-col items-center gap-3 rounded-[1.8rem] p-6 text-center sm:p-8">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-text-2">
        <IconLock className="h-5 w-5" />
      </span>
      <p className="text-base font-bold text-text">{t(`feature.${feature}`)}</p>
      {valor !== valorKey ? <p className="max-w-sm text-sm text-text-2">{valor}</p> : null}
      <Link
        href="/agentes/suscripcion/planes"
        className="gradient-btn mt-1 rounded-full px-5 py-2.5 text-sm font-semibold text-grad-contrast transition-transform duration-200 hover:scale-[1.02]"
      >
        {t('requiereFeature.mejorarAPro')}
      </Link>
    </div>
  );
}
