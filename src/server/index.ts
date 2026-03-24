import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/config.js";
import { OllamaClient } from "../ollama/client.js";
import { loadAgent, listAgents } from "../agents/store.js";
import { AgentRunner } from "../agents/runner.js";
import { getBuiltinTools } from "../tools/builtin/index.js";
import { loadAgentTools } from "../tools/loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function startServer(port: number): Promise<void> {
  const app = Fastify({ logger: false });

  await app.register(fastifyWebsocket);

  // Resolve UI dir. tsup bundles into dist/, so ui/ is one level up.
  const { existsSync } = await import("node:fs");
  let uiDir = join(__dirname, "..", "ui");
  if (!existsSync(join(uiDir, "index.html"))) {
    // Fallback for dev/tsx execution from src/server/
    uiDir = join(__dirname, "..", "..", "ui");
  }

  await app.register(fastifyStatic, {
    root: uiDir,
    prefix: "/",
  });

  // REST: list agents
  app.get("/api/agents", async () => {
    const agents = await listAgents();
    return agents;
  });

  // REST: get agent info
  app.get<{ Params: { id: string } }>("/api/agents/:id", async (req, reply) => {
    const agent = await loadAgent(req.params.id);
    if (!agent) {
      reply.code(404);
      return { error: "Agent not found" };
    }
    return agent;
  });

  // WebSocket: chat with agent
  app.get<{ Params: { id: string } }>(
    "/api/agents/:id/chat",
    { websocket: true },
    async (socket, req) => {
      const agent = await loadAgent(req.params.id);
      if (!agent) {
        socket.send(JSON.stringify({ type: "error", message: "Agent not found" }));
        socket.close();
        return;
      }

      const config = await loadConfig();
      const client = new OllamaClient(config.ollamaUrl);

      const builtinTools = getBuiltinTools(agent.id);
      const agentTools = await loadAgentTools(agent.id);
      const tools = [...builtinTools, ...agentTools];

      const runner = new AgentRunner(agent, client, tools, {
        onToken: (token) => {
          socket.send(JSON.stringify({ type: "token", content: token }));
        },
        onAssistantMessage: (content) => {
          socket.send(JSON.stringify({ type: "message", role: "assistant", content }));
        },
        onToolCall: (name, args) => {
          socket.send(JSON.stringify({ type: "tool_call", name, args }));
        },
        onToolResult: (name, result) => {
          socket.send(JSON.stringify({ type: "tool_result", name, result }));
        },
      });

      await runner.init();
      socket.send(JSON.stringify({ type: "ready", sessionId: runner.sessionId }));

      socket.on("message", async (raw: Buffer) => {
        try {
          const data = JSON.parse(raw.toString()) as { type: string; content?: string };
          if (data.type === "message" && data.content) {
            await runner.send(data.content);
            socket.send(JSON.stringify({ type: "done" }));
          }
        } catch (err) {
          socket.send(
            JSON.stringify({
              type: "error",
              message: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      });
    },
  );

  await app.listen({ port, host: "127.0.0.1" });
  console.log(`Mantis web UI: http://127.0.0.1:${port}`);
}
