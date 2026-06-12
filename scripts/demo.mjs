#!/usr/bin/env node
/**
 * Runnable demo — prints a clear before/after for README, tweets, and Product Hunt.
 * Usage: npm run demo
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { process } from "../dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Inline mini fixture if dist missing — but demo expects npm run build first
const SAMPLE = `PASS src/utils.test.ts
${Array.from({ length: 8 }, (_, i) => `  console.warn deprecated prop id=${1000 + i}`).join("\n")}
FAIL src/checkout/cart.test.ts
  ● Cart › applies discount

    Expected: 89.10
    Received: 99.00

      at Object.<anonymous> (src/checkout/cart.test.ts:48:27)
      at Promise.then.completed (node_modules/jest-circus/build/utils.js:298:28)
      at callAsyncCircusFn (node_modules/jest-circus/build/utils.js:231:10)
      at _runTest (node_modules/jest-circus/build/run.js:252:3)
      at run (node_modules/jest-circus/build/run.js:71:3)

Test Suites: 1 failed, 1 passed, 2 total
Tests:       1 failed, 12 passed, 13 total`;

const result = process(SAMPLE, { mode: "failure", exitCode: 1 });

const bar = "═".repeat(72);

console.log(`
${bar}
  logslim demo — what your AI agent sees BEFORE vs AFTER
${bar}

BEFORE (${result.stats.linesIn} lines, ~${result.stats.tokensIn} tokens)
────────────────────────────────────────────────────────────────────────
`);
console.log(SAMPLE);
console.log(`
────────────────────────────────────────────────────────────────────────
AFTER (${result.stats.linesOut} lines, ~${result.stats.tokensOut} tokens — ${Math.round(result.stats.saved * 100)}% saved)
────────────────────────────────────────────────────────────────────────
`);
console.log(result.text);

if (result.errors.length) {
  console.log(`
EXTRACTED ERRORS (structured — agents don't re-parse prose)
────────────────────────────────────────────────────────────────────────`);
  for (const e of result.errors) {
    console.log(`  • ${e.file ?? "?"}:${e.line ?? "?"} — ${e.message.slice(0, 80)}`);
  }
}

console.log(`
${bar}
  Try it:  npx logslim -- npm test
           logslim --json -- npm test
${bar}
`);
