export type Project = {
  name: string;
  sessionCount: number;
  latestActivity: string | null;
};

export type SessionMeta = {
  id: string;
  projectName: string;
  cwd: string | null;
  gitBranch: string | null;
  firstPrompt: string | null;
  startedAt: string | null;
  lastUpdatedAt: string | null;
  messageCount: number;
};

export type MessageRole = "user" | "assistant" | "tool_result";

export type Message = {
  uuid: string;
  role: MessageRole;
  text: string;
  timestamp: string | null;
  model?: string | null;
};

export type SessionDetail = {
  meta: SessionMeta;
  messages: Message[];
};

export type SearchHit = {
  projectName: string;
  sessionId: string;
  messageUuid: string | null;
  role: MessageRole | null;
  snippet: string;
  timestamp: string | null;
};

export type Hidden = {
  projects: string[];
  sessions: string[];
};
