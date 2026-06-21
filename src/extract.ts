/**
 * Pull structured errors out of compacted log text so agents/CI don't have
 * to re-parse prose. Works on common test-runner and compiler formats.
 */

export interface ExtractedError {
  file?: string;
  line?: number;
  column?: number;
  message: string;
  kind?: "assertion" | "compile" | "runtime" | "test_failure" | "npm";
}

import { isPlaywrightOutput, extractPlaywrightErrors } from "./playwright.js";

const FILE_LINE_RE =
  /(?:at\s+.*?\(([^)]+):(\d+):(\d+)\)|at\s+([^\s(]+):(\d+):(\d+)|([^\s:]+\.[a-z]+):(\d+):(\d+))/i;
const FAIL_SUITE_RE = /^\s*FAIL\s+(\S+)/;
const TS_ERROR_RE = /^(.*)\((\d+),(\d+)\):\s*error\s+TS\d+:\s*(.+)$/i;
const WEBPACK_ERROR_RE = /^ERROR in (\S+)\s+(\d+):(\d+)/;
const TS_CODE_LINE_RE = /^(TS\d+):\s*(.+)$/;
const NPM_ERR_RE = /^npm ERR! (.+)$/i;

export function extractErrors(text: string): ExtractedError[] {
  if (isPlaywrightOutput(text)) return extractPlaywrightErrors(text);

  const lines = text.split("\n");
  const out: ExtractedError[] = [];
  const seen = new Set<string>();

  const push = (e: ExtractedError) => {
    const key = `${e.file ?? ""}:${e.line ?? ""}:${e.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(e);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fail = line.match(FAIL_SUITE_RE);
    if (fail) {
      push({ file: fail[1], message: `Test suite failed: ${fail[1]}`, kind: "test_failure" });
      continue;
    }

    const ts = line.match(TS_ERROR_RE);
    if (ts) {
      push({
        file: ts[1].trim(),
        line: parseInt(ts[2], 10),
        column: parseInt(ts[3], 10),
        message: ts[4].trim(),
        kind: "compile",
      });
      continue;
    }

    const wp = line.match(WEBPACK_ERROR_RE);
    if (wp) {
      const next = lines[i + 1] ?? "";
      const tsLine = next.match(TS_CODE_LINE_RE);
      push({
        file: wp[1],
        line: parseInt(wp[2], 10),
        column: parseInt(wp[3], 10),
        message: tsLine ? `${tsLine[1]}: ${tsLine[2]}` : next.trim() || line.trim(),
        kind: "compile",
      });
      continue;
    }

    const tsOnly = line.match(TS_CODE_LINE_RE);
    if (tsOnly && i > 0 && WEBPACK_ERROR_RE.test(lines[i - 1])) {
      continue; // already captured with webpack ERROR line
    }

    const npm = line.match(NPM_ERR_RE);
    if (npm && !npm[1].startsWith("code ")) {
      push({ message: npm[1], kind: "npm" });
      continue;
    }

    if (/^\s*Expected:/.test(line) && i > 0) {
      const prev = lines[i - 1];
      const received = lines[i + 1]?.match(/^\s*Received:\s*(.+)/);
      push({
        message: `${prev.trim()} | Expected: ${line.trim()}${received ? ` | Received: ${received[1]}` : ""}`,
        kind: "assertion",
      });
      continue;
    }

    if (/AssertionError|Error:|TypeError:|ReferenceError:|SyntaxError:/.test(line)) {
      const fl = line.match(FILE_LINE_RE);
      push({
        file: fl ? fl[1] || fl[4] || fl[7] : undefined,
        line: fl ? parseInt(fl[2] || fl[5] || fl[8], 10) : undefined,
        column: fl ? parseInt(fl[3] || fl[6] || fl[9], 10) : undefined,
        message: line.trim(),
        kind: "runtime",
      });
    }
  }

  return out.slice(0, 20); // cap — agents don't need 200 duplicate extractions
}
