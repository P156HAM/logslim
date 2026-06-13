/**
 * Format logslim process() output as a GitHub PR comment.
 */

import type { CompactStats } from "./index.js";
import type { ExtractedError } from "./extract.js";
import type { ErrorCodeCard } from "./codes.js";

export const PR_COMMENT_MARKER = "<!-- logslim-ci-summary -->";

export interface PrCommentInput {
  failed: boolean;
  errors: ExtractedError[];
  codes: ErrorCodeCard[];
  context: Record<string, string>;
  stats: CompactStats;
  runUrl?: string;
}

function formatContext(ctx: Record<string, string>): string {
  const parts = Object.entries(ctx).map(([k, v]) => `**${k}:** \`${v}\``);
  return parts.length > 0 ? parts.join(" · ") + "\n\n" : "";
}

export function formatPrComment(input: PrCommentInput): string {
  if (!input.failed) {
    return `${PR_COMMENT_MARKER}\n## ✅ Checks passed\n\nlogslim found no failures in the log.`;
  }

  let body = `${PR_COMMENT_MARKER}\n## ❌ Test / build failures\n\n`;
  body += formatContext(input.context);

  if (input.errors.length > 0) {
    body += `### Failures (${input.errors.length})\n\n`;
    const shown = input.errors.slice(0, 15);
    for (let i = 0; i < shown.length; i++) {
      const e = shown[i];
      const loc =
        e.file && e.line
          ? `\`${e.file}:${e.line}\``
          : e.file
            ? `\`${e.file}\``
            : "";
      body += `${i + 1}. ${loc}${loc ? " — " : ""}${e.message}\n`;
    }
    if (input.errors.length > 15) {
      body += `\n_+${input.errors.length - 15} more not shown_\n`;
    }
    body += "\n";
  } else {
    body += `_No structured errors extracted — see the full CI log below._\n\n`;
  }

  if (input.codes.length > 0) {
    body += `### Fix hints\n\n`;
    for (const c of input.codes) {
      body += `**\`${c.id}\`** — ${c.meaning}\n`;
      for (const step of c.fix_steps.slice(0, 3)) {
        body += `- ${step}\n`;
      }
      body += "\n";
    }
  }

  const pct = Math.round(input.stats.saved * 100);
  body += `---\n`;
  body += `<sub>Structured by [logslim](https://github.com/P156HAM/logslim) · ${input.stats.linesIn} → ${input.stats.linesOut} lines`;
  if (pct > 0) body += ` (~${pct}% log reduction for agents & reviewers)`;
  body += `</sub>\n`;
  if (input.runUrl) {
    body += `<sub>[View full CI log](${input.runUrl})</sub>\n`;
  }

  return body.trimEnd() + "\n";
}
