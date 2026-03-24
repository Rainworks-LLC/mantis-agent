# Ollama Integration

Mantis communicates with Ollama via its HTTP API. The `OllamaClient` class (`src/ollama/client.ts`) is the only module that talks to Ollama — all other code goes through it.

## Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Health check (`isAvailable()`) |
| `/api/tags` | GET | List installed models (`listModels()`) |
| `/api/show` | POST | Model details (`showModel()`) |
| `/api/chat` | POST | Chat completion — streaming and non-streaming |

## Streaming

The primary chat method uses NDJSON streaming (newline-delimited JSON). Each line from Ollama is a `OllamaChatChunk`:

```typescript
interface OllamaChatChunk {
  model: string;
  message: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  done: boolean;
}
```

The client exposes this as an `AsyncGenerator`:

```typescript
for await (const chunk of client.chat(request)) {
  // chunk.message.content — partial text token
  // chunk.message.tool_calls — present only on the final chunk
}
```

The streaming response is read chunk by chunk via `ReadableStream`, decoded, split by newlines, and parsed. A buffer handles partial lines across chunks.

## Tool Calling

When tools are provided in the request, Ollama may return `tool_calls` in the final chunk. Each tool call contains:

```typescript
interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}
```

Tools are formatted as `OllamaTool` objects in the request:

```typescript
interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  };
}
```

Not all Ollama models support tool calling. Models like `llama3.1` and `mistral-nemo` do; others may silently ignore the `tools` field.

## Non-Streaming

A `chatOnce()` method sends `stream: false` and returns the complete response in a single JSON object. Used internally when a simple one-shot exchange is needed.

## Configuration

The Ollama base URL defaults to `http://127.0.0.1:11434` and can be changed via:

```bash
mantis config set ollamaUrl http://192.168.1.10:11434
```

All requests use a 3-second timeout for the health check and standard `fetch` semantics for chat.
