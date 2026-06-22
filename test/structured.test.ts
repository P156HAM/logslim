import { strict as assert } from "node:assert";
import { test } from "node:test";
import { compact } from "../src/index.js";
import { isStructuredLog } from "../src/structured.js";
import { STRUCTURED_LOG } from "./fixtures.js";

test("structured (JSON) logs: collapse repeats, keep errors, big savings", () => {
  const { text, stats } = compact(STRUCTURED_LOG, { mode: "full" });

  assert.ok(text.includes("ECONNREFUSED"), "keeps the database error");
  assert.ok(/out of memory/.test(text), "keeps the fatal entry");
  assert.ok(/db pool at 80%/.test(text), "keeps the warning");
  const health = (text.match(/GET \/health/g) ?? []).length;
  assert.ok(health <= 4, `repeated health-check lines should collapse, got ${health}`);
  assert.ok(/similar lines omitted/.test(text), "marks the omission");
  assert.ok(!text.includes('"requestId"'), "renders away the raw JSON wrapper");
  assert.ok(stats.saved > 0.7, `expected >70% savings, got ${Math.round(stats.saved * 100)}%`);
});

test("structured detector: JSON-lines yes, plain test output no", () => {
  assert.equal(isStructuredLog(STRUCTURED_LOG), true);
  assert.equal(
    isStructuredLog("FAIL src/x.test.ts\n  Expected: 1\n  Received: 2\n  Error: boom\n  at x.ts:3:1"),
    false
  );
});
