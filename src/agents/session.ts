import { appendFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { paths } from "../config/paths.js";
import type { OllamaMessage } from "../ollama/types.js";

export interface SessionMeta {
  sessionId: string;
  agentId: string;
  startedAt: string;
}

/** Create a new session, returning the session ID and file path. */
export function createSession(agentId: string): { sessionId: string; filePath: string } {
  const sessionId = randomUUID();
  const filePath = join(paths.sessions(agentId), `${sessionId}.jsonl`);
  return { sessionId, filePath };
}

/** Append a message to a session JSONL file. */
export async function appendMessage(filePath: string, message: OllamaMessage): Promise<void> {
  const line = JSON.stringify({ ...message, timestamp: new Date().toISOString() }) + "\n";
  await appendFile(filePath, line, "utf-8");
}

/** Load all messages from a session JSONL file. */
export async function loadSession(filePath: string): Promise<OllamaMessage[]> {
  if (!existsSync(filePath)) return [];
  const content = await readFile(filePath, "utf-8");
  return content
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const { timestamp: _, ...msg } = JSON.parse(line);
      return msg as OllamaMessage;
    });
}

/** List session files for an agent (newest first). */
export async function listSessions(agentId: string): Promise<string[]> {
  const dir = paths.sessions(agentId);
  if (!existsSync(dir)) return [];
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(dir);
  return files
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => f.replace(".jsonl", ""))
    .sort()
    .reverse();
}
