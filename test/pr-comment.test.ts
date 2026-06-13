import { strict as assert } from "node:assert";
import { test } from "node:test";
import { formatPrComment, PR_COMMENT_MARKER } from "../src/pr-comment.js";
import { process } from "../src/index.js";
import { JEST_LOG } from "./fixtures.js";

test("formatPrComment includes marker and failures", () => {
  const result = process(JEST_LOG, { mode: "failure", exitCode: 1 });
  const md = formatPrComment({
    failed: result.failed,
    errors: result.errors,
    codes: result.codes,
    context: { branch: "feat/x", commit: "a3f2c1d" },
    stats: result.stats,
    runUrl: "https://github.com/o/r/actions/runs/1",
  });

  assert.ok(md.includes(PR_COMMENT_MARKER));
  assert.ok(md.includes("## ❌"));
  assert.ok(md.includes("Failures"));
  assert.ok(md.includes("feat/x"));
  assert.ok(md.includes("logslim"));
  assert.ok(md.includes("View full CI log"));
});

test("formatPrComment handles success", () => {
  const md = formatPrComment({
    failed: false,
    errors: [],
    codes: [],
    context: {},
    stats: { linesIn: 5, linesOut: 5, tokensIn: 50, tokensOut: 50, saved: 0, applied: "light" },
  });
  assert.ok(md.includes("✅"));
});
