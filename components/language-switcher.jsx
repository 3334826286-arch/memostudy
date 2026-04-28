"use client";

import { localeMeta, locales } from "@/lib/i18n";
import { useLanguage } from "@/components/language-provider";

export function LanguageSwitcher({ variant = "dark", compact = false, label }) {
  const { locale, messages, setLocale } = useLanguage();
  const wrapperClass =
    variant === "light"
      ? "flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white/88 p-1.5 shadow-sm"
      : "flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-950/45 p-1";
  const labelClass = variant === "light" ? "px-2 text-xs text-slate-500" : "px-2 text-xs text-slate-500";
  const activeClass = variant === "light" ? "bg-slate-900 text-white" : "bg-white text-slate-950";
  const idleClass =
    variant === "light"
      ? "text-slate-600 hover:bg-slate-100"
      : "text-slate-300 hover:bg-white/6";

  return (
    <div className={wrapperClass}>
      <span className={labelClass}>{label ?? messages.language.label}</span>
      {locales.map((item) => {
        const active = item === locale;
        const meta = localeMeta[item];
        const buttonLabel = compact ? meta.shortLabel : meta.nativeLabel;

        return (
          <button
            key={item}
            type="button"
            onClick={() => setLocale(item)}
            aria-pressed={active}
            className={`rounded-full px-2.5 py-1 text-xs transition ${
              active ? activeClass : idleClass
            }`}
            title={meta.nativeLabel}
          >
            {buttonLabel}
          </button>
        );
      })}
    </div>
  );
}
