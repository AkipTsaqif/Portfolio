/**
 * Dictionary comparison, as a pure function.
 *
 * Two consumers, deliberately sharing one implementation: the CI check
 * (`scripts/check-i18n-parity.ts`) and the public Lab tool. If they drifted apart, the
 * tool could tell a visitor one thing while the gate that protects this repository
 * enforced another.
 *
 * No Node APIs and no `server-only` — this runs in a browser.
 */

export type ParityReport = {
  leftCount: number;
  rightCount: number;
  /** Keys present on the left, absent on the right. */
  missingInRight: string[];
  /** Keys present on the right, absent on the left. */
  missingInLeft: string[];
  /** Keys present but blank — the same bug wearing a disguise. */
  emptyInLeft: string[];
  emptyInRight: string[];
  ok: boolean;
};

/** A plain JSON object, as opposed to an array, `null`, or a primitive. */
export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Leaf keys as dotted paths.
 *
 * Objects recurse; **arrays are leaves**. An array of copy is compared as one key rather
 * than index by index, so reordering a list is not reported as a change and growing one
 * does not produce a storm of phantom mismatches.
 */
export function flattenKeys(value: unknown, prefix = ""): string[] {
  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      flattenKeys(child, `${prefix}${key}.`),
    );
  }

  return [prefix.slice(0, -1)];
}

/** Dotted paths whose value is a string containing only whitespace. */
export function collectEmptyValues(value: unknown, prefix = ""): string[] {
  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      collectEmptyValues(child, `${prefix}${key}.`),
    );
  }

  if (typeof value === "string" && value.trim() === "")
    return [prefix.slice(0, -1)];

  return [];
}

export function compareDictionaries(
  left: unknown,
  right: unknown,
): ParityReport {
  const leftKeys = new Set(flattenKeys(left));
  const rightKeys = new Set(flattenKeys(right));

  const missingInRight = [...leftKeys]
    .filter((key) => !rightKeys.has(key))
    .sort();
  const missingInLeft = [...rightKeys]
    .filter((key) => !leftKeys.has(key))
    .sort();
  const emptyInLeft = collectEmptyValues(left).sort();
  const emptyInRight = collectEmptyValues(right).sort();

  return {
    leftCount: leftKeys.size,
    rightCount: rightKeys.size,
    missingInRight,
    missingInLeft,
    emptyInLeft,
    emptyInRight,
    ok:
      missingInRight.length === 0 &&
      missingInLeft.length === 0 &&
      emptyInLeft.length === 0 &&
      emptyInRight.length === 0,
  };
}

/** Parses pasted or uploaded text, with a message a person can act on. */
export function parseDictionary(
  text: string,
): { value: unknown } | { error: string } {
  if (text.trim() === "") return { error: "empty" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: "invalid-json" };
  }

  if (!isPlainObject(parsed)) return { error: "not-an-object" };

  return { value: parsed };
}
