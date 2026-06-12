# Changelog

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
