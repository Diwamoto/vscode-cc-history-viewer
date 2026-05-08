import type { Project } from "@shared/types";

type Props = {
  projects: Project[];
  showHidden: boolean;
  isHidden: (name: string) => boolean;
  onHide: (name: string) => void;
  onUnhide: (name: string) => void;
  onSelect: (name: string) => void;
};

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const day = 1000 * 60 * 60 * 24;
  if (diffMs < day) return "today";
  if (diffMs < 2 * day) return "1d ago";
  const days = Math.floor(diffMs / day);
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function ProjectList({
  projects,
  showHidden,
  isHidden,
  onHide,
  onUnhide,
  onSelect,
}: Props) {
  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-sunk)]">
      <ul>
        {projects.map((p) => {
          const hidden = isHidden(p.name);
          return (
            <li
              key={p.name}
              className={`group relative ${hidden && showHidden ? "opacity-50" : ""}`}
            >
              <button
                type="button"
                onClick={() => onSelect(p.name)}
                className="w-full text-left px-3 py-2 pr-9 border-b border-[var(--border)] hover:bg-[var(--bg-raised)] transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-[var(--text-bright)]">
                    {p.name}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg)] text-[var(--text)] border border-[var(--border-soft)]">
                    {p.sessionCount}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  {formatRelative(p.latestActivity)}
                </div>
              </button>
              <button
                type="button"
                aria-label={hidden ? "Unhide" : "Hide"}
                title={hidden ? "Unhide" : "Hide"}
                onClick={(e) => {
                  e.stopPropagation();
                  if (hidden) onUnhide(p.name);
                  else onHide(p.name);
                }}
                className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-active)] hover:text-[var(--text-bright)] opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {hidden ? "↺" : "✕"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
