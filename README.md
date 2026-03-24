# Mantis Agent

Autonomous, self-constructing agents that run locally on your machine, powered by [Ollama](https://ollama.com).

Each agent lives in its own workspace with its own personality, memory, and dynamically built tools. Tell an agent what you need — it builds the tools to do it.

## Features

- **Self-constructing** — Agents create their own tools at runtime. Need database access? Describe the schema and the agent builds a query tool on the fly.
- **Persistent memory** — Each agent maintains long-term memory and daily logs across sessions. They remember who you are and what you've worked on.
- **Multiple agents** — Run as many agents as you want, each with a unique identity, model, and toolset. A research agent, a coding assistant, a news briefer — all at once.
- **Local and private** — Everything runs on your hardware through Ollama. No API keys, no cloud, no data leaving your machine.
- **Web UI included** — Chat with agents in the browser via a built-in Fastify server with WebSocket streaming.

## Quickstart

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- [Ollama](https://ollama.com) running locally with at least one model pulled (e.g. `ollama pull llama3.1`)

### Install

One-line install (macOS / Linux):

```bash
curl -fsSL https://raw.githubusercontent.com/Rainworks-LLC/mantis-agent/main/install.sh | bash
```

The installer checks for Node.js 20+ and Ollama, installs them if needed, and sets up the `mantis` CLI globally.

Or install manually via npm:

```bash
npm install -g mantis-agent
```

Or run from source:

```bash
git clone https://github.com/Rainworks-LLC/mantis-agent.git
cd mantis-agent
npm install
npm run build
npm link
```

### Create an agent

```bash
mantis create
```

The interactive wizard walks you through naming your agent, choosing a model, and setting a personality. Or skip the prompts:

```bash
mantis create --name Atlas --model llama3.1
```

### Chat

```bash
mantis chat atlas
```

The TUI streams responses in real time, executes tool calls automatically, and keeps the input prompt always visible. Press `Escape` to abort a response, type `/new` to start a fresh session, or `/quit` to exit.

### Web UI

```bash
mantis serve --open
```

Opens a browser-based chat interface with the same streaming and tool-calling capabilities.

## Built-in Tools

Every agent starts with six tools out of the box:

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents from the workspace |
| `write_file` | Write or create files |
| `run_shell` | Execute shell commands |
| `fetch_url` | Fetch a URL and return the response |
| `create_tool` | Create a simple single-file tool (.mjs) |
| `create_tool_project` | Create a tool with npm dependencies |

Agents can extend themselves at any time. When an agent calls `create_tool` or `create_tool_project`, the new tool is hot-loaded and immediately available — no restart needed.

## CLI Reference

| Command | Description |
|---------|-------------|
| `mantis create` | Interactive agent creation wizard |
| `mantis list` | List all agents |
| `mantis info <id>` | Show agent details and workspace path |
| `mantis chat <id>` | Start a chat session |
| `mantis delete <id>` | Delete an agent and its workspace |
| `mantis models list` | List installed Ollama models |
| `mantis doctor` | Check Ollama connectivity and setup |
| `mantis config set <key> <value>` | Set a global config value |
| `mantis config get <key>` | Read a config value |
| `mantis serve` | Start the web UI server |

## How It Works

```
~/.mantis/
├── config.json              # Global config (Ollama URL, default model)
└── agents/
    └── atlas/
        ├── agent.json       # Agent metadata (name, model, emoji)
        ├── SYSTEM.md        # Session protocol and safety rules
        ├── PERSONA.md       # Identity, personality, communication style
        ├── MEMORY.md        # Long-term memory (agent-maintained)
        ├── BOOTSTRAP.md     # First-run ritual (self-deletes after use)
        ├── memory/          # Daily memory logs (YYYY-MM-DD.md)
        ├── sessions/        # Conversation history (JSONL)
        └── tools/           # Self-built tools (.mjs files)
```

At the start of each session, the system prompt is assembled from brain files (SYSTEM.md, PERSONA.md, MEMORY.md, recent daily logs). The agent reads and writes these files itself — they're the agent's continuity across sessions.

Self-built tools in `tools/` are loaded dynamically and executed in sandboxed child processes with a timeout and the working directory locked to the agent's workspace.

## Development

```bash
npm run dev       # Build in watch mode
npm run build     # Production build (tsup → dist/)
npm test          # Run tests (vitest)
npm run typecheck # Type-check without emitting
```

Run the CLI from source without building:

```bash
npx tsx src/cli/index.ts create
npx tsx src/cli/index.ts chat atlas
```

## License

MIT