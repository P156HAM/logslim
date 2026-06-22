/**
 * Structured (JSON-per-line) log handling — the shape cloud logs come in.
 * CloudWatch, GCP Cloud Logging, Datadog, and most container/k8s logs emit one
 * JSON object per line. Piped through logslim they collapse dramatically:
 *
 *   aws logs tail /my/group --format short | logslim --mode full
 *   gcloud logging read ...                | logslim --mode full
 *   kubectl logs deploy/api                | logslim --mode full
 *
 * We render each entry down to "LEVEL  message" so the existing dedupe/template
 * machinery can group the thousands of near-identical lines cloud logs produce,
 * while severity keywords keep ERROR/WARN entries from being collapsed away.
 */

const LEVEL_KEYS = ["level", "severity", "levelname", "loglevel", "status"];
const MESSAGE_KEYS = ["message", "msg", "@message", "textPayload", "event", "log"];

interface LogEntry {
  level: string;
  message: string;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return "";
}

function parseLine(line: string): LogEntry | null {
  const t = line.trim();
  if (t.length < 2 || t[0] !== "{" || t[t.length - 1] !== "}") return null;

  let obj: unknown;
  try {
    obj = JSON.parse(t);
  } catch {
    return null;
  }
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return null;

  const o = obj as Record<string, unknown>;
  const nested =
    o.jsonPayload && typeof o.jsonPayload === "object" && !Array.isArray(o.jsonPayload)
      ? (o.jsonPayload as Record<string, unknown>)
      : null;

  const level = pickString(o, LEVEL_KEYS) || (nested ? pickString(nested, LEVEL_KEYS) : "");
  let message = pickString(o, MESSAGE_KEYS) || (nested ? pickString(nested, MESSAGE_KEYS) : "");

  const hasTimestamp =
    "timestamp" in o || "time" in o || "@timestamp" in o || "ts" in o || "eventTime" in o;

  // It's a log entry if it carries a level, a message, or a timestamp.
  if (!level && !message && !hasTimestamp) return null;
  if (!message) message = t; // no obvious message field — keep the raw object

  return { level: level.toUpperCase(), message };
}

/** True when the text is predominantly JSON-per-line log output. */
export function isStructuredLog(text: string): boolean {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 5) return false;
  const sample = lines.slice(0, 80);
  let parsed = 0;
  for (const l of sample) if (parseLine(l)) parsed++;
  return parsed >= 5 && parsed / sample.length >= 0.6;
}

/** Render JSON log lines down to "LEVEL  message"; pass other lines through. */
export function renderStructured(lines: string[]): string[] {
  return lines.map((line) => {
    const entry = parseLine(line);
    if (!entry) return line;
    return entry.level ? `${entry.level.padEnd(5)}  ${entry.message}` : entry.message;
  });
}
