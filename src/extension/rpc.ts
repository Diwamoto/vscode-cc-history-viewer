import * as vscode from "vscode";
import type { Hidden } from "@shared/types";

import * as scanner from "./scanner";
import * as projectsApi from "./projects";
import * as searchApi from "./search";
import * as hiddenStore from "./hidden";

type Request =
  | { id: number; method: "list_projects" }
  | { id: number; method: "list_sessions"; params: { projectName: string } }
  | { id: number; method: "get_session"; params: { id: string } }
  | { id: number; method: "search"; params: { query: string } }
  | { id: number; method: "refresh" }
  | { id: number; method: "get_hidden" }
  | { id: number; method: "set_hidden"; params: { hidden: Hidden } };

export type Push =
  | { type: "files_changed" }
  | { type: "hidden_changed"; data: Hidden };

export class RpcHandler {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async handle(msg: unknown, webview: vscode.Webview): Promise<void> {
    if (!msg || typeof msg !== "object" || !("id" in msg) || !("method" in msg)) return;
    const req = msg as Request;
    try {
      const result = await this.dispatch(req, webview);
      webview.postMessage({ id: req.id, ok: true, result });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      webview.postMessage({ id: req.id, ok: false, error });
    }
  }

  private async dispatch(req: Request, webview: vscode.Webview): Promise<unknown> {
    switch (req.method) {
      case "list_projects":
        return projectsApi.listProjects();
      case "list_sessions":
        return projectsApi.listSessionsForProject(req.params.projectName);
      case "get_session": {
        const entry = await scanner.findBySessionId(req.params.id);
        if (!entry) return null;
        const messages = await scanner.readMessages(entry.filepath);
        return { meta: entry.meta, messages };
      }
      case "search":
        return searchApi.search(req.params.query);
      case "refresh":
        scanner.clearCache();
        await scanner.scan(true);
        return true;
      case "get_hidden":
        return hiddenStore.getHidden(this.context);
      case "set_hidden": {
        await hiddenStore.setHidden(this.context, req.params.hidden);
        const data = hiddenStore.getHidden(this.context);
        webview.postMessage({ type: "hidden_changed", data } satisfies Push);
        return true;
      }
    }
  }
}
