import type { SearchHit, SessionMeta } from "@shared/types";

type Props = {
  mode: "sessions" | "search";
  sessions: SessionMeta[];
  searchHits: SearchHit[];
  showHidden: boolean;
  isHidden: (id: string) => boolean;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
  onSelectSession: (id: string) => void;
  onSelectHit: (hit: SearchHit) => void;
  loading: boolean;
};

function formatTs(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export function SessionList({
  mode,
  sessions,
  searchHits,
  showHidden,
  isHidden,
  onHide,
  onUnhide,
  onSelectSession,
  onSelectHit,
  loading,
}: Props) {
  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-sunk)]">
      {loading && (
        <div className="px-3 py-2 text-[var(--text-muted)] text-sm">Loading…</div>
      )}
      {mode === "sessions" && (
        <ul>
          {sessions.map((s) => {
            const hidden = isHidden(s.id);
            return (
              <li
                key={s.id}
                className={`group relative ${hidden && showHidden ? "opacity-50" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => onSelectSession(s.id)}
                  className="w-full text-left px-3 py-2 pr-9 border-b border-[var(--border)] hover:bg-[var(--bg-raised)] transition-colors"
                >
                  <div className="text-xs text-[var(--text-muted)] flex items-center justify-between">
                    <span>{formatTs(s.lastUpdatedAt)}</span>
                    <span>{s.messageCount} msg</span>
                  </div>
                  <div className="text-sm text-[var(--text-bright)] mt-0.5 line-clamp-3">
                    {s.firstPrompt ?? (
                      <span className="text-[var(--text-muted)]">(no prompt)</span>
                    )}
                  </div>
                  {s.gitBranch && (
                    <div className="text-xs text-[var(--text-muted)] mt-1 truncate">
                      ↳ {s.gitBranch}
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  aria-label={hidden ? "Unhide" : "Hide"}
                  title={hidden ? "Unhide" : "Hide"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hidden) onUnhide(s.id);
                    else onHide(s.id);
                  }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-active)] hover:text-[var(--text-bright)] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {hidden ? "↺" : "✕"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {mode === "search" && (
        <ul>
          {searchHits.map((h, i) => (
            <li key={`${h.sessionId}-${h.messageUuid}-${i}`}>
              <button
                type="button"
                onClick={() => onSelectHit(h)}
                className="w-full text-left px-3 py-2 border-b border-[var(--border)] hover:bg-[var(--bg-raised)] transition-colors"
              >
                <div className="text-xs text-[var(--text-muted)] flex items-center justify-between">
                  <span className="truncate">
                    {h.projectName} · {h.role}
                  </span>
                  <span>{formatTs(h.timestamp)}</span>
                </div>
                <div className="text-sm text-[var(--text)] mt-0.5 whitespace-pre-wrap line-clamp-4">
                  {h.snippet}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
