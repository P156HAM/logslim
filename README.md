# logslim

**CI failed? Get a 5-line PR summary — not a 400-line Actions log.**  
**Agent reading test output? Cut 80–95% of the tokens.**

[![npm](https://img.shields.io/npm/v/logslim)](https://www.npmjs.com/package/logslim)
[![license](https://img.shields.io/github/license/P156HAM/logslim)](./LICENSE)
[![node](https://img.shields.io/node/v/logslim)](https://www.npmjs.com/package/logslim)

When tests or builds fail, you scroll GitHub Actions logs. When Claude Code or Cursor runs
`npm test`, the agent reads **everything** — progress bars, 120 identical warnings, 40 frames
of `node_modules`. logslim fixes both:

1. **CI / humans** — GitHub Action posts structured failures on your PR (file, line, fix hints)
2. **Agents / tokens** — CLI + MCP compacts noisy output before an LLM reads it (~80–95% savings on failures)

```bash
npx logslim -- npm test
```

No account. No API key. MIT open source.

---

## GitHub Action — PR failure summary

When CI fails, post a readable summary on the pull request instead of making reviewers dig
through Actions logs.

```yaml
permissions:
  contents: read
  pull-requests: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci

      - name: Run tests
        id: test
        run: npm test 2>&1 | tee test-output.log
        continue-on-error: true

      - name: Post failure summary
        if: steps.test.outcome == 'failure' && github.event_name == 'pull_request'
        uses: P156HAM/logslim/action@v0.3.0
        with:
          log-file: test-output.log
          exit-code: 1
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Fail job
        if: steps.test.outcome == 'failure'
        run: exit 1
```

**What gets posted on the PR:**

- Structured failures with `file:line` and messages
- Fix hints for known codes (`TS2339`, `ERESOLVE`, …)
- Link to the full CI log
- Token/log reduction stats (useful when agents also read the output)

The Action uses the same engine as the CLI — compaction, error extraction, and code cards.
You get **human-readable PR comments** and **agent-ready JSON** from one tool.

| Input | Default | Purpose |
| ----- | ------- | ------- |
| `log-file` | _(required)_ | Path to captured test/build log |
| `exit-code` | `1` | Exit code of the failed command |
| `github-token` | _(required)_ | `secrets.GITHUB_TOKEN` with `pull-requests: write` |
| `logslim-version` | `0.3.0` | npm version to run |
| `skip-on-success` | `true` | Don't comment when no failure detected |

---

## See it work (30 seconds)

```bash
git clone https://github.com/P156HAM/logslim.git
cd logslim && npm install && npm run build && npm run demo
```

Or without cloning:

```bash
npx logslim -- node -e "console.log('ok'); for(let i=0;i<30;i++)console.log('warn '+i); throw Error('fail')"
```

---

## Before → After

**BEFORE** — what the agent reads today (~18 lines here; real runs are 500–3000):

```
PASS src/utils.test.ts
  console.warn deprecated prop id=1000
  console.warn deprecated prop id=1001
  console.warn deprecated prop id=1002
  ... (same warning ×120)
FAIL src/checkout/cart.test.ts
  Expected: 89.10
  Received: 99.00
      at cart.test.ts:48:27
      at node_modules/jest-circus/build/utils.js:298:28
      at node_modules/jest-circus/build/utils.js:231:10
      at node_modules/jest-circus/build/run.js:252:3
      ... (15 more node_modules frames)
Test Suites: 1 failed, 1 passed, 2 total
```

**AFTER** — what logslim gives the agent:

```
PASS src/utils.test.ts
  console.warn deprecated prop id=1000
  console.warn deprecated prop id=1001
  console.warn deprecated prop id=1002
  (+5 similar lines omitted by logslim)
FAIL src/checkout/cart.test.ts
  Expected: 89.10
  Received: 99.00
      at cart.test.ts:48:27
      at node_modules/jest-circus/build/utils.js:298:28
      … 3 vendor/internal frames collapsed by logslim
Test Suites: 1 failed, 1 passed, 2 total
```

Same failure. Same fix. ~**92% fewer tokens**.

---

## How it works

```
  npm test  ──►  logslim  ──►  agent / CI / you
                  │
                  ├─ 1. Strip ANSI colors & spinner garbage
                  ├─ 2. Dedupe repeated lines (warn spam)
                  ├─ 3. Collapse node_modules stack frames
                  ├─ 4. Group similar lines (timestamps/ids masked)
                  ├─ 5. Extract structured errors (file, line, message)
                  ├─ 6. Attach fix cards for known codes (TS2339, ERESOLVE…)
                  └─ 7. Optional token budget (trim middle, keep errors)
```

**Failure mode (default):** tests pass → light cleanup only. Tests fail → full pipeline.
You only pay the compaction cost when something actually broke.

Every removed section is **marked in place** (`(+47 similar lines omitted by logslim)`)
so the agent knows data was elided and can re-run the raw command if needed.

---

## Install

```bash
npm install -g logslim
# or zero-install:
npx logslim -- npm test
```

Requires Node 18+.

---

## Usage

### Basic — wrap any command

```bash
logslim -- npm test
logslim -- python -m pytest -x
logslim -- npx tsc --noEmit
```

Exit code is preserved. Output on stdout is compacted. Stats on stderr.

### Pipe mode

```bash
npm test 2>&1 | logslim
npm test; logslim --exit-code $? 2>&1 < full.log   # if you saved output
```

### JSON — for agents and CI

```bash
logslim --json -- npm test
```

```json
{
  "exitCode": 1,
  "failed": true,
  "compacted": "FAIL src/checkout/cart.test.ts\n...",
  "errors": [
    {
      "file": "cart.test.ts",
      "line": 48,
      "message": "Expected: 89.10, Received: 99.00",
      "kind": "assertion"
    }
  ],
  "codes": [
    {
      "id": "TS2339",
      "lang": "typescript",
      "meaning": "Property does not exist on type",
      "fix_steps": [
        "Check for typos",
        "Extend the interface",
        "Use optional chaining"
      ]
    }
  ],
  "stats": {
    "tokensIn": 3296,
    "tokensOut": 252,
    "saved": 0.92,
    "applied": "full"
  }
}
```

The agent reads `compacted` + `errors` + `codes` — not thousands of lines of prose.

### CI context (GitHub Actions)

```bash
logslim --json --attach git,ci -- npm test
```

Prepends: `branch: feat/x | commit: a3f2c1d | pr: #42` (from `GITHUB_*` env vars).

### All options

| Flag              | What it does                               |
| ----------------- | ------------------------------------------ |
| `--mode failure`  | Compact hard only on failure **(default)** |
| `--mode full`     | Always compact hard                        |
| `--mode light`    | Strip ANSI only, never aggressive dedupe   |
| `--json`          | Structured output (see above)              |
| `--attach git,ci` | Prepend branch/commit/CI metadata          |
| `--budget 2000`   | Hard token cap; errors + head/tail survive |
| `--exit-code N`   | For pipe mode when you know the exit code  |
| `--no-codes`      | Skip error code fix cards                  |
| `--no-stats`      | Hide stderr savings footer                 |

---

## MCP server (Claude Code / Cursor)

Lets the agent call compaction as a **tool** — no manual piping.

**Project `.mcp.json` or Claude Desktop config:**

```json
{
  "mcpServers": {
    "logslim": {
      "command": "npx",
      "args": ["-y", "logslim-mcp"]
    }
  }
}
```

**Tool:** `compact_output` — pass `output` (raw log text) and optional `exit_code`.
Returns compacted text, extracted errors, fix cards, and stats.

Local dev:

```bash
npm run build && npm run mcp
```

---

## Tell your agent to use it

Add to `CLAUDE.md`, `AGENTS.md`, or `.cursor/rules`:

```markdown
When running tests, builds, or linters that produce verbose output:

- Prefer: `logslim --mode failure --json -- <command>`
- Read the `compacted`, `errors`, and `codes` fields before debugging.
- If output was elided, re-run the raw command only if you need full logs.
```

---

## Error code fix cards

When logs contain known codes, logslim attaches a **short fix card** (~30 tokens)
instead of making the agent guess or search docs.

| Family     | Examples                | Source                   |
| ---------- | ----------------------- | ------------------------ |
| TypeScript | TS2339, TS2554, TS2307  | `errors/typescript.json` |
| Node       | ECONNREFUSED, ENOTFOUND | `errors/node.json`       |
| npm        | ERESOLVE, ELIFECYCLE    | `errors/npm.json`        |

Hand-curated pocket references — not scraped docs. **PRs welcome** to add codes.

---

## Measured savings

| Log type                                  | Lines     | Tokens          | Saved   |
| ----------------------------------------- | --------- | --------------- | ------- |
| Jest (warn spam + 1 failure)              | 149 → 25  | ~3,300 → ~250   | **92%** |
| Webpack build (asset noise + 2 TS errors) | 548 → 55  | ~8,900 → ~1,000 | **88%** |
| Pytest (25 identical failures)            | 356 → 153 | ~4,300 → ~1,500 | **64%** |

Token counts are estimated (~4 chars/token). Good for relative savings, not billing.

---

## Library API

```ts
import { compact, process } from "logslim";

const { text, stats } = compact(rawLog, { mode: "failure", exitCode: 1 });

const result = process(rawLog, {
  mode: "failure",
  exitCode: 1,
  attach: ["git", "ci"],
});
// result.text, result.errors, result.codes, result.stats
```

---

## When to use logslim

| Use it                                                   | Skip it                                        |
| -------------------------------------------------------- | ---------------------------------------------- |
| CI failed and you want a PR summary, not a 400-line log  | Tests passed and output is already short       |
| AI agents running tests/builds locally or in CI          | You already tee full logs to disk for audit    |
| Long repetitive failure output (jest, pytest, webpack)   | Platform already truncates well enough for you |
| MCP workflows where tool output hits context limits      | You need full logs for compliance archive      |

Keep full logs if you need them:

```bash
npm test 2>&1 | tee full.log | logslim
```

---

## Development

```bash
npm install
npm test
npm run build
npm run demo
```

## License

MIT — use freely, no account required.
