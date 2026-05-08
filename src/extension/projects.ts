import type { Project, SessionMeta } from "@shared/types";
import * as scanner from "./scanner";
import { baseDir } from "./config";

const OTHER = "(other)";

export function groupNameFor(cwd: string | null): string {
  if (!cwd) return OTHER;
  const base = baseDir();
  const prefix = base.endsWith("/") ? base : base + "/";
  if (!cwd.startsWith(prefix)) return OTHER;
  const tail = cwd.slice(prefix.length);
  const seg = tail.split("/")[0] ?? "";
  return seg || OTHER;
}

export async function listProjects(): Promise<Project[]> {
  const all = await scanner.listAllMeta();
  const groups = new Map<string, { count: number; latest: string | null }>();
  for (const m of all) {
    const cur = groups.get(m.projectName) ?? { count: 0, latest: null };
    cur.count += 1;
    if (m.lastUpdatedAt) {
      if (cur.latest === null || m.lastUpdatedAt > cur.latest) {
        cur.latest = m.lastUpdatedAt;
      }
    }
    groups.set(m.projectName, cur);
  }

  const list: Project[] = [...groups.entries()].map(([name, v]) => ({
    name,
    sessionCount: v.count,
    latestActivity: v.latest,
  }));

  list.sort((a, b) => {
    if (a.name === OTHER) return 1;
    if (b.name === OTHER) return -1;
    const la = a.latestActivity ?? "";
    const lb = b.latestActivity ?? "";
    return lb.localeCompare(la);
  });

  return list;
}

export async function listSessionsForProject(projectName: string): Promise<SessionMeta[]> {
  const all = await scanner.listAllMeta();
  const filtered = all.filter((m) => m.projectName === projectName);
  filtered.sort((a, b) => {
    const la = a.lastUpdatedAt ?? "";
    const lb = b.lastUpdatedAt ?? "";
    return lb.localeCompare(la);
  });
  return filtered;
}
