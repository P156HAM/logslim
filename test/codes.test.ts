import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { codesFromText } from "../src/codes.js";

const errorsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "errors");
const catalogFiles = readdirSync(errorsDir).filter((f) => f.endsWith(".json"));

interface RawEntry {
  meaning?: unknown;
  fix_steps?: unknown;
}

function parseCatalog(file: string, raw: string): Record<string, RawEntry> {
  try {
    return JSON.parse(raw) as Record<string, RawEntry>;
  } catch (e) {
    throw new Error(`errors/${file} is not valid JSON: ${(e as Error).message}`);
  }
}

test("every errors/*.json catalog is well-formed", () => {
  assert.ok(catalogFiles.length > 0, "expected at least one error catalog");

  for (const file of catalogFiles) {
    const catalog = parseCatalog(file, readFileSync(join(errorsDir, file), "utf8"));
    assert.equal(typeof catalog, "object", `errors/${file} must be a JSON object`);

    for (const [id, entry] of Object.entries(catalog)) {
      const where = `errors/${file} → ${id}`;
      assert.ok(id.trim().length > 0, `${where}: code id must not be empty`);
      assert.equal(typeof entry.meaning, "string", `${where}: "meaning" must be a string`);
      assert.ok((entry.meaning as string).trim().length > 0, `${where}: "meaning" must not be empty`);
      assert.ok(Array.isArray(entry.fix_steps), `${where}: "fix_steps" must be an array`);
      assert.ok((entry.fix_steps as unknown[]).length > 0, `${where}: need at least one fix step`);

      for (const step of entry.fix_steps as unknown[]) {
        assert.equal(typeof step, "string", `${where}: each fix step must be a string`);
        assert.ok((step as string).trim().length > 0, `${where}: fix steps must not be empty`);
      }

      const extra = Object.keys(entry).filter((k) => k !== "meaning" && k !== "fix_steps");
      assert.equal(extra.length, 0, `${where}: unexpected key(s): ${extra.join(", ")}`);
    }
  }
});

test("known codes round-trip from log text back to a card", () => {
  const ts = codesFromText("src/cart.ts(48,27): error TS2339: Property 'total' does not exist");
  assert.ok(
    ts.some((c) => c.id === "TS2339" && c.lang === "typescript"),
    "TS2339 should resolve to a typescript card"
  );

  const node = codesFromText("Error: connect ECONNREFUSED 127.0.0.1:5432");
  assert.ok(
    node.some((c) => c.id === "ECONNREFUSED" && c.lang === "node"),
    "ECONNREFUSED should resolve to a node card"
  );

  const npm = codesFromText("npm ERR! code ERESOLVE\nnpm ERR! ERESOLVE unable to resolve dependency tree");
  assert.ok(
    npm.some((c) => c.id === "ERESOLVE" && c.lang === "npm"),
    "ERESOLVE should resolve to an npm card"
  );
});

test("unknown codes are omitted, not invented", () => {
  const cards = codesFromText("error TS9999: not a real code\nsomething ENOTREAL happened");
  assert.equal(cards.length, 0, "logslim must not return cards for codes it doesn't have");
});
