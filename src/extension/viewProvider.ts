import * as vscode from "vscode";
import { randomBytes } from "node:crypto";

import { RpcHandler, type Push } from "./rpc";

export class HistoryViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cchistory.view";
  private view: vscode.WebviewView | null = null;
  private readonly rpc: RpcHandler;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.rpc = new RpcHandler(context);
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "media")],
    };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage((msg) => this.rpc.handle(msg, view.webview));
    view.onDidDispose(() => {
      if (this.view === view) this.view = null;
    });
  }

  postPush(push: Push): void {
    this.view?.webview.postMessage(push);
  }

  notifyFilesChanged(): void {
    this.postPush({ type: "files_changed" });
  }

  focus(): void {
    void vscode.commands.executeCommand("cchistory.view.focus");
  }

  private html(webview: vscode.Webview): string {
    const nonce = randomBytes(16).toString("base64");
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "bundle.js")
    );
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "bundle.css")
    );
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`,
    ].join("; ");
    return /* html */ `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <link rel="stylesheet" href="${cssUri}" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" nonce="${nonce}" src="${jsUri}"></script>
  </body>
</html>`;
  }
}
