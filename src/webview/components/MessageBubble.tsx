import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@shared/types";

const COLLAPSE_THRESHOLD = 1500;

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

type Props = {
  message: Message;
};

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const isLong = message.text.length > COLLAPSE_THRESHOLD;
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
              {message.text.length.toLocaleString()} chars
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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
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
