'use client';

import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { AccesoInput } from '@/lib/real-estate/access';
import MiniSitioPanel from '../MiniSitioPanel';
import RequiereFeature from '../RequiereFeature';
import { ModuleHeader } from '../CardKit';
import { IconGlobe } from '../icons';

// Pestaña propia del mini-sitio publico. Antes vivia al final de
// /agentes/perfil, debajo del formulario de datos personales: la feature Pro
// con mas peso comercial estaba enterrada en una pantalla de edicion de datos.
//
// En plan Basico la entrada del menu se ve igual y aterriza aca, en el bloqueo
// de RequiereFeature - es un argumento de venta permanente, no una pestaña que
// aparece y desaparece segun el plan. En trial se ve completa (reverse trial,
// ver tieneAcceso()).
export default function MiSitioTab({ suscripcion }: { suscripcion: AccesoInput | null }) {
  const { t } = useLanguage();

  return (
    <div className="min-w-0">
      <ModuleHeader
        icon={<IconGlobe className="h-[17px] w-[17px]" strokeWidth={1.8} />}
        title={t('misitio.title')}
        subtitle={t('misitio.subtitle')}
      />

      {suscripcion ? (
        <RequiereFeature suscripcion={suscripcion} feature="mini_sitio">
          <MiniSitioPanel />
        </RequiereFeature>
      ) : (
        <p className="text-sm text-text-2">{t('misitio.cargando')}</p>
      )}
    </div>
  );
}
