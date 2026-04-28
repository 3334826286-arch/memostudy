export const localeMeta = {
  zh: { nativeLabel: "\u7b80\u4f53\u4e2d\u6587", shortLabel: "ZH", bcp47: "zh-CN", dir: "ltr" },
  en: { nativeLabel: "English", shortLabel: "EN", bcp47: "en-US", dir: "ltr" },
  ja: { nativeLabel: "\u65e5\u672c\u8a9e", shortLabel: "JA", bcp47: "ja-JP", dir: "ltr" },
  ko: { nativeLabel: "\ud55c\uad6d\uc5b4", shortLabel: "KO", bcp47: "ko-KR", dir: "ltr" },
  fr: { nativeLabel: "Francais", shortLabel: "FR", bcp47: "fr-FR", dir: "ltr" },
  de: { nativeLabel: "Deutsch", shortLabel: "DE", bcp47: "de-DE", dir: "ltr" },
  es: { nativeLabel: "Espanol", shortLabel: "ES", bcp47: "es-ES", dir: "ltr" },
  pt: { nativeLabel: "Portugues", shortLabel: "PT", bcp47: "pt-PT", dir: "ltr" },
  ru: { nativeLabel: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439", shortLabel: "RU", bcp47: "ru-RU", dir: "ltr" },
  ar: { nativeLabel: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629", shortLabel: "AR", bcp47: "ar", dir: "rtl" }
};

export const locales = Object.keys(localeMeta);
export const defaultLocale = "en";

export function resolveLocale(input) {
  if (!input) {
    return defaultLocale;
  }

  const normalized = input.toLowerCase();
  if (locales.includes(normalized)) {
    return normalized;
  }

  const matched = locales.find((locale) => normalized.startsWith(locale));
  return matched ?? defaultLocale;
}

export function getLocaleDirection(locale = defaultLocale) {
  return localeMeta[locale]?.dir ?? "ltr";
}
