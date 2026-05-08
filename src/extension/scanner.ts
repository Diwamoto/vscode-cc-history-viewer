import * as fs from "node:fs/promises";
import * as path from "node:path";
import pLimit from "p-limit";

import type { Message, MessageRole, SessionMeta } from "@shared/types";
import { groupNameFor } from "./projects";
import { projectsDir } from "./config";

const CACHE_TTL_MS = 4_000;
const READ_CONCURRENCY = 8;

export type FileEntry = {
  filepath: string;
  mtimeMs: number;
  size: number;
  meta: SessionMeta;
};

const cache = new Map<string, FileEntry>();
let lastScan = 0;

async function listJsonlFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  let top: string[];
  try {
    top = await fs.readdir(root);
  } catch {
    return out;
  }
  for (const name of top) {
    const dir = path.join(root, name);
    let st;
    try {
      st = await fs.stat(dir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    let inner: string[];
    try {
      inner = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const f of inner) {
      if (f.endsWith(".jsonl")) out.push(path.join(dir, f));
    }
  }
  return out;
}

function decodeEncodedDir(name: string): string {
  if (name.startsWith("-")) {
    return "/" + name.slice(1).replaceAll("-", "/");
  }
  return name;
}

type JsonValue = unknown;

function asString(v: JsonValue): string | null {
  return typeof v === "string" ? v : null;
}

function asObject(v: JsonValue): Record<string, JsonValue> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, JsonValue>;
  }
  return null;
}

function extractText(content: JsonValue): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      const obj = asObject(block);
      if (!obj) continue;
      const t = asString(obj.type);
      if (!t) continue;
      if (t === "text") {
        const s = asString(obj.text);
        if (s !== null) parts.push(s);
      } else if (t === "tool_result") {
        if ("content" in obj) parts.push(extractText(obj.content));
      }
    }
    return parts.join("\n");
  }
  return "";
}

function truncateChars(s: string, max: number): string {
  const chars = Array.from(s);
  if (chars.length <= max) return s;
  return chars.slice(0, max).join("");
}

function splitLines(text: string): string[] {
  return text.split("\n").filter((l) => l.length > 0);
}

async function readMeta(filepath: string, mtimeMs: number, size: number): Promise<FileEntry | null> {
  let raw: string;
  try {
    raw = await fs.readFile(filepath, "utf8");
  } catch {
    return null;
  }
  const id = path.basename(filepath, ".jsonl");
  const dir = path.basename(path.dirname(filepath));
  const fallbackCwd = decodeEncodedDir(dir);

  let cwd: string | null = null;
  let gitBranch: string | null = null;
  let firstPrompt: string | null = null;
  let startedAt: string | null = null;
  let lastUpdatedAt: string | null = null;
  let messageCount = 0;

  for (const line of splitLines(raw)) {
    let obj: Record<string, JsonValue> | null;
    try {
      const parsed = JSON.parse(line);
      obj = asObject(parsed);
    } catch {
      continue;
    }
    if (!obj) continue;
    const ts = asString(obj.timestamp);
    if (ts) {
      if (startedAt === null) startedAt = ts;
      lastUpdatedAt = ts;
    }
    if (cwd === null) {
      const c = asString(obj.cwd);
      if (c !== null) cwd = c;
    }
    if (gitBranch === null) {
      const b = asString(obj.gitBranch);
      if (b !== null) gitBranch = b;
    }
    const t = asString(obj.type);
    if (t !== "user" && t !== "assistant") continue;
    messageCount += 1;
    if (t === "user" && firstPrompt === null) {
      const message = asObject(obj.message);
      if (message && "content" in message) {
        const txt = extractText(message.content).trim();
        if (txt) firstPrompt = truncateChars(txt, 240);
      }
    }
  }

  const resolvedCwd = cwd ?? fallbackCwd;
  const projectName = groupNameFor(resolvedCwd);

  return {
    filepath,
    mtimeMs,
    size,
    meta: {
      id,
      projectName,
      cwd: resolvedCwd,
      gitBranch,
      firstPrompt,
      startedAt,
      lastUpdatedAt,
      messageCount,
    },
  };
}

export async function scan(force = false): Promise<void> {
  if (!force && Date.now() - lastScan < CACHE_TTL_MS) return;
  const root = projectsDir();
  const files = await listJsonlFiles(root);
  const limit = pLimit(READ_CONCURRENCY);
  const next = new Map<string, FileEntry>();

  await Promise.all(
    files.map((fp) =>
      limit(async () => {
        let st;
        try {
          st = await fs.stat(fp);
        } catch {
          return;
        }
        const prev = cache.get(fp);
        if (prev && prev.mtimeMs === st.mtimeMs && prev.size === st.size) {
          next.set(fp, prev);
          return;
        }
        const fresh = await readMeta(fp, st.mtimeMs, st.size);
        if (fresh) next.set(fp, fresh);
      })
    )
  );

  cache.clear();
  for (const [k, v] of next) cache.set(k, v);
  lastScan = Date.now();
}

export async function listAllMeta(): Promise<SessionMeta[]> {
  await scan(false);
  return [...cache.values()].map((e) => e.meta);
}

export async function listAllFiles(): Promise<FileEntry[]> {
  await scan(false);
  return [...cache.values()];
}

export async function findBySessionId(id: string): Promise<FileEntry | null> {
  await scan(false);
  for (const e of cache.values()) {
    if (e.meta.id === id) return e;
  }
  return null;
}

export async function readMessages(filepath: string): Promise<Message[]> {
  let raw: string;
  try {
    raw = await fs.readFile(filepath, "utf8");
  } catch {
    return [];
  }
  const out: Message[] = [];
  for (const line of splitLines(raw)) {
    let obj: Record<string, JsonValue> | null;
    try {
      obj = asObject(JSON.parse(line));
    } catch {
      continue;
    }
    if (!obj) continue;
    const t = asString(obj.type);
    let role: MessageRole;
    if (t === "user") role = "user";
    else if (t === "assistant") role = "assistant";
    else continue;
    const message = asObject(obj.message);
    if (!message) continue;
    const content = "content" in message ? message.content : "";
    const text = extractText(content).trim();
    if (!text) continue;
    out.push({
      uuid: asString(obj.uuid) ?? "",
      role,
      text,
      timestamp: asString(obj.timestamp),
      model: asString(message.model),
    });
  }
  return out;
}

export function clearCache(): void {
  cache.clear();
  lastScan = 0;
}
