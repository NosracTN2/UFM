// Parser for the change-log tag. One op per line:
//   form name="Shale" pillar=elemental element=earth form=automated
//   order Shale guard "the cave mouth"
// A bad line is skipped without throwing away the rest.

import type { Op } from "../shared/types";

const BLOCK_RE = /<ufm\b[^>]*>([\s\S]*?)<\/ufm>/gi;

/** All <ufm> block bodies in a message, in order. */
export function extractBlocks(content: string | null | undefined): string[] {
  if (!content) return [];
  const out: string[] = [];
  for (const m of content.matchAll(BLOCK_RE)) out.push(m[1]);
  return out;
}

export function stripBlocks(content: string): string {
  return content.replace(BLOCK_RE, "").replace(/\n{3,}/g, "\n\n").trimEnd();
}

function normalizeQuotes(s: string): string {
  return s.replace(/[“”„«»]/g, '"').replace(/[‘’]/g, "'");
}

/** Split on whitespace, keeping "quoted strings" and key="quoted values" whole. */
export function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let quote: string | null = null;
  let had = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
      else cur += c;
      continue;
    }
    if (c === '"' || (c === "'" && (cur === "" || cur.endsWith("=")))) {
      quote = c;
      had = true;
      continue;
    }
    if (/\s/.test(c)) {
      if (cur !== "" || had) tokens.push(cur);
      cur = "";
      had = false;
      continue;
    }
    cur += c;
  }
  if (cur !== "" || had) tokens.push(cur);
  return tokens;
}

const KV_RE = /^([a-zA-Z_][a-zA-Z0-9_-]*)=(.*)$/s;

export function parseLine(rawLine: string, lineNo = 0): Op | null {
  let line = normalizeQuotes(rawLine).trim();
  line = line.replace(/^(?:[-*•·>]+|\d+[.)])\s*/, "").replace(/^`+|`+$/g, "").trim();
  if (!line || line.startsWith("#") || line.startsWith("//")) return null;
  const tokens = tokenize(line);
  if (tokens.length === 0) return null;
  const verb = tokens[0].toLowerCase().replace(/[:,]$/, "");
  const args: string[] = [];
  const kv: Record<string, string> = {};
  for (const t of tokens.slice(1)) {
    const m = KV_RE.exec(t);
    if (m) kv[m[1].toLowerCase().replace(/-/g, "_")] = m[2];
    else args.push(t);
  }
  return { verb, args, kv, raw: line, line: lineNo };
}

export function parseBlock(body: string): Op[] {
  const ops: Op[] = [];
  body.split(/\r?\n/).forEach((l, i) => {
    const op = parseLine(l, i);
    if (op) ops.push(op);
  });
  return ops;
}

/** "10d", "6h", "2 days", "3w" -> hours. Returns null for "until healed"/unknown. */
export function parseDuration(s: string | undefined): number | null {
  if (!s) return null;
  const m = /^\+?\s*(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?|w|wk|weeks?|mo|months?|y|years?)?$/i.exec(s.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = (m[2] ?? "h").toLowerCase();
  if (u.startsWith("mi")) return n / 60;
  if (u.startsWith("h")) return n;
  if (u === "mo" || u.startsWith("month")) return n * 24 * 30;
  if (u.startsWith("m")) return n / 60;
  if (u.startsWith("d")) return n * 24;
  if (u.startsWith("w")) return n * 24 * 7;
  if (u.startsWith("y")) return n * 24 * 365;
  return null;
}

export function num(s: string | undefined): number | null {
  if (s == null) return null;
  const m = /^[+-]?\d+(?:\.\d+)?/.exec(s.replace(/,/g, "").trim());
  return m ? parseFloat(m[0]) : null;
}

export function yes(s: string | undefined): boolean {
  return s != null && /^(1|y|yes|true|on)$/i.test(s.trim());
}
