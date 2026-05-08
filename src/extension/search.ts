import * as fs from "node:fs/promises";
import type { SearchHit } from "@shared/types";
import * as scanner from "./scanner";

const MAX_HITS = 200;
const SNIPPET_RADIUS = 80;

export async function search(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const qChars = Array.from(q);
  const qlen = qChars.length;

  const files = await scanner.listAllFiles();
  const hits: SearchHit[] = [];

  outer: for (const entry of files) {
    let raw: string;
    try {
      raw = await fs.readFile(entry.filepath, "utf8");
    } catch {
      continue;
    }
    if (!raw.toLowerCase().includes(lower)) continue;
    const messages = await scanner.readMessages(entry.filepath);
    for (const m of messages) {
      const idx = m.text.toLowerCase().indexOf(lower);
      if (idx < 0) continue;
      const charsBefore = Array.from(m.text.slice(0, idx)).length;
      hits.push({
        projectName: entry.meta.projectName,
        sessionId: entry.meta.id,
        messageUuid: m.uuid ? m.uuid : null,
        role: m.role,
        snippet: buildSnippet(m.text, charsBefore, qlen),
        timestamp: m.timestamp ?? null,
      });
      if (hits.length >= MAX_HITS) break outer;
    }
  }

  hits.sort((a, b) => {
    const la = a.timestamp ?? "";
    const lb = b.timestamp ?? "";
    return lb.localeCompare(la);
  });
  return hits;
}

function buildSnippet(text: string, hitCharIdx: number, qlen: number): string {
  const chars = Array.from(text);
  const totalChars = chars.length;
  const start = Math.max(0, hitCharIdx - SNIPPET_RADIUS);
  const end = Math.min(totalChars, hitCharIdx + qlen + SNIPPET_RADIUS);
  let out = "";
  if (start > 0) out += "…";
  out += chars.slice(start, end).join("");
  if (end < totalChars) out += "…";
  return out;
}
