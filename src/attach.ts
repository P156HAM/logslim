/**
 * Lightweight context bundle — answers "what was happening when this broke?"
 * without Slack/deploy integrations. Reads git + CI env vars only.
 */

export type AttachSource = "git" | "ci";

export function gatherContext(sources: AttachSource[]): Record<string, string> {
  const ctx: Record<string, string> = {};

  if (sources.includes("git")) {
    if (process.env.GITHUB_HEAD_REF) ctx.branch = process.env.GITHUB_HEAD_REF;
    else if (process.env.GITHUB_REF_NAME) ctx.branch = process.env.GITHUB_REF_NAME;

    if (process.env.GITHUB_SHA) ctx.commit = process.env.GITHUB_SHA.slice(0, 7);
    if (process.env.GITHUB_REPOSITORY) ctx.repo = process.env.GITHUB_REPOSITORY;
  }

  if (sources.includes("ci")) {
    if (process.env.CI) ctx.ci = "true";
    if (process.env.GITHUB_ACTIONS) ctx.platform = "github-actions";
    if (process.env.GITHUB_RUN_ID) ctx.run = process.env.GITHUB_RUN_ID;
    if (process.env.GITHUB_EVENT_NAME) ctx.event = process.env.GITHUB_EVENT_NAME;
    if (process.env.GITHUB_PR_NUMBER || process.env.GITHUB_REF?.includes("/pull/")) {
      const pr = process.env.GITHUB_PR_NUMBER ?? process.env.GITHUB_REF?.match(/pull\/(\d+)/)?.[1];
      if (pr) ctx.pr = `#${pr}`;
    }
  }

  return ctx;
}

export function formatContext(ctx: Record<string, string>): string {
  if (Object.keys(ctx).length === 0) return "";
  const parts = Object.entries(ctx).map(([k, v]) => `${k}: ${v}`);
  return parts.join(" | ");
}
