import * as vscode from "vscode";
import type { Hidden } from "@shared/types";

const KEY = "cchistory:hidden:v1";

export function getHidden(context: vscode.ExtensionContext): Hidden {
  const stored = context.globalState.get<Hidden>(KEY);
  if (!stored || !Array.isArray(stored.projects) || !Array.isArray(stored.sessions)) {
    return { projects: [], sessions: [] };
  }
  return stored;
}

export async function setHidden(context: vscode.ExtensionContext, h: Hidden): Promise<void> {
  await context.globalState.update(KEY, {
    projects: Array.isArray(h.projects) ? h.projects : [],
    sessions: Array.isArray(h.sessions) ? h.sessions : [],
  });
}
