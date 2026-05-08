import type { Hidden, Project, SearchHit, SessionDetail, SessionMeta } from "@shared/types";
import { vscode } from "./vscode";

type Pending = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

const pending = new Map<number, Pending>();
let nextId = 1;

type IncomingResponse = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string };
type IncomingPush = { type: "files_changed" } | { type: "hidden_changed"; data: Hidden };

type PushHandler = (msg: IncomingPush) => void;
const pushHandlers = new Set<PushHandler>();

window.addEventListener("message", (event) => {
  const data = event.data as IncomingResponse | IncomingPush | undefined;
  if (!data || typeof data !== "object") return;
  if ("type" in data && (data.type === "files_changed" || data.type === "hidden_changed")) {
    for (const h of pushHandlers) h(data);
    return;
  }
  if ("id" in data) {
    const handler = pending.get(data.id);
    if (!handler) return;
    pending.delete(data.id);
    if (data.ok) handler.resolve(data.result);
    else handler.reject(new Error(data.error));
  }
});

function call<T>(method: string, params?: unknown): Promise<T> {
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    vscode.postMessage(params === undefined ? { id, method } : { id, method, params });
  });
}

export const api = {
  projects: () => call<Project[]>("list_projects"),
  sessions: (projectName: string) => call<SessionMeta[]>("list_sessions", { projectName }),
  session: (id: string) => call<SessionDetail | null>("get_session", { id }),
  search: (query: string) => call<SearchHit[]>("search", { query }),
  refresh: () => call<boolean>("refresh"),
  getHidden: () => call<Hidden>("get_hidden"),
  setHidden: (hidden: Hidden) => call<boolean>("set_hidden", { hidden }),
};

export function onPush(handler: PushHandler): () => void {
  pushHandlers.add(handler);
  return () => pushHandlers.delete(handler);
}
