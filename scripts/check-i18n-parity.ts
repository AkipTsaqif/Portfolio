#!/usr/bin/env bun
/**
 * Asserts that the two dictionaries hold exactly the same keys.
 *
 *   bun run check:i18n
 *
 * Why this exists: `src/i18n/messages/{en,id}.json` are typed as `typeof en.json`, and
 * that type does **not** enforce that `id.json` keeps up. A key added to English and
 * forgotten in Indonesian is not a type error and not a build error — it is a missing
 * string at runtime, in one locale, that nobody sees until a visitor switches language.
 *
 * The comparison itself lives in `src/features/lab/i18n-parity/compare.ts` so the public
 * Lab tool and this gate cannot disagree about what a mismatch is.
 *
 * Runs under bun rather than node: it imports a TypeScript module. The other script in
 * this directory (`verify-daily-questions.mjs`) stays on node for the opposite reason —
 * bun's FormData is rejected by Next's Server Action parser.
 */
import { readFileSync } from "node:fs";
import {
  compareDictionaries,
  type ParityReport,
} from "../src/features/lab/i18n-parity/compare";

const FILES = {
  en: "src/i18n/messages/en.json",
  id: "src/i18n/messages/id.json",
};

function load(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.error(
      `\n  Cannot read ${path}: ${error instanceof Error ? error.message : error}\n`,
    );
    process.exit(1);
  }
}

const report: ParityReport = compareDictionaries(
  load(FILES.en),
  load(FILES.id),
);

console.log("\ni18n parity — en.json vs id.json\n");
console.log(`  en keys: ${String(report.leftCount).padStart(4)}`);
console.log(`  id keys: ${String(report.rightCount).padStart(4)}`);

if (report.ok) {
  console.log(`\n  ok — ${report.leftCount} keys, exact parity\n`);
  process.exit(0);
}

const problems =
  report.missingInRight.length +
  report.missingInLeft.length +
  report.emptyInLeft.length +
  report.emptyInRight.length;

console.log(`\n  DRIFT: ${problems} problem(s)\n`);

if (report.missingInRight.length) {
  console.log(`  missing in id (${report.missingInRight.length}):`);
  for (const key of report.missingInRight) console.log(`    - ${key}`);
}

if (report.missingInLeft.length) {
  console.log(`\n  missing in en (${report.missingInLeft.length}):`);
  for (const key of report.missingInLeft) console.log(`    - ${key}`);
}

if (report.emptyInLeft.length || report.emptyInRight.length) {
  console.log(
    `\n  present but empty (${report.emptyInLeft.length + report.emptyInRight.length}):`,
  );
  for (const key of report.emptyInLeft) console.log(`    - en: ${key}`);
  for (const key of report.emptyInRight) console.log(`    - id: ${key}`);
}

console.log(
  "\n  Add the missing keys to the matching file, or remove the extras.\n",
);
process.exit(1);
