/**
 * Log templating: mask volatile values so that lines which differ only in
 * timestamps, ids, numbers or hashes share one template. This is the cheap
 * cousin of the Drain log-parsing algorithm — good enough for tool output.
 */

const MASKS: Array<[RegExp, string]> = [
  // ISO timestamps & common datetime formats
  [/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, "<TS>"],
  [/\d{2}:\d{2}:\d{2}(?:[.,]\d+)?/g, "<TS>"],
  // UUIDs
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<UUID>"],
  // Long hex (shas, addresses, pointers)
  [/\b(?:0x)?[0-9a-f]{7,64}\b/gi, "<HEX>"],
  // Durations & sizes keep their unit, mask the number below
  // Any number (int, float, with separators)
  [/(?<![a-zA-Z])[-+]?\d[\d_,]*(?:\.\d+)?(?:e[-+]?\d+)?/gi, "<N>"],
];

export function templateOf(line: string): string {
  let t = line.trim();
  for (const [re, replacement] of MASKS) {
    t = t.replace(re, replacement);
  }
  return t;
}

const ERROR_RE =
  /\b(error|err!|fail(ed|ure)?|exception|fatal|panic|traceback|assert(ion)?|cannot|unable to|denied|refused|timeout|timed out)\b/i;

/** Lines an agent must not lose. Checked on the raw line, not the template. */
export function isPriorityLine(line: string): boolean {
  return ERROR_RE.test(line);
}
