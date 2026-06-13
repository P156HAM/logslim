#!/usr/bin/env node
/**
 * GitHub Action entry: run logslim on a log file and upsert a PR comment.
 */

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatPrComment, PR_COMMENT_MARKER } from "../dist/pr-comment.js";

const actionDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(actionDir, "..");

function input(name) {
  const key = `INPUT_${name.replace(/-/g, "_").toUpperCase()}`;
  return process.env[key] ?? "";
}

function getPrNumber() {
  const explicit = input("pr-number");
  if (explicit) return parseInt(explicit, 10);

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) return null;

  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  return event.pull_request?.number ?? event.issue?.number ?? null;
}

function runLogslim(logText, exitCode) {
  const useLocal = input("local") === "true";
  const version = input("logslim-version") || "0.3.0";
  const args = [
    "--json",
    "--attach",
    "git,ci",
    "--exit-code",
    String(exitCode),
    "--no-stats",
  ];

  if (useLocal) {
    const cli = join(repoRoot, "dist", "cli.js");
    const child = spawnSync(process.execPath, [cli, ...args], {
      input: logText,
      encoding: "utf8",
      cwd: repoRoot,
    });
    if (child.status !== 0 && !child.stdout?.trim()) {
      throw new Error(child.stderr || "logslim failed");
    }
    return child.stdout;
  }

  const child = spawnSync("npx", ["-y", `logslim@${version}`, ...args], {
    input: logText,
    encoding: "utf8",
    env: process.env,
  });
  if (child.status !== 0 && !child.stdout?.trim()) {
    throw new Error(child.stderr || `npx logslim@${version} failed`);
  }
  return child.stdout;
}

async function githubRequest(path, { method = "GET", body } = {}) {
  const token = input("github-token");
  if (!token) throw new Error("github-token input is required");

  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "logslim-action",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function upsertPrComment(repo, prNumber, body) {
  const comments = await githubRequest(
    `/repos/${repo}/issues/${prNumber}/comments?per_page=100`
  );
  const existing = comments.find((c) => c.body?.includes(PR_COMMENT_MARKER));

  if (existing) {
    await githubRequest(`/repos/${repo}/issues/comments/${existing.id}`, {
      method: "PATCH",
      body: { body },
    });
    return "updated";
  }

  await githubRequest(`/repos/${repo}/issues/${prNumber}/comments`, {
    method: "POST",
    body: { body },
  });
  return "created";
}

async function main() {
  const logFile = input("log-file");
  if (!logFile || !existsSync(logFile)) {
    throw new Error(`log-file not found: ${logFile || "(empty)"}`);
  }

  const exitCode = parseInt(input("exit-code") || "1", 10);
  const skipOnSuccess = input("skip-on-success") !== "false";
  const logText = readFileSync(logFile, "utf8");

  const rawJson = runLogslim(logText, exitCode);
  const result = JSON.parse(rawJson);

  if (!result.failed && skipOnSuccess) {
    console.log("logslim: no failure detected — skipping PR comment");
    return;
  }

  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error("GITHUB_REPOSITORY is not set");

  const prNumber = getPrNumber();
  if (!prNumber) {
    console.log("logslim: not a pull_request event — skipping PR comment");
    return;
  }

  const server = process.env.GITHUB_SERVER_URL || "https://github.com";
  const runId = process.env.GITHUB_RUN_ID;
  const runUrl = runId ? `${server}/${repo}/actions/runs/${runId}` : undefined;

  const body = formatPrComment({
    failed: result.failed,
    errors: result.errors ?? [],
    codes: result.codes ?? [],
    context: result.context ?? {},
    stats: result.stats,
    runUrl,
  });

  const action = await upsertPrComment(repo, prNumber, body);
  console.log(`logslim: PR comment ${action} on #${prNumber}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
