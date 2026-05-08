import { useEffect, useRef } from "react";
import type { SessionDetail } from "@shared/types";
import { MessageBubble } from "./MessageBubble";

type Props = {
  session: SessionDetail | null;
  loading: boolean;
  scrollToUuid: string | null;
};

export function MessageView({ session, loading, scrollToUuid }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollToUuid || !containerRef.current) return;
    const el = containerRef.current.querySelector<HTMLElement>(
      `[data-uuid="${CSS.escape(scrollToUuid)}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("highlight-flash");
      const t = setTimeout(() => el.classList.remove("highlight-flash"), 1800);
      return () => clearTimeout(t);
    }
  }, [scrollToUuid, session?.meta.id]);

  if (loading) return <div className="p-6 text-[var(--text-muted)]">Loading…</div>;
  if (!session) {
    return (
      <div className="p-6 text-[var(--text-muted)]">
        セッションを選択してください。
      </div>
    );
  }

  const { meta, messages } = session;

  return (
    <div ref={containerRef} className="h-full overflow-y-auto bg-[var(--bg)]">
      <div className="sticky top-0 bg-[var(--bg-sunk)] border-b border-[var(--border)] px-4 py-2 z-10">
        <div className="text-xs text-[var(--text-bright)] truncate">
          {meta.cwd ?? "(no cwd)"}
        </div>
        <div className="text-[10px] text-[var(--text-muted)] mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="truncate min-w-0">id: {meta.id.slice(0, 8)}</span>
          {meta.gitBranch && <span className="truncate min-w-0">↳ {meta.gitBranch}</span>}
          <span>{meta.messageCount} msg</span>
        </div>
      </div>
      <div className="px-3 py-3 space-y-3">
        {messages.map((m) => (
          <MessageBubble key={m.uuid || `${m.timestamp}-${m.role}`} message={m} />
        ))}
      </div>
    </div>
  );
}
