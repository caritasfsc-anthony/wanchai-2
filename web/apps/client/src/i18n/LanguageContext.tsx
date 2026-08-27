import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { translations, type Lang, type TranslationKey } from "./translations";

type LanguageContextValue = { lang: Lang; setLang: (lang: Lang) => void; toggleLang: () => void; t: (key: TranslationKey) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("zh");
  const value = useMemo(() => ({ lang, setLang, toggleLang: () => setLang((current) => (current === "zh" ? "en" : "zh")), t: (key: TranslationKey) => translations[lang][key] ?? key }), [lang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("LanguageProvider missing");
  return ctx;
}
