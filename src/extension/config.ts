import * as vscode from "vscode";
import * as os from "node:os";
import * as path from "node:path";

function expandHome(p: string): string {
  return p.replace(/^~(?=\/|$)/, os.homedir());
}

export function baseDir(): string {
  const cfg = vscode.workspace.getConfiguration("cchistory").get<string>("baseDir");
  if (cfg && cfg.trim()) return expandHome(cfg.trim());
  return path.join(os.homedir(), "Projects");
}

export function projectsDir(): string {
  const cfg = vscode.workspace.getConfiguration("cchistory").get<string>("projectsDir");
  if (cfg && cfg.trim()) return expandHome(cfg.trim());
  const env = process.env.CC_PROJECTS_DIR;
  if (env) return env;
  return path.join(path.dirname(baseDir()), ".claude", "projects");
}

export function refreshDebounceMs(): number {
  return vscode.workspace.getConfiguration("cchistory").get<number>("refreshDebounceMs", 500);
}
