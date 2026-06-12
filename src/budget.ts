/**
 * Optional hard token budget. When the compacted log still exceeds the
 * budget, keep what matters to an agent, in this order:
 *   1. priority lines (errors/failures) with surrounding context
 *   2. the head and the tail of the log (commands echo setup at the top,
 *      summaries and exit reasons at the bottom)
 * Everything trimmed is replaced by a single marker so the agent knows.
 */

import { isPriorityLine } from "./template.js";
import { estimateTokens } from "./tokens.js";

export function enforceBudget(lines: string[], budgetTokens: number, contextLines = 2): string[] {
  const full = lines.join("\n");
  if (estimateTokens(full) <= budgetTokens) return lines;

  const keep = new Array<boolean>(lines.length).fill(false);

  // 1. Priority lines + context.
  for (let i = 0; i < lines.length; i++) {
    if (isPriorityLine(lines[i])) {
      for (let j = Math.max(0, i - contextLines); j <= Math.min(lines.length - 1, i + contextLines); j++) {
        keep[j] = true;
      }
    }
  }

  // 2. Head and tail, while budget allows.
  let tokens = lines.reduce((sum, l, i) => (keep[i] ? sum + estimateTokens(l) + 1 : sum), 0);
  const tryKeep = (i: number): boolean => {
    if (keep[i]) return true;
    const cost = estimateTokens(lines[i]) + 1;
    if (tokens + cost > budgetTokens) return false;
    keep[i] = true;
    tokens += cost;
    return true;
  };

  let head = 0;
  let tail = lines.length - 1;
  let headOpen = true;
  let tailOpen = true;
  while ((headOpen || tailOpen) && head <= tail) {
    if (tailOpen) {
      tailOpen = tryKeep(tail);
      if (tailOpen) tail--;
    }
    if (headOpen && head <= tail) {
      headOpen = tryKeep(head);
      if (headOpen) head++;
    }
  }

  // Emit with one marker per trimmed gap.
  const out: string[] = [];
  let trimmed = 0;
  for (let i = 0; i < lines.length; i++) {
    if (keep[i]) {
      if (trimmed > 0) {
        out.push(`[logslim: ${trimmed} lines trimmed to fit token budget]`);
        trimmed = 0;
      }
      out.push(lines[i]);
    } else {
      trimmed++;
    }
  }
  if (trimmed > 0) out.push(`[logslim: ${trimmed} lines trimmed to fit token budget]`);
  return out;
}
