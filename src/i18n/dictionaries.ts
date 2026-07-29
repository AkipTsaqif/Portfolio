import "server-only";
import type { Locale } from "./config";

const dictionaries = {
  en: () => import("./messages/en.json").then((module) => module.default),
  id: () => import("./messages/id.json").then((module) => module.default),
};

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["en"]>>;

export function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}
