# Mantis Agent — Documentation

Mantis Agent is a TypeScript CLI tool for creating autonomous, self-constructing agents backed by [Ollama](https://ollama.com). Each agent lives in its own workspace with a unique personality, persistent memory, and the ability to build its own tools at runtime.

## Feature Docs

- [CLI Commands](cli-commands.md) — All available CLI commands and their usage.
- [Agent Creation](agent-creation.md) — The interactive onboarding wizard for creating agents.
- [Workspace Brain Files](workspace-brain-files.md) — The 8 markdown files that compose an agent's identity and memory.
- [Bootstrap Ritual](bootstrap-ritual.md) — The first-run conversation where an agent discovers itself.
- [Configuration](configuration.md) — Global config, defaults, and how to change them.
- [Ollama Integration](ollama-integration.md) — How Mantis talks to Ollama (streaming, tool calling).
- [Tool System](tool-system.md) — Built-in tools and the `MantisToolDefinition` interface.
- [Self-Built Tools](self-built-tools.md) — How agents create their own tools at runtime.
- [Sessions](sessions.md) — Conversation persistence with append-only JSONL files.
- [Web UI](web-ui.md) — The Fastify server and browser-based chat interface.

## Prerequisites

- **Node.js 20+** — [Download](https://nodejs.org/)
- **Ollama** — [Install](https://ollama.com/) and pull at least one model:
  ```bash
  ollama pull llama3.1
  ```

## Installation

### From source (development)

```bash
git clone <repo-url>
cd mantis-agent
npm install
npm run build
```

After building, you can run the CLI directly:

```bash
node dist/cli/index.js doctor
```

Or link it globally so `mantis` is available everywhere:

```bash
npm link
mantis doctor
```

### Global install (npm)

```bash
npm install -g @rainworks-llc/mantis-agent
```

### Development mode

For iterating without full rebuilds:

```bash
npx tsx src/cli/index.ts doctor
```

Or use watch mode:

```bash
npm run dev   # rebuilds on change
```

## Quick Start

```bash
# Verify Ollama is running
mantis doctor

# Create your first agent
mantis create

# Chat with it
mantis chat <agent-id>

# Or use the web UI
mantis serve --open
```

## Architecture Overview

```
src/
├── cli/           # CLI entry point, command wiring, interactive chat
├── commands/      # Command implementations
├── config/        # Global config + path resolution
├── ollama/        # Ollama HTTP API client
├── agents/        # Agent CRUD, sessions, runner, system prompt builder
│   └── templates/ # Default brain file content
├── tools/
│   ├── builtin/   # 5 built-in tools
│   ├── loader.ts  # Dynamic .mjs tool loader
│   └── sandbox.ts # Forked child-process sandbox
├── server/        # Fastify web server + WebSocket
ui/                # Static vanilla HTML/JS/CSS chat interface
```
