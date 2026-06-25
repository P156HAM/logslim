# Changelog

## 0.4.0

- **Playwright support**: collapses repeated retry blocks, folds screenshot/trace attachments, strips decorative rules, and extracts structured failures (`file:line`, assertion, expected/received). ~64% fewer tokens on real failure output. Thanks @TerFree70 for the sample.
- **Structured / cloud logs**: detects JSON-per-line output (CloudWatch, GCP Cloud Logging, Datadog, k8s/Docker) and compacts it for agents — pipe `aws logs tail` / `gcloud logging read` / `kubectl logs` through `logslim --mode full` (~99% fewer tokens on noisy log streams).
- **Contributor on-ramp**: `CONTRIBUTING.md`, issue templates, and an `errors/*.json` catalog validator.

## 0.3.0

- **GitHub Action** (`./action`): post structured failure summaries on PRs when CI tests/builds fail
- **`formatPrComment()`** API for turning `process()` JSON into markdown PR comments
- Dual use: **CI failure digest for humans** + **log compaction / JSON / MCP for agents** (unchanged)

## 0.2.0

- **Failure mode** (default): compact hard only when command fails
- **`--json`**: structured output with `errors[]`, `codes[]`, `stats`
- **Error code fix cards**: TypeScript, Node, npm (`errors/*.json`)
- **MCP server**: `logslim-mcp` with `compact_output` tool
- **`--attach git,ci`**: prepend branch/commit/PR from CI env vars
- **`process()` API**: full pipeline (compact + extract + lookup)

## 0.1.0

- Initial CLI: ANSI strip, dedupe, stack collapse, template dedupe, token budget
- Library `compact()` API
