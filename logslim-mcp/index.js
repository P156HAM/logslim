#!/usr/bin/env node
/**
 * Thin launcher so `npx -y logslim-mcp` just works.
 *
 * The MCP server itself ships inside the `logslim` package (bin `logslim-mcp` →
 * dist/mcp/server.js). This package exists only so the command name matches a
 * real npm package — it resolves the server from the installed `logslim`
 * dependency and runs it, forwarding stdio (JSON-RPC) and termination signals.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const serverPath = require.resolve("logslim/dist/mcp/server.js");

const child = spawn(process.execPath, [serverPath, ...process.argv.slice(2)], {
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
