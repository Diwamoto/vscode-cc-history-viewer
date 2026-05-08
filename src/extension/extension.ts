import * as vscode from "vscode";

import { HistoryViewProvider } from "./viewProvider";
import { HistoryWatcher } from "./watcher";
import * as scanner from "./scanner";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new HistoryViewProvider(context);
  const watcher = new HistoryWatcher(() => provider.notifyFilesChanged());
  watcher.start();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(HistoryViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand("cchistory.refresh", async () => {
      scanner.clearCache();
      await scanner.scan(true);
      provider.notifyFilesChanged();
    }),
    vscode.commands.registerCommand("cchistory.focus", () => provider.focus()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("cchistory.projectsDir") ||
        e.affectsConfiguration("cchistory.refreshDebounceMs")
      ) {
        scanner.clearCache();
        void watcher.stop().then(() => watcher.start());
        provider.notifyFilesChanged();
      }
    }),
    { dispose: () => void watcher.stop() }
  );
}

export function deactivate(): void {
  // no-op; watcher disposal handled by subscription
}
