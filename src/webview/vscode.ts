declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage: (msg: unknown) => void;
      getState: <T>() => T | undefined;
      setState: <T>(state: T) => void;
    };
  }
}

const api = (() => {
  if (typeof window !== "undefined" && window.acquireVsCodeApi) {
    return window.acquireVsCodeApi();
  }
  return {
    postMessage: (_msg: unknown) => {},
    getState: <T,>() => undefined as T | undefined,
    setState: <T,>(_state: T) => {},
  };
})();

export const vscode = api;
