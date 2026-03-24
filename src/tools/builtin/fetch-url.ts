import type { MantisToolDefinition } from "../types.js";

export function fetchUrlTool(): MantisToolDefinition {
  return {
    name: "fetch_url",
    description: "Fetch a URL and return the response body as text. Only supports http and https.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch (http or https)" },
      },
      required: ["url"],
    },
    async execute(args) {
      const url = args.url as string;
      // Security: only allow http(s) to prevent SSRF
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        throw new Error("Only http and https URLs are allowed");
      }
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const text = await res.text();
      // Truncate to avoid blowing up context
      return text.length > 50_000 ? text.slice(0, 50_000) + "\n...(truncated)" : text;
    },
  };
}
