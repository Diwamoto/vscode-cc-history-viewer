import { useCallback, useEffect, useMemo, useState } from "react";
import type { Hidden } from "@shared/types";
import { api, onPush } from "./api";

export function useHidden() {
  const [hidden, setHiddenState] = useState<Hidden>({ projects: [], sessions: [] });

  useEffect(() => {
    let cancelled = false;
    api.getHidden().then((h) => {
      if (!cancelled) setHiddenState(h);
    }).catch(console.error);
    const off = onPush((msg) => {
      if (msg.type === "hidden_changed") setHiddenState(msg.data);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const persist = useCallback((next: Hidden) => {
    setHiddenState(next);
    api.setHidden(next).catch(console.error);
  }, []);

  const projectSet = useMemo(() => new Set(hidden.projects), [hidden.projects]);
  const sessionSet = useMemo(() => new Set(hidden.sessions), [hidden.sessions]);

  const hideProject = useCallback(
    (name: string) => {
      if (hidden.projects.includes(name)) return;
      persist({ ...hidden, projects: [...hidden.projects, name] });
    },
    [hidden, persist]
  );
  const showProject = useCallback(
    (name: string) => {
      persist({ ...hidden, projects: hidden.projects.filter((p) => p !== name) });
    },
    [hidden, persist]
  );
  const hideSession = useCallback(
    (id: string) => {
      if (hidden.sessions.includes(id)) return;
      persist({ ...hidden, sessions: [...hidden.sessions, id] });
    },
    [hidden, persist]
  );
  const showSession = useCallback(
    (id: string) => {
      persist({ ...hidden, sessions: hidden.sessions.filter((s) => s !== id) });
    },
    [hidden, persist]
  );

  return {
    hidden,
    projectSet,
    sessionSet,
    totalHidden: hidden.projects.length + hidden.sessions.length,
    hideProject,
    showProject,
    hideSession,
    showSession,
  };
}
