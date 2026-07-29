"use client";

import { createContext, useContext } from "react";
import type en from "./messages/en.json";
import type { Locale } from "./config";

export type ClientDictionary = typeof en;

const I18nContext = createContext<{
  locale: Locale;
  dictionary: ClientDictionary;
} | null>(null);

export function I18nProvider({
  children,
  dictionary,
  locale,
}: {
  children: React.ReactNode;
  dictionary: ClientDictionary;
  locale: Locale;
}) {
  return (
    <I18nContext.Provider value={{ locale, dictionary }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider.");
  return context;
}
