'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  LISTING_STATUS_LABELS,
  MATCH_STATUS_LABELS,
  OPERATION_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  UI_STRINGS,
  type Language,
} from './dictionary';

const STORAGE_KEY = 'redinmo_lang';

type LanguageContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
  tProperty: (value: string) => string;
  tOperation: (value: string) => string;
  tMatchStatus: (value?: string | null) => string;
  tSubscriptionStatus: (value: string) => string;
  tListingStatus: (value: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('es');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'es' || stored === 'en') {
      setLangState(stored);
    }
  }, []);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback((key: string) => UI_STRINGS[lang][key] ?? key, [lang]);
  const tProperty = useCallback((value: string) => PROPERTY_TYPE_LABELS[lang][value] ?? value, [lang]);
  const tOperation = useCallback((value: string) => OPERATION_TYPE_LABELS[lang][value] ?? value, [lang]);
  const tMatchStatus = useCallback(
    (value?: string | null) => (value ? MATCH_STATUS_LABELS[lang][value] ?? value : ''),
    [lang],
  );
  const tSubscriptionStatus = useCallback(
    (value: string) => SUBSCRIPTION_STATUS_LABELS[lang][value] ?? value,
    [lang],
  );
  const tListingStatus = useCallback((value: string) => LISTING_STATUS_LABELS[lang][value] ?? value, [lang]);

  const value = useMemo(
    () => ({ lang, setLang, t, tProperty, tOperation, tMatchStatus, tSubscriptionStatus, tListingStatus }),
    [lang, setLang, t, tProperty, tOperation, tMatchStatus, tSubscriptionStatus, tListingStatus],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage debe usarse dentro de un LanguageProvider');
  }
  return ctx;
}
