/**
 * Two dedupe passes:
 *  1. Consecutive identical lines  → "line (repeated 47x)"
 *  2. Template-level dedupe        → after N occurrences of the same
 *     template, further lines are dropped and summarized in place.
 */

import { isPriorityLine, templateOf } from "./template.js";

export function collapseConsecutiveDuplicates(lines: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    let j = i + 1;
    while (j < lines.length && lines[j] === lines[i]) j++;
    const count = j - i;
    if (count >= 3 && lines[i].trim() !== "") {
      out.push(`${lines[i]}  (repeated ${count}x)`);
    } else {
      for (let k = i; k < j; k++) out.push(lines[k]);
    }
    i = j;
  }
  return out;
}

export interface TemplateDedupeOptions {
  /** Occurrences of one template to keep verbatim. */
  maxPerTemplate: number;
  /** Higher cap for lines matching error patterns. */
  maxPerErrorTemplate: number;
}

export function dedupeByTemplate(
  lines: string[],
  opts: TemplateDedupeOptions = { maxPerTemplate: 3, maxPerErrorTemplate: 8 }
): string[] {
  // Pass 1: count occurrences per template.
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (line.trim() === "") continue;
    const t = templateOf(line);
    totals.set(t, (totals.get(t) ?? 0) + 1);
  }

  // Pass 2: emit, dropping past the cap; one summary marker per template.
  const seen = new Map<string, number>();
  const summarized = new Set<string>();
  const out: string[] = [];

  for (const line of lines) {
    if (line.trim() === "") {
      out.push(line);
      continue;
    }
    const t = templateOf(line);
    const cap = isPriorityLine(line) ? opts.maxPerErrorTemplate : opts.maxPerTemplate;
    const n = (seen.get(t) ?? 0) + 1;
    seen.set(t, n);

    if (n <= cap) {
      out.push(line);
    } else if (!summarized.has(t)) {
      summarized.add(t);
      const remaining = (totals.get(t) ?? n) - cap;
      out.push(`  (+${remaining} similar lines omitted by logslim)`);
    }
  }
  return out;
}
