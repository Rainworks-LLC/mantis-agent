# Sessions

Every conversation with an agent is stored as an append-only JSONL file.

## Storage

Session files live at `~/.mantis/agents/<id>/sessions/<uuid>.jsonl`. A new session is created each time you start a chat (CLI or web), identified by a random UUID.

## Format

Each line is a JSON object representing one message:

```jsonl
{"role":"system","content":"...system prompt...","timestamp":"2025-01-15T10:00:00.000Z"}
{"role":"user","content":"Hello!","timestamp":"2025-01-15T10:00:05.123Z"}
{"role":"assistant","content":"Hi there!","timestamp":"2025-01-15T10:00:06.456Z"}
{"role":"assistant","content":"Let me check that.","tool_calls":[{"function":{"name":"read_file","arguments":{"path":"MEMORY.md"}}}],"timestamp":"2025-01-15T10:00:10.789Z"}
{"role":"tool","content":"# Memory\n...","timestamp":"2025-01-15T10:00:11.012Z"}
```

Messages include a `timestamp` field (ISO 8601) appended at write time. When loaded back, the timestamp is stripped — only the Ollama-compatible fields (`role`, `content`, `tool_calls`) are used.

## Message Roles

| Role | Description |
|------|-------------|
| `system` | System prompt (first message, not persisted to JSONL) |
| `user` | User's input |
| `assistant` | Agent's response, may include `tool_calls` |
| `tool` | Result of a tool execution |

## API

```typescript
// Create a new session
createSession(agentId: string): { sessionId: string; filePath: string }

// Append a message
appendMessage(filePath: string, message: OllamaMessage): Promise<void>

// Load all messages from a session
loadSession(filePath: string): Promise<OllamaMessage[]>

// List session IDs for an agent (newest first)
listSessions(agentId: string): Promise<string[]>
```

## Resuming Sessions

The CLI `chat` command accepts `--session <id>` to resume a previous session. The session's messages are loaded and prepended to the conversation context.

## Design Notes

- **Append-only**: Messages are appended one at a time via `appendFile`. No rewrites, no corruption risk from crashes mid-write.
- **One file per session**: Simple to back up, inspect, or delete individual conversations.
- **JSONL over SQLite**: Keeps the project dependency-free for storage. Sessions are small enough that line-by-line JSON is efficient.
