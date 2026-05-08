import * as path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";

import { projectsDir, refreshDebounceMs } from "./config";
import * as scanner from "./scanner";

export class HistoryWatcher {
  private watcher: FSWatcher | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly onChange: () => void) {}

  start(): void {
    if (this.watcher) return;
    const root = projectsDir();
    this.watcher = chokidar.watch(path.join(root, "**", "*.jsonl"), {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
      depth: 2,
    });
    const trigger = () => this.scheduleNotify();
    this.watcher.on("add", trigger).on("change", trigger).on("unlink", trigger);
  }

  private scheduleNotify(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      this.timer = null;
      await scanner.scan(true);
      this.onChange();
    }, refreshDebounceMs());
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}
