// Parse docs/canon/*.md into world book entries. Each entry carries a "from chapter" tag so a
// "Read up to: Ch. N" bookmark can keep canon lore from getting ahead of where you are.
//
// File format (see docs/canon/README.md):
//   ---                 optional front matter: defaults for every entry in the file
//   chapter: 3
//   keys: Staff, wardens
//   ---
//   ## The Staff        each "## " heading starts an entry
//   keys: Staff, the Staff
//   chapter: 5          "from chapter" (0 = always safe)
//   always: yes         always-on (constant) entry
//   order: 40
//
//   Entry text…

import { slug } from "../shared/rng";

export interface CanonEntry {
  key: string;
  file: string;
  name: string;
  keys: string[];
  chapter: number;
  constant: boolean;
  order: number;
  content: string;
}

interface Meta {
  keys?: string[];
  chapter?: number;
  constant?: boolean;
  order?: number;
}

const META_RE = /^\s*(keys|key|chapter|from chapter|always|constant|order)\s*:\s*(.*)$/i;

function readMeta(line: string, into: Meta): boolean {
  const m = META_RE.exec(line);
  if (!m) return false;
  const k = m[1].toLowerCase();
  const v = m[2].trim();
  if (k === "keys" || k === "key") into.keys = v.split(",").map((x) => x.trim()).filter(Boolean);
  else if (k === "chapter" || k === "from chapter") into.chapter = Math.max(0, parseInt(v, 10) || 0);
  else if (k === "always" || k === "constant") into.constant = /^(y|yes|true|1|on)$/i.test(v);
  else if (k === "order") into.order = parseInt(v, 10) || 100;
  return true;
}

export function isCanonFile(path: string): boolean {
  const base = path.split("/").pop() ?? "";
  return /\.md$/i.test(base) && !/^readme\.md$/i.test(base) && !base.startsWith("_");
}

export function parseCanon(file: string, text: string): CanonEntry[] {
  let body = text.replace(/\r\n/g, "\n");
  const defaults: Meta = {};
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(body);
  if (fm) {
    for (const line of fm[1].split("\n")) readMeta(line, defaults);
    body = body.slice(fm[0].length);
  }
  const fileTitle = /^#\s+(.+)$/m.exec(body)?.[1]?.trim() ?? file.split("/").pop()!.replace(/\.md$/i, "");
  const sections: { name: string; lines: string[] }[] = [];
  let cur: { name: string; lines: string[] } | null = null;
  const preamble: string[] = [];
  for (const line of body.split("\n")) {
    const hm = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (hm) {
      cur = { name: hm[1].trim(), lines: [] };
      sections.push(cur);
    } else if (cur) cur.lines.push(line);
    else if (!/^#\s+/.test(line)) preamble.push(line);
  }
  if (!sections.length) sections.push({ name: fileTitle, lines: preamble });

  const out: CanonEntry[] = [];
  for (const s of sections) {
    const meta: Meta = { ...defaults };
    let i = 0;
    while (i < s.lines.length && (s.lines[i].trim() === "" || readMeta(s.lines[i], meta))) i++;
    const content = s.lines.slice(i).join("\n").trim();
    if (!content) continue;
    out.push({
      key: `${file.replace(/^canon\//, "")}#${slug(s.name)}`,
      file,
      name: s.name,
      keys: meta.keys ?? (meta.constant ? [] : [s.name]),
      chapter: meta.chapter ?? 0,
      constant: meta.constant ?? false,
      order: meta.order ?? 100,
      content,
    });
  }
  return out;
}

/** Is this entry past your bookmark? null bookmark = read everything. */
export function pastBookmark(chapter: number, readUpTo: number | null): boolean {
  return readUpTo != null && chapter > readUpTo;
}
