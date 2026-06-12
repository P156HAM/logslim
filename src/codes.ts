/**
 * Error code lookup — pocket reference cards for codes that already appear
 * in logs (TS####, ECONNREFUSED, npm ERESOLVE, etc.). Not scraped docs;
 * hand-curated JSON the agent can read in ~30 tokens per code.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface ErrorCodeCard {
  id: string;
  lang: "typescript" | "node" | "npm" | "eslint" | "unknown";
  meaning: string;
  fix_steps: string[];
}

interface CatalogEntry {
  meaning: string;
  fix_steps: string[];
}

type Catalog = Record<string, CatalogEntry>;

const CATALOGS: Record<string, Catalog> = {};
const CATALOG_LANG: Record<string, ErrorCodeCard["lang"]> = {
  typescript: "typescript",
  node: "node",
  npm: "npm",
};

function loadCatalog(name: string): Catalog {
  if (CATALOGS[name]) return CATALOGS[name];
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "errors");
  const raw = readFileSync(join(dir, `${name}.json`), "utf8");
  CATALOGS[name] = JSON.parse(raw) as Catalog;
  return CATALOGS[name];
}

function knownNodeCodes(): string[] {
  return Object.keys(loadCatalog("node"));
}

function knownNpmCodes(): string[] {
  return Object.keys(loadCatalog("npm"));
}

/** Find known error codes in text (deduped, order preserved). */
export function findCodeIds(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const add = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      found.push(id);
    }
  };

  for (const m of text.matchAll(/\bTS\d{4,5}\b/g)) add(m[0]);

  for (const m of text.matchAll(/\bnpm ERR! code (\w+)\b/gi)) add(m[1].toUpperCase());

  for (const code of knownNodeCodes()) {
    if (text.includes(code)) add(code);
  }

  for (const code of knownNpmCodes()) {
    const re = new RegExp(`\\b${code}\\b`);
    if (re.test(text)) add(code);
  }

  return found;
}

function lookupRaw(id: string): ErrorCodeCard | null {
  if (id.startsWith("TS")) {
    const cat = loadCatalog("typescript");
    if (cat[id]) return { id, lang: "typescript", ...cat[id] };
  }
  const node = loadCatalog("node");
  if (node[id]) return { id, lang: "node", ...node[id] };
  const npm = loadCatalog("npm");
  if (npm[id]) return { id, lang: "npm", ...npm[id] };
  return null;
}

/** Resolve code IDs to cards (unknown codes omitted). */
export function lookupCodes(ids: string[]): ErrorCodeCard[] {
  const out: ErrorCodeCard[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const card = lookupRaw(id);
    if (card && !seen.has(card.id)) {
      seen.add(card.id);
      out.push(card);
    }
  }
  return out;
}

/** Find + lookup in one call. */
export function codesFromText(text: string): ErrorCodeCard[] {
  return lookupCodes(findCodeIds(text));
}
