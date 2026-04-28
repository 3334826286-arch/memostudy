"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getMemoStudyMessages } from "@/lib/memostudy-i18n";
import { defaultLocale, getLocaleDirection, localeMeta, locales, resolveLocale } from "@/lib/i18n";

const LanguageContext = createContext(null);
const STORAGE_KEY = "memostudy:locale";

export function LanguageProvider({ children, initialLocale = defaultLocale }) {
  const router = useRouter();
  const pathname = usePathname();
  const [locale, setLocaleState] = useState(resolveLocale(initialLocale || defaultLocale));

  useEffect(() => {
    const urlLocale = new URLSearchParams(window.location.search).get("lang");
    const storedLocale = window.localStorage.getItem(STORAGE_KEY);
    const browserLocale = window.navigator.language;
    const nextLocale = urlLocale
      ? resolveLocale(urlLocale)
      : storedLocale
        ? resolveLocale(storedLocale)
        : resolveLocale(browserLocale);

    setLocaleState(nextLocale);
  }, [initialLocale]);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = localeMeta[locale]?.bcp47 ?? locale;
    html.dir = getLocaleDirection(locale);
  }, [locale]);

  function setLocale(nextLocale) {
    const resolvedLocale = resolveLocale(nextLocale);
    if (!locales.includes(resolvedLocale)) {
      return;
    }

    setLocaleState(resolvedLocale);
    window.localStorage.setItem(STORAGE_KEY, resolvedLocale);

    const params = new URLSearchParams(window.location.search);
    params.set("lang", resolvedLocale);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const value = useMemo(
    () => ({
      locale,
      direction: getLocaleDirection(locale),
      localeMeta,
      messages: getMemoStudyMessages(locale),
      setLocale
    }),
    [locale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }

  return context;
}
