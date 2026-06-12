/**
 * Terminal noise removal: ANSI escape sequences and carriage-return
 * overwrites (progress bars/spinners render as hundreds of \r-segments —
 * only the final state of each line is real output).
 */

// CSI sequences, OSC sequences, and single-char escapes.
const ANSI_RE =
  // eslint-disable-next-line no-control-regex
  /\x1B(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1B]*(?:\x07|\x1B\\)?|[@-Z\\-_])/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

/** Keep only the final overwrite of every \r-rewritten line. */
export function resolveCarriageReturns(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (!line.includes("\r")) return line;
      const segments = line.split("\r");
      return segments[segments.length - 1] || segments[segments.length - 2] || "";
    })
    .join("\n");
}

export function cleanTerminalOutput(text: string): string {
  return resolveCarriageReturns(stripAnsi(text.replace(/\r\n/g, "\n")));
}
