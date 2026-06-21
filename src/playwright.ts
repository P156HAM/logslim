/**
 * Playwright (list reporter) handling. Its output repeats the entire failure
 * block for every retry, pads each section with box-drawing rules, and prints
 * screenshot/trace attachment blocks an agent can't act on — so generic dedupe
 * barely touches it. This module collapses those structurally and extracts the
 * one thing that matters: which test failed, where, and why.
 */

import type { ExtractedError } from "./extract.js";

const TEST_HEADER_RE = /^\s*\d+\)\s+(\S+):(\d+):(\d+)\s+›\s+(.+)$/;
const RETRY_RE = /^\s*Retry #(\d+)\b/;
const SUMMARY_RE = /^\s*\d+\s+(failed|passed|skipped|flaky|did not run)\b/i;
const ATTACH_START_RE = /^\s*(attachment #\d+:|Error Context:)/i;
const RULE_ONLY_RE = /^[─—\s]+$/;
const HAS_RULE_RE = /[─—]/;
const TRAILING_RULE_RE = /\s*[─—]{3,}\s*$/;

/** Detect Playwright list-reporter output (needs ≥2 distinct markers). */
export function isPlaywrightOutput(text: string): boolean {
  let hits = 0;
  if (/Running \d+ tests? using \d+ workers?/i.test(text)) hits++;
  if (/\bCall log:/.test(text)) hits++;
  if (/npx playwright show-trace/.test(text)) hits++;
  if (/^\s*\d+\)\s+\S+:\d+:\d+\s+›\s+/m.test(text)) hits++;
  return hits >= 2;
}

function isRuleOnly(line: string): boolean {
  const t = line.trim();
  return t.length >= 6 && RULE_ONLY_RE.test(t) && HAS_RULE_RE.test(t);
}

function stripTrailingRule(line: string): string {
  return line.replace(TRAILING_RULE_RE, "").replace(/\s+$/, "");
}

/**
 * Structurally compact Playwright output: drop decorative rules, fold each
 * attachment/trace block to one line, and collapse a repeated Retry block to a
 * single marker. Lossy but marked — re-run raw for the full reporter output.
 */
export function compactPlaywright(lines: string[]): string[] {
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];

    if (isRuleOnly(rawLine)) {
      i++;
      continue;
    }

    const line = stripTrailingRule(rawLine);

    // A retry of a failed test repeats the same failure — collapse the block.
    const retry = line.match(RETRY_RE);
    if (retry) {
      let j = i + 1;
      while (
        j < lines.length &&
        !SUMMARY_RE.test(lines[j]) &&
        !TEST_HEADER_RE.test(stripTrailingRule(lines[j]))
      ) {
        j++;
      }
      const omitted = j - i - 1;
      out.push(
        `    ↳ Retry #${retry[1]} reproduced the same failure (${omitted} lines omitted by logslim)`
      );
      i = j;
      continue;
    }

    // Fold a screenshot/trace/error-context attachment block into one line.
    if (ATTACH_START_RE.test(line)) {
      const types = new Set<string>();
      let j = i;
      while (j < lines.length) {
        const s = stripTrailingRule(lines[j]);
        const t = s.trim();
        if (j > i && (RETRY_RE.test(s) || SUMMARY_RE.test(lines[j]) || TEST_HEADER_RE.test(s))) {
          break;
        }
        const attachy =
          t === "" ||
          isRuleOnly(lines[j]) ||
          /^attachment #\d+:/i.test(t) ||
          /^Error Context:/i.test(t) ||
          /^Usage:/i.test(t) ||
          /npx playwright show-trace/.test(t) ||
          /^test-results\//.test(t);
        if (!attachy) break;
        if (/screenshot/i.test(t)) types.add("screenshot");
        if (/\btrace\b/i.test(t)) types.add("trace");
        if (/^Error Context:/i.test(t)) types.add("error-context");
        j++;
      }
      const list = [...types].join(", ") || "files";
      out.push(`    (attachments: ${list} — omitted by logslim)`);
      i = j;
      continue;
    }

    out.push(line);
    i++;
  }

  return out;
}

/** Pull structured failures from Playwright output (raw or already compacted). */
export function extractPlaywrightErrors(text: string): ExtractedError[] {
  const lines = text.split("\n");
  const out: ExtractedError[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const header = lines[i].match(TEST_HEADER_RE);
    if (!header) continue;

    const file = header[1];
    let line = parseInt(header[2], 10); // test declaration line — refined below
    let column: number | undefined;
    const name = stripTrailingRule(header[4]).trim();
    const base = (file.split("/").pop() ?? file).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const atRe = new RegExp(`\\bat\\s+.*${base}:(\\d+):(\\d+)`);

    let message = "";
    let expected = "";
    let received = "";

    for (
      let j = i + 1;
      j < lines.length && !TEST_HEADER_RE.test(lines[j]) && !SUMMARY_RE.test(lines[j]);
      j++
    ) {
      const s = lines[j];
      if (!message) {
        const e = s.match(/^\s*Error:\s*(.+?)\s*$/);
        if (e) message = stripTrailingRule(e[1]).trim();
      }
      const exp = s.match(/^\s*Expected:\s*(.+?)\s*$/);
      if (exp) expected = exp[1].trim();
      const rec = s.match(/^\s*Received:\s*(.+?)\s*$/);
      if (rec) received = rec[1].trim();
      const at = s.match(atRe);
      if (at) {
        line = parseInt(at[1], 10); // the failing source line is more useful
        column = parseInt(at[2], 10);
      }
    }

    let msg = name || "Playwright test failed";
    if (message) msg += ` — ${message}`;
    if (expected || received) {
      msg += ` (Expected: ${expected || "?"}, Received: ${received || "?"})`;
    }

    const key = `${file}:${line}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ file, line, column, message: msg, kind: "test_failure" });
  }

  return out.slice(0, 20);
}
