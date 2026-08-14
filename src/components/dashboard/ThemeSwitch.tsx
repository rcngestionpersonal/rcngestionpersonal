'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';

const THEME_STORAGE_KEY = 'redinmo-theme';

type ThemeValue = 'light' | 'dark' | 'system';

const OPTIONS: { value: ThemeValue; labelKey: string; Icon: typeof Sun }[] = [
  { value: 'light', labelKey: 'theme.light', Icon: Sun },
  { value: 'dark', labelKey: 'theme.dark', Icon: Moon },
  { value: 'system', labelKey: 'theme.system', Icon: Monitor },
];

// Sincroniza la preferencia de tema con el perfil del agente en base de datos
// (multi-dispositivo); localStorage (manejado por next-themes) sigue siendo el
// respaldo inmediato que evita el parpadeo en el mismo dispositivo/navegador.
export default function ThemeSwitch({ isAdmin, compact, showLabel }: { isAdmin: boolean; compact?: boolean; showLabel?: boolean }) {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const reconciled = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isAdmin || reconciled.current) return;
    reconciled.current = true;
    const hadLocalPreference = Boolean(window.localStorage.getItem(THEME_STORAGE_KEY));
    if (hadLocalPreference) return;

    fetch('/api/real-estate/agents/me', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const pref = data?.agent?.themePreference as string | undefined;
        if (pref) setTheme(pref.toLowerCase());
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  function selectTheme(value: ThemeValue) {
    setTheme(value);
    if (isAdmin) return;
    fetch('/api/real-estate/agents/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themePreference: value.toUpperCase() }),
    }).catch(() => {});
  }

  if (!mounted) {
    return <div className={compact ? 'h-9 w-[108px]' : 'h-8 w-[102px]'} aria-hidden="true" />;
  }

  const current: ThemeValue = (theme as ThemeValue) ?? 'dark';

  const control = (
    <div
      role="radiogroup"
      aria-label={t('theme.aria')}
      className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface-2 p-1"
    >
      {OPTIONS.map(({ value, labelKey, Icon }) => {
        const isActive = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={t(labelKey)}
            title={t(labelKey)}
            onClick={() => selectTheme(value)}
            className={`inline-flex items-center justify-center rounded-full transition-colors duration-200 ${
              compact ? 'h-7 w-7' : 'h-6 w-6'
            } ${isActive ? 'gradient-btn' : 'text-text-3 hover:text-text'}`}
          >
            <Icon className="h-[15px] w-[15px]" strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );

  if (!showLabel) return control;

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-semibold text-text-2">{t('theme.label')}</span>
      {control}
    </div>
  );
}
