# logslim-mcp

MCP server for **[logslim](https://github.com/P156HAM/logslim)** — compact noisy
test/build/cloud-log output before an AI agent reads it (~80–95% fewer tokens on
failures). This package lets MCP clients launch the server with a single command.

## Use it

Add to your `.mcp.json` (Claude Code) or client config:

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

This package is a thin launcher; the engine lives in the
[`logslim`](https://www.npmjs.com/package/logslim) package. See the
[main repository](https://github.com/P156HAM/logslim) for the CLI, GitHub Action,
and full docs.

MIT.
