import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Project, SearchHit, SessionDetail, SessionMeta } from "@shared/types";
import { api, onPush } from "./api";
import { ProjectList } from "./components/ProjectList";
import { SessionList } from "./components/SessionList";
import { MessageView } from "./components/MessageView";
import { SearchBar } from "./components/SearchBar";
import { useHidden } from "./useHidden";

type Screen =
  | { kind: "projects" }
  | { kind: "sessions"; project: string }
  | {
      kind: "messages";
      project: string;
      sessionId: string;
      scrollToUuid: string | null;
      from: "sessions" | "search";
    };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "projects" });

  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchSeq = useRef(0);

  const [showHidden, setShowHidden] = useState(false);
  const hidden = useHidden();

  const loadProjects = useCallback(() => {
    api.projects().then(setProjects).catch(console.error);
  }, []);

  const loadSessions = useCallback((project: string, initial: boolean) => {
    if (initial) setSessionsLoading(true);
    api
      .sessions(project)
      .then(setSessions)
      .catch(console.error)
      .finally(() => {
        if (initial) setSessionsLoading(false);
      });
  }, []);

  const loadSession = useCallback((id: string, initial: boolean) => {
    if (initial) setSessionLoading(true);
    api
      .session(id)
      .then((d) => setSession(d ?? null))
      .catch(console.error)
      .finally(() => {
        if (initial) setSessionLoading(false);
      });
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (screen.kind === "sessions") {
      loadSessions(screen.project, true);
    } else if (screen.kind === "messages") {
      loadSession(screen.sessionId, true);
    }
  }, [screen, loadSessions, loadSession]);

  useEffect(() => {
    return onPush((msg) => {
      if (msg.type !== "files_changed") return;
      loadProjects();
      if (screen.kind === "sessions") loadSessions(screen.project, false);
      if (screen.kind === "messages") loadSession(screen.sessionId, false);
    });
  }, [screen, loadProjects, loadSessions, loadSession]);

  const runSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (!q) {
      setSearchHits([]);
      setSearchLoading(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearchLoading(true);
    api
      .search(q)
      .then((hits) => {
        if (seq !== searchSeq.current) return;
        setSearchHits(hits);
      })
      .catch(console.error)
      .finally(() => {
        if (seq === searchSeq.current) setSearchLoading(false);
      });
  }, []);

  const onSelectHit = useCallback((hit: SearchHit) => {
    setScreen({
      kind: "messages",
      project: hit.projectName,
      sessionId: hit.sessionId,
      scrollToUuid: hit.messageUuid,
      from: "search",
    });
  }, []);

  const goBack = useCallback(() => {
    setScreen((cur) => {
      if (cur.kind === "messages") {
        if (cur.from === "search") return { kind: "projects" };
        return { kind: "sessions", project: cur.project };
      }
      if (cur.kind === "sessions") return { kind: "projects" };
      return cur;
    });
  }, []);

  const visibleProjects = useMemo(
    () => (showHidden ? projects : projects.filter((p) => !hidden.projectSet.has(p.name))),
    [projects, showHidden, hidden.projectSet]
  );
  const visibleSessions = useMemo(
    () => (showHidden ? sessions : sessions.filter((s) => !hidden.sessionSet.has(s.id))),
    [sessions, showHidden, hidden.sessionSet]
  );
  const visibleSearchHits = useMemo(
    () =>
      showHidden
        ? searchHits
        : searchHits.filter(
            (h) => !hidden.projectSet.has(h.projectName) && !hidden.sessionSet.has(h.sessionId)
          ),
    [searchHits, showHidden, hidden.projectSet, hidden.sessionSet]
  );

  const searchActive = searchQuery.length > 0;
  const showSearchInProjects = screen.kind === "projects" && searchActive;

  const headerTitle =
    screen.kind === "projects"
      ? "Projects"
      : screen.kind === "sessions"
        ? screen.project
        : screen.project;

  return (
    <div className="h-full flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="flex items-center gap-2 px-2 py-1.5 border-b border-[var(--border)] bg-[var(--bg-sunk)] shrink-0">
        {screen.kind !== "projects" && (
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            title="Back"
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--accent)] hover:bg-[var(--bg-active)]"
          >
            ←
          </button>
        )}
        <span className="text-xs font-semibold text-[var(--text-bright)] truncate min-w-0 flex-1">
          {headerTitle}
        </span>
        {hidden.totalHidden > 0 && screen.kind === "projects" && (
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap transition-colors ${
              showHidden
                ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]"
                : "bg-transparent border-[var(--border-soft)] text-[var(--text-muted)] hover:text-[var(--text-bright)]"
            }`}
            title={showHidden ? "Hiding hidden items" : "Showing hidden items"}
          >
            {showHidden ? "Hide" : `+${hidden.totalHidden}`}
          </button>
        )}
      </header>
      <div className="px-2 py-1.5 border-b border-[var(--border)] bg-[var(--bg-sunk)] shrink-0">
        <SearchBar onSearch={runSearch} />
        {screen.kind === "projects" && searchActive && (
          <div className="text-[10px] text-[var(--text-muted)] mt-1">
            {searchLoading ? "検索中..." : `${visibleSearchHits.length} 件のヒット`}
          </div>
        )}
        {screen.kind !== "projects" && (
          <div className="text-[10px] text-[var(--text-muted)] mt-1">
            {screen.kind === "sessions"
              ? `${visibleSessions.length} sessions`
              : session
                ? `${session.messages.length} messages`
                : ""}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {screen.kind === "projects" && !showSearchInProjects && (
          <ProjectList
            projects={visibleProjects}
            showHidden={showHidden}
            isHidden={(name) => hidden.projectSet.has(name)}
            onHide={hidden.hideProject}
            onUnhide={hidden.showProject}
            onSelect={(name) => setScreen({ kind: "sessions", project: name })}
          />
        )}
        {screen.kind === "projects" && showSearchInProjects && (
          <SessionList
            mode="search"
            sessions={[]}
            searchHits={visibleSearchHits}
            showHidden={showHidden}
            isHidden={(id) => hidden.sessionSet.has(id)}
            onHide={hidden.hideSession}
            onUnhide={hidden.showSession}
            onSelectSession={() => undefined}
            onSelectHit={onSelectHit}
            loading={searchLoading}
          />
        )}
        {screen.kind === "sessions" && (
          <SessionList
            mode="sessions"
            sessions={visibleSessions}
            searchHits={[]}
            showHidden={showHidden}
            isHidden={(id) => hidden.sessionSet.has(id)}
            onHide={hidden.hideSession}
            onUnhide={hidden.showSession}
            onSelectSession={(id) =>
              setScreen({
                kind: "messages",
                project: screen.project,
                sessionId: id,
                scrollToUuid: null,
                from: "sessions",
              })
            }
            onSelectHit={() => undefined}
            loading={sessionsLoading}
          />
        )}
        {screen.kind === "messages" && (
          <MessageView
            session={session}
            loading={sessionLoading}
            scrollToUuid={screen.scrollToUuid}
          />
        )}
      </div>
    </div>
  );
}
