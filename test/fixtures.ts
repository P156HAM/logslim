/** Realistic log fixtures used by the tests (synthesized but representative). */

/** Jest run: progress noise, repeated console.warn spam, one real failure. */
export const JEST_LOG = [
  "\x1B[2K\x1B[1G\x1B[1mDetermining test suites to run...\x1B[22m",
  ...Array.from({ length: 60 }, (_, i) => `\rPROGRESS ${i + 1}/60`).join("").split("\n"),
  "PASS src/utils/format.test.ts",
  ...Array.from(
    { length: 120 },
    (_, i) =>
      `  console.warn deprecated prop 'size' used in <Button id=${1000 + i}> at 2026-06-12T0${i % 10}:1${i % 6}:22.10${i % 10}Z`
  ),
  "PASS src/components/Button.test.tsx",
  "FAIL src/checkout/cart.test.ts",
  "  ● Cart › applies discount codes",
  "",
  "    expect(received).toBe(expected) // Object.is equality",
  "",
  "    Expected: 89.10",
  "    Received: 99.00",
  "",
  "      at Object.<anonymous> (src/checkout/cart.test.ts:48:27)",
  "      at Promise.then.completed (node_modules/jest-circus/build/utils.js:298:28)",
  "      at new Promise (<anonymous>)",
  "      at callAsyncCircusFn (node_modules/jest-circus/build/utils.js:231:10)",
  "      at _callCircusTest (node_modules/jest-circus/build/run.js:316:40)",
  "      at _runTest (node_modules/jest-circus/build/run.js:252:3)",
  "      at _runTestsForDescribeBlock (node_modules/jest-circus/build/run.js:126:9)",
  "      at _runTestsForDescribeBlock (node_modules/jest-circus/build/run.js:121:9)",
  "      at run (node_modules/jest-circus/build/run.js:71:3)",
  "      at runAndTransformResultsToJestFormat (node_modules/jest-circus/build/legacy-code-todo-rewrite/jestAdapterInit.js:122:21)",
  "      at jestAdapter (node_modules/jest-circus/build/legacy-code-todo-rewrite/jestAdapter.js:79:19)",
  "      at runTestInternal (node_modules/jest-runner/build/runTest.js:367:16)",
  "      at runTest (node_modules/jest-runner/build/runTest.js:444:34)",
  "",
  "Test Suites: 1 failed, 2 passed, 3 total",
  "Tests:       1 failed, 41 passed, 42 total",
  "Time:        14.382 s",
].join("\n");

/** Pytest: parametrized test failing 25 times with the same root cause. */
export const PYTEST_LOG = [
  "============================= test session starts ==============================",
  "platform darwin -- Python 3.12.4, pytest-8.3.2",
  "collected 250 items",
  "",
  ...Array.from({ length: 25 }, (_, i) =>
    [
      `________________________ test_parse_amount[case${i}] _________________________`,
      "",
      `    def test_parse_amount(case${i}):`,
      ">       assert parse_amount(raw) == expected",
      "E       AssertionError: assert None == Decimal('42.50')",
      "",
      `tests/test_parser.py:${88 + i}: AssertionError`,
      `  File "/Users/dev/proj/.venv/lib/python3.12/site-packages/_pytest/python.py", line 194, in pytest_pyfunc_call`,
      "    result = testfunction(**testargs)",
      `  File "/Users/dev/proj/tests/test_parser.py", line ${88 + i}, in test_parse_amount`,
      "    assert parse_amount(raw) == expected",
      `  File "/Users/dev/proj/src/parser.py", line 31, in parse_amount`,
      "    return _normalize(value)",
    ].join("\n")
  ),
  "=========================== short test summary info ============================",
  ...Array.from({ length: 25 }, (_, i) => `FAILED tests/test_parser.py::test_parse_amount[case${i}]`),
  "========================= 25 failed, 225 passed in 12.40s =========================",
].join("\n");

/** Webpack-style build: huge repetitive module list, two real errors. */
export const BUILD_LOG = [
  "webpack 5.99.1 compiled with 2 errors and 143 warnings in 18432 ms",
  ...Array.from(
    { length: 400 },
    (_, i) => `asset chunk-${i.toString(16).padStart(8, "0")}.js 14${i % 10}.2 KiB [emitted] [minimized]`
  ),
  ...Array.from(
    { length: 143 },
    (_, i) => `WARNING in ./src/legacy/module${i}.js 12:4-18 Critical dependency: require function is used`
  ),
  "ERROR in ./src/api/client.ts 88:12",
  "TS2339: Property 'retry' does not exist on type 'RequestConfig'.",
  "ERROR in ./src/api/client.ts 102:3",
  "TS2554: Expected 2 arguments, but got 3.",
].join("\n");

/** Playwright list reporter: one failing test, retried once (whole block repeats). */
const PW_RULE = "─".repeat(98);
const PW_FAILURE_BLOCK = (suffix: string) => [
  "",
  "    Error: expect(locator).toBeEnabled() failed",
  "",
  "    Locator:  locator('#pay')",
  "    Expected: enabled",
  "    Received: disabled",
  "    Timeout:  5000ms",
  "",
  "    Call log:",
  '      - Expect "toBeEnabled" with timeout 5000ms',
  "      - waiting for locator('#pay')",
  '        14 × locator resolved to <button id="pay" disabled>Pay</button>',
  '           - unexpected value "disabled"',
  "",
  "",
  "      24 |   await expect(page.locator('body')).toHaveAttribute('data-selected-plan', 'startup');",
  "      25 |",
  "    > 26 |   await expect(page.locator('#pay')).toBeEnabled();",
  "         |                                      ^",
  "      27 | });",
  "      28 |",
  "        at /Users/dev/demo/tests/checkout.spec.ts:26:38",
  "",
  `    attachment #1: screenshot (image/png) ${"─".repeat(50)}`,
  `    test-results/checkout-guest-can-pay${suffix}/test-failed-1.png`,
  `    ${PW_RULE}`,
  "",
  `    Error Context: test-results/checkout-guest-can-pay${suffix}/error-context.md`,
  "",
  `    attachment #3: trace (application/zip) ${"─".repeat(49)}`,
  `    test-results/checkout-guest-can-pay${suffix}/trace.zip`,
  "    Usage:",
  "",
  `        npx playwright show-trace test-results/checkout-guest-can-pay${suffix}/trace.zip`,
  "",
  `    ${PW_RULE}`,
];

export const PLAYWRIGHT_LOG = [
  "",
  "Running 1 test using 1 worker",
  "",
  "  ✘  1 tests/checkout.spec.ts:3:5 › guest can pay with startup plan (8.3s)",
  "  ✘  2 tests/checkout.spec.ts:3:5 › guest can pay with startup plan (retry #1) (5.6s)",
  "",
  "",
  `  1) tests/checkout.spec.ts:3:5 › guest can pay with startup plan ${"─".repeat(34)}`,
  ...PW_FAILURE_BLOCK(""),
  "",
  `    Retry #1 ${"─".repeat(89)}`,
  ...PW_FAILURE_BLOCK("-retry1"),
  "",
  "  1 failed",
  `    tests/checkout.spec.ts:3:5 › guest can pay with startup plan ${"─".repeat(47)}`,
].join("\n");
