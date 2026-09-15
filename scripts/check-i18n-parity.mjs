#!/usr/bin/env node
/**
 * Asserts that the two dictionaries hold exactly the same keys.
 *
 *   node scripts/check-i18n-parity.mjs
 *
 * Why this exists: `src/i18n/messages/en.json` and `id.json` are typed as
 * `typeof en.json`, and that type does **not** enforce that `id.json` keeps up.
 * A key added to English and forgotten in Indonesian is not a type error and not a
 * build error — it is a missing string at runtime, in one locale, that nobody sees
 * until a visitor switches language. The dictionaries were kept in sync by hand
 * across a 320-key namespace, which is a promise no one should have to keep
 * unaided.
 *
 * Exits non-zero on any drift, so CI can gate it.
 */
import { readFileSync } from "node:fs";

const LOCALES = ["en", "id"];
const FILES = {
  en: "src/i18n/messages/en.json",
  id: "src/i18n/messages/id.json",
};

/**
 * Leaf keys as dotted paths. Objects recurse; arrays and primitives are leaves,
 * so an array of copy is compared as one key rather than by index.
 */
function flatten(value, prefix = "") {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      flatten(child, `${prefix}${key}.`),
    );
  }
  return [prefix.slice(0, -1)];
}

function load(locale) {
  const path = FILES[locale];
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.error(`\n  Cannot read ${path}: ${error.message}\n`);
    process.exit(1);
  }
}

const keys = {};
const empty = {};

for (const locale of LOCALES) {
  const flat = flatten(load(locale));
  keys[locale] = new Set(flat);

  // A key present but blank is the same bug wearing a disguise: it renders as
  // nothing rather than falling back to the other language.
  empty[locale] = [];
  const walk = (node, prefix = "") => {
    for (const [key, value] of Object.entries(node)) {
      const path = `${prefix}${key}`;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        walk(value, `${path}.`);
      } else if (typeof value === "string" && value.trim() === "") {
        empty[locale].push(path);
      }
    }
  };
  walk(load(locale));
}

const [a, b] = LOCALES;
const missingInB = [...keys[a]].filter((key) => !keys[b].has(key)).sort();
const missingInA = [...keys[b]].filter((key) => !keys[a].has(key)).sort();
const emptyValues = LOCALES.flatMap((locale) =>
  empty[locale].map((key) => `${locale}: ${key}`),
).sort();

console.log("\ni18n parity — en.json vs id.json\n");
for (const locale of LOCALES) {
  console.log(`  ${locale} keys: ${String(keys[locale].size).padStart(4)}`);
}

const drift = missingInB.length + missingInA.length + emptyValues.length;

if (drift === 0) {
  console.log(`\n  ok — ${keys[a].size} keys, exact parity\n`);
  process.exit(0);
}

console.log(`\n  DRIFT: ${drift} problem(s)\n`);

if (missingInB.length) {
  console.log(`  missing in ${b} (${missingInB.length}):`);
  for (const key of missingInB) console.log(`    - ${key}`);
}
if (missingInA.length) {
  console.log(`\n  missing in ${a} (${missingInA.length}):`);
  for (const key of missingInA) console.log(`    - ${key}`);
}
if (emptyValues.length) {
  console.log(`\n  present but empty (${emptyValues.length}):`);
  for (const key of emptyValues) console.log(`    - ${key}`);
}

console.log(
  `\n  Add the missing keys to the matching file, or remove the extras.\n`,
);
process.exit(1);
