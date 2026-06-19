# Contributing to logslim

logslim does one job: turn noisy command output into a short, honest summary an AI
agent or a CI reviewer can actually use. It gets better in two ways — **knowing more
error codes** and **handling more log formats** — and both make great first contributions.

No CLA, no ceremony. Be kind, keep PRs small, run the tests.

## Ways to contribute

| Contribution | Effort | Where |
| --- | --- | --- |
| Add an error fix card (TS / Node / npm) | ~5 min, pure JSON | `errors/*.json` |
| Share a log that compacts badly | ~10 min | open a [log issue](https://github.com/P156HAM/logslim/issues/new?template=log-sample.yml) |
| Support a new error family (ESLint, Rust, Python…) | small code change | `errors/` + `src/codes.ts` |
| Improve compaction for a runner (Playwright, pytest…) | medium | `src/extract.ts`, `src/dedupe.ts`, `src/stack.ts` |

Browse **[good first issues](https://github.com/P156HAM/logslim/labels/good%20first%20issue)**
to claim something — comment on the issue first so two people don't grab the same one.

## Quick start

```bash
git clone https://github.com/P156HAM/logslim.git
cd logslim
npm install
npm test        # node --test via tsx, no build needed
npm run demo    # see the before/after in your terminal
```

Node 18+.

## Add an error card in 5 minutes

When a known code shows up in a log, logslim attaches a ~30-token "fix card" instead of
making the agent guess or go search docs. Cards live in `errors/<family>.json` as plain data:

```json
"TS2741": {
  "meaning": "Property missing in type but required in the target",
  "fix_steps": [
    "Add the missing property",
    "Make it optional in the target type if it genuinely is",
    "Check you're constructing the right type"
  ]
}
```

**Adding a code to an existing family — TypeScript, Node, or npm — is pure JSON, no code change:**

1. Open `errors/typescript.json` (or `node.json` / `npm.json`).
2. Add your entry: a one-line `meaning` and 2–3 `fix_steps`, **most likely fix first**.
3. `npm test` — the catalog validator in `test/codes.test.ts` checks the shape for you.
4. Open a PR titled `[card] TS2741 — property missing in type`.

That's it. logslim already scans every log for `TS####`, `npm ERR! code …`, and any code
listed in `node.json` / `npm.json`, so your card lights up automatically.

Keep cards **honest and short**: a meaning a tired developer understands at 2am, and fix
steps ordered by likelihood. These are hand-curated pocket references, not scraped docs.

## Add a new error family

Want ESLint rules, Rust `E####`, or Python/mypy codes? That's a small wiring change in
`src/codes.ts`:

1. Create `errors/<family>.json` with the same `{ "CODE": { meaning, fix_steps } }` shape.
2. In `src/codes.ts`:
   - add the family to the `ErrorCodeCard["lang"]` union (~line 13);
   - teach `findCodeIds()` to spot the code in text — a regex like `error\[(E\d{4})\]` for
     rustc, or a known-list scan like Node uses (~line 49);
   - add a branch in `lookupRaw()` that loads your catalog for matching ids (~line 75).
3. Add a round-trip assertion to `test/codes.test.ts` (copy an existing one).
4. `npm test`, then open the PR.

There are open issues for **ESLint**, **Rust**, and **Python** if you'd like a scoped start.

## Share a log that compacts badly

The best test data is real output. If logslim over-trims, mangles, or ignores something:

1. Open a **[log issue](https://github.com/P156HAM/logslim/issues/new?template=log-sample.yml)**
   and paste the raw output (trim secrets and real hostnames).
2. Tell us what a good summary would **keep** and what it should **drop**.

Real samples become fixtures in `test/fixtures.ts` and lock the behavior in so it never regresses.

## Improve compaction for a runner

Format-specific handling lives in a few small modules:

- `src/extract.ts` — pull structured `{ file, line, message }` errors out of a format.
- `src/dedupe.ts` — collapse repeated / templated lines (warn spam, duplicate failures).
- `src/stack.ts` — fold vendor / `node_modules` stack frames.

Workflow: add a realistic fixture to `test/fixtures.ts`, write a test in `test/compact.test.ts`
asserting the failure survives and the noise is capped (see the jest / pytest / webpack tests
for the pattern), then make it pass.

**The one rule — compaction is lossy but never silent.** Every removed section is marked in
place (`(+47 similar lines omitted by logslim)`) so the agent knows data was elided and can
re-run the raw command if it needs the full output. Don't drop lines without a marker.

## PR checklist

- [ ] `npm test` passes
- [ ] One error family / one log format per PR (faster to review, faster to merge)
- [ ] New behavior has a fixture + an assertion
- [ ] No secrets or real hostnames in fixtures

Thanks for making logslim sharper for everyone's agents.
