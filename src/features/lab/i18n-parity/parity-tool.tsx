"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client-context";
import {
  compareDictionaries,
  parseDictionary,
  type ParityReport,
} from "./compare";

/**
 * Compares two dictionary files and reports where their keys diverge.
 *
 * Entirely client-side — both files are read and parsed in the tab and nothing is sent
 * anywhere. That is the Lab's stated promise ("local-first whenever possible") and here it
 * is also the obvious design: the files are translation dictionaries, often for a product
 * nobody else should see.
 *
 * The interesting output is not the counts. It is the key paths: a missing string is
 * invisible until someone switches language, so the value of this tool is naming the exact
 * key rather than saying "28 differences".
 */

type Side = "left" | "right";
type SideErrors = { left?: string; right?: string };

export function ParityTool() {
  const { dictionary } = useI18n();
  const t = dictionary.parityTool;

  const [text, setText] = useState<Record<Side, string>>({
    left: "",
    right: "",
  });
  const [errors, setErrors] = useState<SideErrors>({});
  const [report, setReport] = useState<ParityReport | null>(null);

  const setSide = (side: Side, value: string) => {
    setText((current) => ({ ...current, [side]: value }));
  };

  const errorLabel = (code: string) =>
    code === "empty"
      ? t.errorEmpty
      : code === "invalid-json"
        ? t.errorInvalidJson
        : t.errorNotObject;

  async function readFile(side: Side, file: File | undefined) {
    if (!file) return;
    setSide(side, await file.text());
  }

  function compare() {
    const left = parseDictionary(text.left);
    const right = parseDictionary(text.right);

    const next: SideErrors = {};
    if ("error" in left) next.left = errorLabel(left.error);
    if ("error" in right) next.right = errorLabel(right.error);

    setErrors(next);

    if ("error" in left || "error" in right) {
      setReport(null);
      return;
    }

    setReport(compareDictionaries(left.value, right.value));
  }

  function reset() {
    setText({ left: "", right: "" });
    setErrors({});
    setReport(null);
  }

  const ready = text.left.trim() !== "" && text.right.trim() !== "";

  return (
    <div className="parity-tool">
      <p className="parity-local-note">
        <span aria-hidden="true">●</span> {t.localNote}
      </p>

      <div className="parity-panels">
        {(["left", "right"] as const).map((side) => (
          <div className="parity-panel" key={side}>
            <label className="parity-label" htmlFor={`parity-${side}`}>
              {side === "left" ? t.leftLabel : t.rightLabel}
            </label>
            <input
              accept=".json,application/json"
              className="parity-file"
              id={`parity-file-${side}`}
              onChange={(event) => void readFile(side, event.target.files?.[0])}
              type="file"
            />
            <textarea
              className="parity-textarea"
              id={`parity-${side}`}
              onChange={(event) => setSide(side, event.target.value)}
              placeholder={t.pastePlaceholder}
              spellCheck={false}
              value={text[side]}
            />
            {errors[side] ? (
              <p className="parity-error" role="alert">
                {errors[side]}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="parity-actions">
        <button
          className="parity-button"
          disabled={!ready}
          onClick={compare}
          type="button"
        >
          {t.compare}
        </button>
        <button
          className="parity-button parity-button-quiet"
          onClick={reset}
          type="button"
        >
          {t.clear}
        </button>
      </div>

      {report ? (
        <section className="parity-result" aria-live="polite">
          <p className="parity-verdict">
            <span aria-hidden="true">{report.ok ? "✓" : "✗"}</span>
            {report.ok ? t.allMatch : t.drift}
          </p>

          <dl className="parity-counts">
            <div>
              <dt>{t.keyCountLeft}</dt>
              <dd>{report.leftCount}</dd>
            </div>
            <div>
              <dt>{t.keyCountRight}</dt>
              <dd>{report.rightCount}</dd>
            </div>
          </dl>

          <ParityList
            keys={report.missingInRight}
            label={t.missingInRight}
            empty={t.none}
          />
          <ParityList
            keys={report.missingInLeft}
            label={t.missingInLeft}
            empty={t.none}
          />
          <ParityList
            keys={report.emptyInLeft}
            label={t.emptyInLeft}
            empty={t.none}
          />
          <ParityList
            keys={report.emptyInRight}
            label={t.emptyInRight}
            empty={t.none}
          />
        </section>
      ) : null}
    </div>
  );
}

/** Only rendered when there is something to say — four empty lists say nothing. */
function ParityList({
  keys,
  label,
  empty,
}: {
  keys: string[];
  label: string;
  empty: string;
}) {
  if (keys.length === 0) return null;

  return (
    <div className="parity-list">
      <p className="parity-list-label">
        {label} <span>{keys.length}</span>
      </p>
      <ul>
        {keys.map((key) => (
          <li key={key}>{key}</li>
        ))}
      </ul>
    </div>
  );
}
