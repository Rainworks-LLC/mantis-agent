# Tool System

Mantis agents interact with the world through tools. Every tool — built-in or [self-built](self-built-tools.md) — implements the `MantisToolDefinition` interface.

## Interface

```typescript
interface MantisToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}
```

`parameters` follows JSON Schema format, which Ollama passes directly to the model for structured tool calling.

## Built-in Tools

Five tools ship with every agent. They run in-process (trusted code).

### `read_file`
Read the contents of a file. Path is relative to the agent workspace. Enforces workspace boundary — the resolved path must be under `~/.mantis/agents/<id>/`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File path relative to workspace |

### `write_file`
Write content to a file, creating directories as needed. Same workspace boundary enforcement.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File path relative to workspace |
| `content` | string | yes | Content to write |

### `run_shell`
Execute a shell command with `cwd` set to the agent workspace. 30-second timeout, 1 MB max buffer. Returns JSON with `stdout` and `stderr`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `command` | string | yes | Shell command to execute |

### `fetch_url`
Fetch an HTTP/HTTPS URL and return the response body as text. Only `http://` and `https://` protocols are allowed (SSRF protection). 15-second timeout, response truncated at 50 KB.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | yes | URL to fetch |

### `create_tool`
Create a new [self-built tool](self-built-tools.md) as a `.mjs` file in the agent's `tools/` directory. The tool name must be lowercase alphanumeric with hyphens only.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | yes | Tool name (used as filename) |
| `code` | string | yes | Full ESM JavaScript code |

## Tool Loading

At the start of a chat session, tools are loaded in two stages:

1. **Built-in tools** — `getBuiltinTools(agentId)` returns all 5 built-in tools scoped to the agent's workspace.
2. **Self-built tools** — `loadAgentTools(agentId)` scans the agent's `tools/` directory for `.mjs` files and wraps each in a sandboxed executor.

Both sets are combined and passed to the `AgentRunner`, which converts them to Ollama's tool format for each chat request.

## Tool Execution Flow

When the model returns `tool_calls` in a response:

1. The runner looks up each tool by name.
2. The tool's `execute` function is called with the arguments from the model.
3. The result (or error) is added to the conversation as a `tool` message.
4. The conversation continues — the model sees the tool result and generates its next response.
5. This loop repeats until the model returns a response with no tool calls.
