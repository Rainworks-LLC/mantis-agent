import type {
  OllamaChatChunk,
  OllamaChatRequest,
  OllamaListResponse,
  OllamaModel,
  OllamaShowResponse,
} from "./types.js";

export class OllamaClient {
  constructor(private baseUrl: string) {}

  /** Check if Ollama is reachable. */
  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** List locally installed models. */
  async listModels(): Promise<OllamaModel[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`);
    if (!res.ok) throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
    const data = (await res.json()) as OllamaListResponse;
    return data.models;
  }

  /** Get details about a specific model. */
  async showModel(name: string): Promise<OllamaShowResponse> {
    const res = await fetch(`${this.baseUrl}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
    return (await res.json()) as OllamaShowResponse;
  }

  /**
   * Streaming chat completion. Yields parsed NDJSON chunks.
   * When `tools` are provided, the final chunk may contain `tool_calls`.
   * Pass an AbortSignal to cancel the stream mid-flight.
   */
  async *chat(request: OllamaChatRequest, signal?: AbortSignal): AsyncGenerator<OllamaChatChunk> {
    const body: OllamaChatRequest = { ...request, stream: true };
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
    if (!res.body) throw new Error("No response body from Ollama");

    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last partial line in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        yield JSON.parse(trimmed) as OllamaChatChunk;
      }
    }

    // Flush remaining buffer
    const remaining = buffer.trim();
    if (remaining) {
      yield JSON.parse(remaining) as OllamaChatChunk;
    }
  }

  /**
   * Non-streaming chat for simple request/response (e.g. tool-call round).
   * Returns the full assistant message.
   */
  async chatOnce(request: OllamaChatRequest): Promise<OllamaChatChunk> {
    const body: OllamaChatRequest = { ...request, stream: false };
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
    return (await res.json()) as OllamaChatChunk;
  }
}
