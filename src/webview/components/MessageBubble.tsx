import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@shared/types";

const COLLAPSE_THRESHOLD = 1500;
const CAVEAT_RE = /<local-command-caveat>([\s\S]*?)<\/local-command-caveat>/g;

type Segment =
  | { kind: "text"; content: string }
  | { kind: "caveat"; content: string };

function splitCaveats(text: string): Segment[] {
  const out: Segment[] = [];
  let lastIndex = 0;
  for (const m of text.matchAll(CAVEAT_RE)) {
    const idx = m.index ?? 0;
    if (idx > lastIndex) {
      out.push({ kind: "text", content: text.slice(lastIndex, idx) });
    }
    out.push({ kind: "caveat", content: m[1] ?? "" });
    lastIndex = idx + m[0].length;
  }
  if (lastIndex < text.length) {
    out.push({ kind: "text", content: text.slice(lastIndex) });
  }
  return out;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function CaveatBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] px-2 py-0.5 rounded bg-black/25 hover:bg-black/40 text-[var(--text-muted)] font-mono"
      >
        {open ? "▾ ローカルコマンド出力を隠す" : "▸ ローカルコマンド出力"}
      </button>
      {open && (
        <pre className="mt-1 text-[12px] text-[var(--text-muted)] border-l-2 border-[var(--text-muted)] pl-2 whitespace-pre-wrap break-words bg-transparent border-0 m-0 p-0 pl-2">
          {content.trim()}
        </pre>
      )}
    </div>
  );
}

type Props = {
  message: Message;
};

function ToolResultBlock({ message }: { message: Message }) {
  const [open, setOpen] = useState(false);
  const text = message.text;
  const preview = text.replace(/\s+/g, " ").trim().slice(0, 80);
  const length = Array.from(text).length;
  return (
    <div data-uuid={message.uuid} className="flex justify-start">
      <div className="w-full">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full text-left text-[11px] px-2 py-1 rounded bg-black/15 hover:bg-black/25 text-[var(--text-muted)] font-mono truncate"
          title={preview}
        >
          {open ? "▾" : "▸"} tool_result ({length.toLocaleString()} chars)
          {!open && preview && <span className="ml-2 opacity-70">{preview}</span>}
        </button>
        {open && (
          <pre className="mt-1 text-[12px] text-[var(--text-muted)] border-l-2 border-[var(--text-muted)] pl-2 whitespace-pre-wrap break-words bg-transparent border-0 m-0 p-0 pl-2 max-h-[400px] overflow-y-auto">
            {text}
          </pre>
        )}
      </div>
    </div>
  );
}

export function MessageBubble({ message }: Props) {
  if (message.role === "tool_result") {
    return <ToolResultBlock message={message} />;
  }

  const isUser = message.role === "user";
  const segments = splitCaveats(message.text);
  const visibleLength = segments
    .filter((s) => s.kind === "text")
    .reduce((acc, s) => acc + s.content.length, 0);
  const isLong = visibleLength > COLLAPSE_THRESHOLD;
  const [expanded, setExpanded] = useState(false);
  const collapsed = isLong && !expanded;

  return (
    <div
      data-uuid={message.uuid}
      className={`flex ${isUser ? "justify-end" : "justify-start"} ${
        isUser ? "bubble-user" : "bubble-assistant"
      }`}
    >
      <div className={`flex flex-col max-w-[92%] ${isUser ? "items-end" : "items-start"}`}>
        <div className="text-[10px] mb-1 px-1 text-[var(--text-muted)]">
          <span className={isUser ? "text-emerald-300" : "text-[var(--accent)]"}>
            {message.role}
          </span>
          {message.model && <span> · {message.model}</span>}
          {isLong && (
            <span className="ml-2 text-[var(--text-muted)]">
              {visibleLength.toLocaleString()} chars
            </span>
          )}
        </div>
        <div
          className={`rounded-2xl shadow-sm ${
            isUser
              ? "rounded-tr-md bg-[var(--bubble-user-bg)] text-[var(--bubble-user-text)]"
              : "rounded-tl-md bg-[var(--bubble-assistant-bg)] text-[var(--bubble-assistant-text)]"
          }`}
        >
          <div className={`px-3 pt-2 ${collapsed ? "pb-2 bubble-collapsed" : "pb-2"}`}>
            <div className="markdown text-[13px]">
              {segments.map((seg, i) =>
                seg.kind === "text" ? (
                  <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
                    {seg.content}
                  </ReactMarkdown>
                ) : (
                  <CaveatBlock key={i} content={seg.content} />
                )
              )}
            </div>
          </div>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full text-xs px-3 py-1 border-t border-black/20 hover:bg-black/15 text-left text-[var(--text-bright)]"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
        {message.timestamp && (
          <div
            className={`text-[10px] text-[var(--text-muted)] mt-1 px-1 ${
              isUser ? "text-right" : ""
            }`}
          >
            {formatTime(message.timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}
