import { describe, expect, test } from "bun:test";
import {
  collectEmptyValues,
  compareDictionaries,
  flattenKeys,
  isPlainObject,
  parseDictionary,
} from "./compare";

describe("isPlainObject", () => {
  test("accepts objects only", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject("x")).toBe(false);
    expect(isPlainObject(7)).toBe(false);
  });
});

describe("flattenKeys", () => {
  test("produces dotted paths for nested objects", () => {
    expect(flattenKeys({ a: { b: { c: "x" } }, d: "y" }).sort()).toEqual([
      "a.b.c",
      "d",
    ]);
  });

  test("treats arrays as single leaves, not as indices", () => {
    // the point: reordering copy inside a list must not read as a change
    expect(flattenKeys({ steps: ["one", "two", "three"] })).toEqual(["steps"]);
  });

  test("handles a flat object", () => {
    expect(flattenKeys({ a: 1, b: 2 }).sort()).toEqual(["a", "b"]);
  });

  test("stops at a null value without crashing", () => {
    expect(flattenKeys({ a: null })).toEqual(["a"]);
  });

  test("keeps false and zero, which are values not absences", () => {
    expect(flattenKeys({ a: false, b: 0 }).sort()).toEqual(["a", "b"]);
  });
});

describe("collectEmptyValues", () => {
  test("finds whitespace-only strings at any depth", () => {
    expect(
      collectEmptyValues({ a: "ok", b: { c: "   ", d: "" } }).sort(),
    ).toEqual(["b.c", "b.d"]);
  });

  test("ignores non-strings", () => {
    expect(collectEmptyValues({ a: 0, b: false, c: null })).toEqual([]);
  });
});

describe("compareDictionaries", () => {
  test("reports a clean pair as ok", () => {
    const report = compareDictionaries(
      { a: "1", b: "2" },
      { a: "satu", b: "dua" },
    );
    expect(report.ok).toBe(true);
    expect(report.leftCount).toBe(2);
    expect(report.rightCount).toBe(2);
  });

  test("names the key missing on the right", () => {
    const report = compareDictionaries({ a: "1", b: "2" }, { a: "satu" });
    expect(report.missingInRight).toEqual(["b"]);
    expect(report.missingInLeft).toEqual([]);
    expect(report.ok).toBe(false);
  });

  test("names the key missing on the left", () => {
    const report = compareDictionaries({ a: "1" }, { a: "satu", extra: "x" });
    expect(report.missingInLeft).toEqual(["extra"]);
    expect(report.ok).toBe(false);
  });

  test("reports blank values on either side", () => {
    const report = compareDictionaries({ a: "  " }, { a: "" });
    expect(report.emptyInLeft).toEqual(["a"]);
    expect(report.emptyInRight).toEqual(["a"]);
    expect(report.ok).toBe(false);
  });

  test("reports a nested mismatch by its full path", () => {
    const report = compareDictionaries(
      { deep: { deeper: { key: "x" } } },
      { deep: { deeper: {} } },
    );
    expect(report.missingInRight).toEqual(["deep.deeper.key"]);
  });

  test("does not treat a reordered array as a difference", () => {
    const report = compareDictionaries(
      { list: ["a", "b", "c"] },
      { list: ["c", "a", "b"] },
    );
    expect(report.ok).toBe(true);
  });

  test("sorts the output so the report is stable", () => {
    const report = compareDictionaries({}, { z: "1", a: "2", m: "3" });
    expect(report.missingInLeft).toEqual(["a", "m", "z"]);
  });

  test("treats two empty objects as matching", () => {
    expect(compareDictionaries({}, {}).ok).toBe(true);
  });
});

describe("parseDictionary", () => {
  test("parses an object", () => {
    expect(parseDictionary('{"a":"b"}')).toEqual({ value: { a: "b" } });
  });

  test("rejects empty input", () => {
    expect(parseDictionary("   ")).toEqual({ error: "empty" });
  });

  test("distinguishes malformed JSON from a non-object", () => {
    expect(parseDictionary("{ nope")).toEqual({ error: "invalid-json" });
    expect(parseDictionary("[1,2,3]")).toEqual({ error: "not-an-object" });
    expect(parseDictionary("42")).toEqual({ error: "not-an-object" });
  });
});
