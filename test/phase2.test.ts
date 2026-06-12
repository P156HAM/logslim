import { strict as assert } from "node:assert";
import { test } from "node:test";
import { compact, process } from "../src/index.js";
import { codesFromText, findCodeIds } from "../src/codes.js";
import { BUILD_LOG, JEST_LOG } from "./fixtures.js";

test("failure mode: success output uses light compaction", () => {
  const input = "All 42 tests passed.\nDone in 1.2s.";
  const { stats } = compact(input, { mode: "failure", exitCode: 0 });
  assert.equal(stats.applied, "light");
  assert.ok(stats.saved < 0.1);
});

test("failure mode: failed exit uses full compaction", () => {
  const { stats } = compact(JEST_LOG, { mode: "failure", exitCode: 1 });
  assert.equal(stats.applied, "full");
  assert.ok(stats.saved > 0.7);
});

test("findCodeIds detects TypeScript and npm codes", () => {
  const ids = findCodeIds("ERROR TS2339: foo\nnpm ERR! code ERESOLVE");
  assert.ok(ids.includes("TS2339"));
  assert.ok(ids.includes("ERESOLVE"));
});

test("codesFromText returns fix cards", () => {
  const cards = codesFromText("Property 'retry' - TS2339");
  const ts = cards.find((c) => c.id === "TS2339");
  assert.ok(ts);
  assert.ok(ts!.fix_steps.length >= 2);
});

test("process() extracts errors and codes from build log", () => {
  const result = process(BUILD_LOG, { mode: "full", exitCode: 1 });
  assert.ok(result.failed);
  assert.ok(result.codes.some((c) => c.id === "TS2339"));
  assert.ok(result.codes.some((c) => c.id === "TS2554"));
  assert.ok(result.errors.length >= 1);
});

test("process() skips extraction on success", () => {
  const result = process("OK\n", { exitCode: 0 });
  assert.equal(result.failed, false);
  assert.equal(result.errors.length, 0);
});
