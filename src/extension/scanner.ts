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

function isToolResultOnly(content: JsonValue): boolean {
  if (!Array.isArray(content) || content.length === 0) return false;
  for (const block of content) {
    const obj = asObject(block);
    if (!obj) return false;
    if (asString(obj.type) !== "tool_result") return false;
  }
  return true;
}

const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
const SKILL_BODY_PREFIX = "Base directory for this skill:";

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

const BASH_INPUT_RE = /^<bash-input>([\s\S]*?)<\/bash-input>\s*$/;
const BASH_OUTPUT_RE =
  /^<bash-stdout>([\s\S]*?)<\/bash-stdout>\s*<bash-stderr>([\s\S]*?)<\/bash-stderr>\s*$/;

function formatBashInput(text: string): string | null {
  const m = text.match(BASH_INPUT_RE);
  if (!m) return null;
  const cmd = (m[1] ?? "").trim();
  if (!cmd) return "```bash\n$\n```";
  const lines = cmd.split("\n").map((l, i) => (i === 0 ? `$ ${l}` : `  ${l}`));
  return "```bash\n" + lines.join("\n") + "\n```";
}

function formatBashOutput(text: string): string | null {
  const m = text.match(BASH_OUTPUT_RE);
  if (!m) return null;
  const stdout = stripAnsi(m[1] ?? "").replace(/\s+$/, "");
  const stderr = stripAnsi(m[2] ?? "").replace(/\s+$/, "");
  const parts: string[] = [];
  if (stdout) parts.push(stdout);
  if (stderr) parts.push(stderr);
  if (parts.length === 0) return "";
  return "```\n" + parts.join("\n") + "\n```";
}

function formatCommandText(text: string): string {
  if (text.startsWith(SKILL_BODY_PREFIX)) {
    const m = text.match(/skills\/([^/\s]+)/);
    const name = m?.[1];
    return name ? `[Skill loaded: ${name}]` : "[Skill loaded]";
  }

  const bashIn = formatBashInput(text);
  if (bashIn) return bashIn;

  const bashOut = formatBashOutput(text);
  if (bashOut) return bashOut;

  const cmdName = text.match(/<command-name>([\s\S]*?)<\/command-name>/)?.[1];
  const cmdArgs = text.match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1];
  const stdout = text.match(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/)?.[1];

  if (cmdName === undefined && stdout === undefined) return text;

  const parts: string[] = [];
  if (cmdName !== undefined) {
    parts.push(`RunCommand: ${cmdName.trim()}`);
    if (cmdArgs && cmdArgs.trim()) {
      parts.push(`Arg: ${cmdArgs.trim()}`);
    }
  }
  if (stdout !== undefined) {
    const out = stripAnsi(stdout).trim();
    if (out) parts.push(`Output: ${out}`);
  }

  const rest = text
    .replace(/<command-name>[\s\S]*?<\/command-name>/g, "")
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, "")
    .replace(/<command-args>[\s\S]*?<\/command-args>/g, "")
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, "")
    .trim();

  if (rest) parts.push(rest);
  return parts.join("\n\n");
}

const CAVEAT_RE = /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g;

function stripCaveats(s: string): string {
  return s.replace(CAVEAT_RE, "");
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
      if (message && "content" in message && !isToolResultOnly(message.content)) {
        const txt = stripCaveats(
          formatCommandText(extractText(message.content).trim())
        ).trim();
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
    if (role === "user" && isToolResultOnly(content)) role = "tool_result";
    const text = formatCommandText(extractText(content).trim()).trim();
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
