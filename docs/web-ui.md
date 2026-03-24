# Web UI

Mantis includes a browser-based chat interface served by a Fastify web server.

## Starting the Server

```bash
mantis serve
mantis serve --port 8080
mantis serve --open  # Opens browser automatically
```

The server binds to `127.0.0.1` only (localhost). No auth is required — localhost is the security boundary. Default port is `3777`.

## REST API

### `GET /api/agents`
List all agents. Returns an array of `AgentConfig` objects.

### `GET /api/agents/:id`
Get details for a single agent. Returns 404 if not found.

## WebSocket API

### `WS /api/agents/:id/chat`

Opens a chat session with an agent. All communication uses JSON messages.

**Server → Client messages:**

| Type | Fields | Description |
|------|--------|-------------|
| `ready` | `sessionId` | Connection established, session created |
| `token` | `content` | Partial text token (streaming) |
| `message` | `role`, `content` | Complete assistant message |
| `tool_call` | `name`, `args` | Tool is about to execute |
| `tool_result` | `name`, `result` | Tool execution result |
| `done` | — | Agent finished responding |
| `error` | `message` | Error occurred |

**Client → Server messages:**

| Type | Fields | Description |
|------|--------|-------------|
| `message` | `content` | User's chat message |

## UI

The interface is vanilla HTML/JS/CSS with no build step. Files live in the `ui/` directory:

- `index.html` — Layout with sidebar (agent list) and chat area
- `style.css` — Dark theme styling
- `app.js` — Agent fetching, WebSocket connection, message rendering

### Features

- **Agent sidebar** — Lists all agents with emoji and name. Click to connect.
- **Streaming tokens** — Text appears character by character as the model generates it.
- **Tool call display** — Tool calls and results are shown inline in the chat.
- **Auto-scroll** — Chat scrolls to the latest message automatically.

## Static File Serving

Fastify serves the `ui/` directory as static files at the root path (`/`). The server resolves the UI directory relative to its own location, with a fallback for dev mode when running via `tsx`.
