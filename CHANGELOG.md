# Changelog

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
