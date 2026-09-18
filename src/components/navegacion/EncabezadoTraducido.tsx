'use client';

import { useLanguage } from '@/lib/i18n/LanguageProvider';
import EncabezadoSecundario from './EncabezadoSecundario';

// EncabezadoSecundario para las pantallas bilingües (dentro de un
// LanguageProvider): "Volver" y, si se pasa la clave, el título, salen del
// diccionario.
export default function EncabezadoTraducido({ padre, claveTitulo, titulo }: { padre: string; claveTitulo?: string; titulo?: string }) {
  const { t } = useLanguage();
  return <EncabezadoSecundario padre={padre} titulo={claveTitulo ? t(claveTitulo) : (titulo ?? '')} etiquetaVolver={t('nav.volver')} />;
}
