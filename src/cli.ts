#!/usr/bin/env node
/**
 * logslim CLI
 *
 *   npm test 2>&1 | logslim
 *   logslim -- npm test
 *   logslim --mode failure --json -- npm test
 */

import { spawn } from "node:child_process";
import { process as processLog, type CompactMode, type ProcessResult } from "./index.js";
import type { AttachSource } from "./attach.js";

const HELP = `logslim — compact noisy command output before an AI agent reads it

Usage:
  <command> 2>&1 | logslim [options]
  logslim [options] -- <command> [args...]

Options:
  --mode <failure|full|light>
                      failure = compact hard only when command fails (default)
                      full    = always compact hard
                      light   = strip ANSI only, never aggressive dedupe
  --json              Output structured JSON (for agents / CI)
  --budget <tokens>   Hard token budget on failure compaction (default: off)
  --max-dup <n>       Verbatim occurrences per repeated pattern (default: 3)
  --context <n>       Context lines around errors when budget-trimming (default: 2)
  --attach <git,ci>   Prepend branch/commit/CI info (comma-separated)
  --exit-code <n>     Exit code for pipe mode (e.g. cmd; logslim --exit-code $?)
  --no-codes          Skip error code lookup cards
  --no-stats          Don't print savings footer (stderr; ignored with --json)
  -h, --help
  -v, --version

Examples:
  npm test 2>&1 | logslim
  npm test; logslim --exit-code $? < test.log   # or: npm test 2>&1 | logslim --exit-code 1
  logslim --mode failure --json --attach git,ci -- npm test
  logslim --budget 2000 -- npx vitest run`;

interface CliArgs {
  mode: CompactMode;
  json: boolean;
  budget?: number;
  maxPerTemplate?: number;
  contextLines?: number;
  attach: AttachSource[];
  exitCode?: number;
  lookupCodes: boolean;
  stats: boolean;
  command: string[] | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    mode: "failure",
    json: false,
    attach: [],
    lookupCodes: true,
    stats: true,
    command: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      args.command = argv.slice(i + 1);
      break;
    }
    switch (arg) {
      case "--mode":
        args.mode = argv[++i] as CompactMode;
        if (!["failure", "full", "light"].includes(args.mode)) {
          console.error(`logslim: invalid mode "${args.mode}"`);
          process.exit(2);
        }
        break;
      case "--json":
        args.json = true;
        break;
      case "--budget":
        args.budget = parseInt(argv[++i], 10) || 0;
        break;
      case "--max-dup":
        args.maxPerTemplate = parseInt(argv[++i], 10) || 3;
        break;
      case "--context":
        args.contextLines = parseInt(argv[++i], 10) || 2;
        break;
      case "--attach": {
        const raw = argv[++i] ?? "";
        for (const s of raw.split(",")) {
          if (s === "git" || s === "ci") args.attach.push(s);
        }
        break;
      }
      case "--exit-code":
        args.exitCode = parseInt(argv[++i], 10);
        break;
      case "--no-codes":
        args.lookupCodes = false;
        break;
      case "--no-stats":
        args.stats = false;
        break;
      case "-h":
      case "--help":
        console.log(HELP);
        process.exit(0);
        break;
      case "-v":
      case "--version":
        console.log("logslim 0.3.0");
        process.exit(0);
        break;
      default:
        console.error(`logslim: unknown option "${arg}" (see --help)`);
        process.exit(2);
    }
  }
  return args;
}

function toJson(result: ProcessResult): string {
  return JSON.stringify(
    {
      exitCode: result.exitCode ?? (result.failed ? 1 : 0),
      failed: result.failed,
      compacted: result.text,
      errors: result.errors,
      codes: result.codes,
      context: result.context,
      stats: result.stats,
    },
    null,
    2
  );
}

function emit(raw: string, args: CliArgs, exitCode?: number): void {
  const result = processLog(raw, {
    mode: args.mode,
    exitCode: exitCode ?? args.exitCode,
    budget: args.budget,
    maxPerTemplate: args.maxPerTemplate,
    contextLines: args.contextLines,
    attach: args.attach,
    lookupCodes: args.lookupCodes,
  });

  if (args.json) {
    process.stdout.write(toJson(result) + "\n");
  } else {
    process.stdout.write(result.text + "\n");
    if (args.stats) {
      const pct = Math.round(result.stats.saved * 100);
      const mode = result.stats.applied;
      process.stderr.write(
        `\n[logslim] mode=${mode} · ${result.stats.linesIn} → ${result.stats.linesOut} lines · ~${result.stats.tokensIn.toLocaleString()} → ~${result.stats.tokensOut.toLocaleString()} tokens (${pct}% saved)`
      );
      if (result.codes.length > 0) {
        process.stderr.write(` · codes: ${result.codes.map((c) => c.id).join(", ")}`);
      }
      process.stderr.write("\n");
    }
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const args = parseArgs(process.argv.slice(2));

if (args.command && args.command.length > 0) {
  const [cmd, ...cmdArgs] = args.command;
  const child = spawn(cmd, cmdArgs, { shell: false, env: process.env });
  const chunks: Buffer[] = [];
  child.stdout.on("data", (c: Buffer) => chunks.push(c));
  child.stderr.on("data", (c: Buffer) => chunks.push(c));
  child.on("error", (err) => {
    console.error(`logslim: failed to run "${cmd}": ${err.message}`);
    process.exit(127);
  });
  child.on("close", (code) => {
    emit(Buffer.concat(chunks).toString("utf8"), args, code ?? 0);
    process.exit(code ?? 0);
  });
} else if (!process.stdin.isTTY) {
  emit(await readStdin(), args);
} else {
  console.log(HELP);
  process.exit(2);
}
