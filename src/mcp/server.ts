#!/usr/bin/env node
/**
 * logslim MCP server — Claude Code / Cursor can call compact_output as a tool.
 *
 * Claude Code (.mcp.json in project or ~/.claude.json):
 *   { "mcpServers": { "logslim": { "command": "npx", "args": ["-y", "logslim", "mcp"] } } }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { process as processLog } from "../index.js";

const server = new McpServer({
  name: "logslim",
  version: "0.3.0",
});

server.tool(
  "compact_output",
  "Compact noisy command output before reading it. Strips ANSI, dedupes spam, collapses stack traces, extracts errors, and attaches short fix cards for known error codes (TS####, ECONNREFUSED, npm ERESOLVE). Use when test/build/lint output is long.",
  {
    output: z.string().describe("Raw stdout+stderr from a command"),
    exit_code: z.number().optional().describe("Command exit code if known (0 = success)"),
    mode: z
      .enum(["failure", "full", "light"])
      .optional()
      .describe("failure = compact hard only on failure (default)"),
    budget: z.number().optional().describe("Max output tokens after compaction"),
  },
  async ({ output, exit_code, mode, budget }) => {
    const result = processLog(output, {
      mode: mode ?? "failure",
      exitCode: exit_code,
      budget: budget ?? 0,
      lookupCodes: true,
    });

    const summary = [
      `Compacted ${result.stats.linesIn} → ${result.stats.linesOut} lines (~${Math.round(result.stats.saved * 100)}% token savings, ${result.stats.applied} mode).`,
      result.codes.length > 0
        ? `Known codes: ${result.codes.map((c) => `${c.id} — ${c.meaning}`).join("; ")}`
        : "",
      result.errors.length > 0 ? `Extracted ${result.errors.length} error(s).` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              summary,
              failed: result.failed,
              compacted: result.text,
              errors: result.errors,
              codes: result.codes,
              stats: result.stats,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
