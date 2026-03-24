# Self-Built Tools

Agents can create their own tools at runtime using the `create_tool` built-in tool. This is the core of what makes Mantis agents self-constructing.

## How It Works

1. The agent decides it needs a capability that doesn't exist in its built-in tools.
2. It calls `create_tool` with a name and full ESM JavaScript code.
3. The code is written to `~/.mantis/agents/<id>/tools/<name>.mjs`.
4. On the next tool-loading cycle (next chat session, or when tools are reloaded), the new tool is available.

## File Format

Each `.mjs` file must export four named values:

```javascript
export const name = "my-tool";
export const description = "What this tool does";
export const parameters = {
  type: "object",
  properties: {
    input: { type: "string", description: "Some input" },
  },
  required: ["input"],
};
export async function execute(args) {
  // Tool logic here
  return { result: args.input.toUpperCase() };
}
```

## Validation

When loading, the tool loader checks for required exports (`name`, `description`, `parameters`). Files that fail validation are skipped with a warning.

## Sandboxed Execution

Self-built tools are **untrusted** — the code is agent-generated. They never run in the main process. Instead, each execution:

1. A temporary runner script is written to the OS temp directory.
2. The runner is executed as a **forked child process** via `child_process.fork()`.
3. The child's `cwd` is locked to the agent's workspace directory.
4. A **30-second timeout** kills the process if it hangs.
5. The child writes its result as JSON to stdout.
6. The parent parses the result and returns it.
7. The temporary runner script is cleaned up.

This ensures agent-generated code can't crash the main process, access files outside the workspace (from cwd), or run indefinitely.

## Cache Busting

Dynamic `import()` caches modules by URL. When a tool file is updated mid-session, a `?t=<timestamp>` query parameter is appended to the file URL to force a fresh import.

## Tool Naming

Tool names must be lowercase alphanumeric with hyphens (`/^[a-z0-9-]+$/`). The name is used directly as the filename: `<name>.mjs`.

## Example

An agent that needs to count words might create:

```javascript
export const name = "count-words";
export const description = "Count the number of words in a text string";
export const parameters = {
  type: "object",
  properties: {
    text: { type: "string", description: "Text to count words in" },
  },
  required: ["text"],
};
export async function execute(args) {
  const count = args.text.trim().split(/\s+/).length;
  return { wordCount: count };
}
```

The model calls `create_tool` with this code, and on the next interaction the tool is available for use.
