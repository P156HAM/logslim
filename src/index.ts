/**
 * logslim — compact noisy command output before an AI agent reads it.
 *
 * Two entry points:
 *   compact()  — shrink only (backwards compatible)
 *   process()  — shrink + extract errors + attach code cards + optional context
 */

import { cleanTerminalOutput } from "./ansi.js";
import { collapseConsecutiveDuplicates, dedupeByTemplate } from "./dedupe.js";
import { collapseStackFrames } from "./stack.js";
import { enforceBudget } from "./budget.js";
import { estimateTokens } from "./tokens.js";
import { extractErrors, type ExtractedError } from "./extract.js";
import { codesFromText, type ErrorCodeCard } from "./codes.js";
import { formatContext, gatherContext, type AttachSource } from "./attach.js";
import { isPriorityLine } from "./template.js";

export type CompactMode = "failure" | "full" | "light";

export interface CompactOptions {
  /** failure = compact hard only on non-zero exit / detected failure (default). */
  mode?: CompactMode;
  /** Exit code from the wrapped command (enables accurate failure mode). */
  exitCode?: number;
  /** Hard token budget; 0 disables (default 0). */
  budget?: number;
  maxPerTemplate?: number;
  maxPerErrorTemplate?: number;
  contextLines?: number;
  /** Prepend git/ci context lines (default none). */
  attach?: AttachSource[];
  /** Include error code lookup cards (default true for process()). */
  lookupCodes?: boolean;
}

export interface CompactStats {
  linesIn: number;
  linesOut: number;
  tokensIn: number;
  tokensOut: number;
  saved: number;
  /** Which compaction path ran. */
  applied: "full" | "light" | "none";
}

export interface CompactResult {
  text: string;
  stats: CompactStats;
}

export interface ProcessResult extends CompactResult {
  errors: ExtractedError[];
  codes: ErrorCodeCard[];
  context: Record<string, string>;
  exitCode?: number;
  failed: boolean;
}

const FAILURE_HINT =
  /\b(FAIL|ERROR|Error:|failed|AssertionError|npm ERR!|TS\d{4}|panic|Exception|traceback)\b/i;

function looksLikeFailure(text: string): boolean {
  return FAILURE_HINT.test(text);
}

function shouldCompactHard(opts: CompactOptions, text: string): boolean {
  const mode = opts.mode ?? "failure";
  if (mode === "full") return true;
  if (mode === "light") return false;
  // failure mode
  if (opts.exitCode !== undefined) return opts.exitCode !== 0;
  return looksLikeFailure(text);
}

/** Light path: strip terminal noise only; optionally cap very long success output. */
function compactLight(input: string, maxLines = 200): string {
  let lines = cleanTerminalOutput(input).split("\n");
  if (lines.length > maxLines) {
    const head = lines.slice(0, 20);
    const tail = lines.slice(-30);
    lines = [...head, `[logslim: ${lines.length - 50} lines omitted — success output truncated]`, ...tail];
  }
  return lines.join("\n").trimEnd();
}

function compactFull(input: string, options: CompactOptions): string {
  const {
    budget = 0,
    maxPerTemplate = 3,
    maxPerErrorTemplate = 8,
    contextLines = 2,
  } = options;

  const cleaned = cleanTerminalOutput(input);
  let lines = cleaned.split("\n");

  lines = collapseConsecutiveDuplicates(lines);
  lines = collapseStackFrames(lines);
  lines = dedupeByTemplate(lines, { maxPerTemplate, maxPerErrorTemplate });
  lines = lines.filter((l, i, arr) => l.trim() !== "" || (i > 0 && arr[i - 1].trim() !== ""));

  if (budget > 0) {
    lines = enforceBudget(lines, budget, contextLines);
  }

  return lines.join("\n").trimEnd();
}

function buildStats(input: string, output: string, applied: CompactStats["applied"]): CompactStats {
  const tokensIn = estimateTokens(input);
  const tokensOut = estimateTokens(output);
  return {
    linesIn: input.split("\n").length,
    linesOut: output === "" ? 0 : output.split("\n").length,
    tokensIn,
    tokensOut,
    saved: tokensIn === 0 ? 0 : Math.max(0, 1 - tokensOut / tokensIn),
    applied,
  };
}

/** Shrink log text. Backwards-compatible API. */
export function compact(input: string, options: CompactOptions = {}): CompactResult {
  const hard = shouldCompactHard(options, input);
  const text = hard ? compactFull(input, options) : compactLight(input);
  return {
    text,
    stats: buildStats(input, text, hard ? "full" : "light"),
  };
}

/** Full pipeline: shrink + structured errors + code cards + optional context. */
export function process(input: string, options: CompactOptions = {}): ProcessResult {
  const { text, stats } = compact(input, options);
  const failed =
    options.exitCode !== undefined ? options.exitCode !== 0 : looksLikeFailure(input);

  const attach = options.attach ?? [];
  const context = attach.length > 0 ? gatherContext(attach) : {};
  const ctxLine = formatContext(context);

  let out = text;
  if (ctxLine) out = `${ctxLine}\n---\n${out}`;

  const lookup = options.lookupCodes !== false;
  const codes = lookup ? codesFromText(input) : [];
  const errors = failed ? extractErrors(out) : [];

  return {
    text: out,
    stats,
    errors,
    codes,
    context,
    exitCode: options.exitCode,
    failed,
  };
}

export { estimateTokens } from "./tokens.js";
export type { ExtractedError } from "./extract.js";
export type { ErrorCodeCard } from "./codes.js";
export type { AttachSource } from "./attach.js";
export { isPriorityLine } from "./template.js";
export { formatPrComment, PR_COMMENT_MARKER } from "./pr-comment.js";
export type { PrCommentInput } from "./pr-comment.js";
