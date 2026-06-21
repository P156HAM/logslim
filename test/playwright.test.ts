import { strict as assert } from "node:assert";
import { test } from "node:test";
import { compact, process } from "../src/index.js";
import { PLAYWRIGHT_LOG } from "./fixtures.js";

test("playwright: collapses retry + attachments, keeps the failure", () => {
  const { text, stats } = compact(PLAYWRIGHT_LOG, { exitCode: 1 });

  assert.ok(/checkout\.spec\.ts:3:5 › guest can pay/.test(text), "keeps the failing test identity");
  assert.ok(text.includes("toBeEnabled() failed"), "keeps the assertion");
  assert.ok(text.includes("Expected: enabled"), "keeps expected value");
  assert.ok(text.includes("Received: disabled"), "keeps received value");
  assert.ok(/checkout\.spec\.ts:26/.test(text), "keeps the failing source location");
  assert.ok(/Retry #1 reproduced the same failure/.test(text), "collapses the duplicate retry block");
  assert.ok(/attachments:/.test(text), "folds attachment blocks");
  assert.ok(!text.includes("show-trace"), "drops the trace usage line");
  assert.equal((text.match(/─{6,}/g) ?? []).length, 0, "strips decorative rule lines");
  assert.ok(stats.saved > 0.35, `expected >35% savings, got ${Math.round(stats.saved * 100)}%`);
});

test("playwright: extracts a structured test failure", () => {
  const result = process(PLAYWRIGHT_LOG, { exitCode: 1 });

  assert.equal(result.failed, true);
  const fail = result.errors.find((e) => e.kind === "test_failure");
  assert.ok(fail, "should extract a test_failure");
  assert.ok(fail!.file?.includes("checkout.spec.ts"), "captures the spec file");
  assert.equal(fail!.line, 26, "uses the failing source line, not the test declaration");
  assert.ok(fail!.message.includes("toBeEnabled"), "message includes the assertion");
  assert.ok(/guest can pay/.test(fail!.message), "message includes the test name");
});
