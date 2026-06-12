import { strict as assert } from "node:assert";
import { test } from "node:test";
import { compact } from "../src/index.js";
import { cleanTerminalOutput } from "../src/ansi.js";
import { templateOf, isPriorityLine } from "../src/template.js";
import { BUILD_LOG, JEST_LOG, PYTEST_LOG } from "./fixtures.js";

test("strips ANSI codes and resolves carriage-return progress bars", () => {
  const raw = "\x1B[32mok\x1B[0m\nstep 1/3\rstep 2/3\rstep 3/3 done";
  const cleaned = cleanTerminalOutput(raw);
  assert.equal(cleaned, "ok\nstep 3/3 done");
});

test("templates mask timestamps, ids and numbers", () => {
  const a = templateOf("warn deprecated prop used in <Button id=1042> at 2026-06-12T01:14:22.103Z");
  const b = templateOf("warn deprecated prop used in <Button id=1087> at 2026-06-12T09:15:22.108Z");
  assert.equal(a, b);
});

test("error lines are detected as priority", () => {
  assert.equal(isPriorityLine("ERROR in ./src/api/client.ts 88:12"), true);
  assert.equal(isPriorityLine("AssertionError: assert None == Decimal('42.50')"), true);
  assert.equal(isPriorityLine("asset chunk-aa.js 140.2 KiB [emitted]"), false);
});

test("jest log: keeps the failure, removes warn spam, saves >70% tokens", () => {
  const { text, stats } = compact(JEST_LOG);
  assert.ok(text.includes("FAIL src/checkout/cart.test.ts"), "must keep failing suite");
  assert.ok(text.includes("Expected: 89.10"), "must keep assertion detail");
  assert.ok(text.includes("cart.test.ts:48:27"), "must keep the app stack frame");
  assert.ok(text.includes("Tests:       1 failed, 41 passed, 42 total"), "must keep summary");
  assert.ok(text.includes("vendor/internal frames collapsed"), "must collapse jest-circus frames");
  assert.ok(text.includes("similar lines omitted"), "must summarize the warn spam");
  const warnCount = (text.match(/console\.warn deprecated/g) ?? []).length;
  assert.ok(warnCount <= 3, `warn spam should be capped, got ${warnCount}`);
  assert.ok(stats.saved > 0.7, `expected >70% savings, got ${Math.round(stats.saved * 100)}%`);
});

test("pytest log: keeps the root cause once, saves >60% tokens", () => {
  const { text, stats } = compact(PYTEST_LOG);
  assert.ok(text.includes("AssertionError: assert None == Decimal('42.50')"));
  assert.ok(text.includes("25 failed, 225 passed"), "must keep the summary line");
  assert.ok(stats.saved > 0.6, `expected >60% savings, got ${Math.round(stats.saved * 100)}%`);
});

test("build log: keeps both TS errors, drops asset noise, saves >85% tokens", () => {
  const { text, stats } = compact(BUILD_LOG);
  assert.ok(text.includes("TS2339"), "must keep first error");
  assert.ok(text.includes("TS2554"), "must keep second error");
  const assetLines = (text.match(/asset chunk-/g) ?? []).length;
  assert.ok(assetLines <= 3, `asset spam should be capped, got ${assetLines}`);
  assert.ok(stats.saved > 0.85, `expected >85% savings, got ${Math.round(stats.saved * 100)}%`);
});

test("budget mode trims to target while keeping error context", () => {
  const { text, stats } = compact(BUILD_LOG, { budget: 500 });
  assert.ok(stats.tokensOut <= 600, `should be near budget, got ${stats.tokensOut}`);
  assert.ok(text.includes("TS2339"), "errors survive budget trimming");
  assert.ok(text.includes("trimmed to fit token budget"), "trim marker present");
});

test("clean short output passes through nearly untouched", () => {
  const input = "All 14 tests passed.\nDone in 2.1s.";
  const { text } = compact(input);
  assert.equal(text, input);
});
