import type { AgentConfig } from "./types.js";
import type {
  OllamaMessage,
  OllamaTool,
  OllamaChatChunk,
  OllamaToolCall,
} from "../ollama/types.js";
import { OllamaClient } from "../ollama/client.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { createSession, appendMessage } from "./session.js";
import { loadAgentTools } from "../tools/loader.js";
import type { MantisToolDefinition } from "../tools/types.js";

/** Tool names that create new self-built tools. */
const TOOL_CREATION_TOOLS = new Set(["create_tool", "create_tool_project"]);

/**
 * Returns true if the assistant message looks like it's waiting for the user
 * to respond (e.g. ends with a question, or contains explicit confirmation prompts).
 * Used to suppress the auto-continue nudge when the agent is mid-conversation.
 */
function isAwaitingUserInput(content: string): boolean {
  const trimmed = content.trimEnd();
  // Ends with a question mark (possibly followed by emoji/whitespace)
  if (/\?\s*[\p{Emoji}\s]*$/u.test(trimmed)) return true;
  // Common confirmation-request phrases
  if (
    /\b(let me know|your (call|choice|pick|decision)|what (would you|do you)|shall i|should i|do you want|reply (yes|no)|just (say|tell me)|you (choose|decide))\b/i.test(
      trimmed,
    )
  )
    return true;
  return false;
}

export interface RunnerCallbacks {
  /** Called with each text token as it streams. */
  onToken?: (token: string) => void;
  /** Called when the assistant message is fully assembled. */
  onAssistantMessage?: (content: string) => void;
  /** Called when a tool is about to be executed. */
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  /** Called with the tool result. */
  onToolResult?: (name: string, result: string) => void;
}

/**
 * The core agent runner. Manages the conversation loop:
 * system prompt → user message → stream response → handle tool calls → repeat.
 */
export class AgentRunner {
  private messages: OllamaMessage[] = [];
  private sessionPath: string;
  readonly sessionId: string;
  readonly callbacks: RunnerCallbacks;

  constructor(
    private agent: AgentConfig,
    private client: OllamaClient,
    private tools: MantisToolDefinition[],
    callbacks: RunnerCallbacks = {},
  ) {
    this.callbacks = callbacks;
    const session = createSession(agent.id);
    this.sessionId = session.sessionId;
    this.sessionPath = session.filePath;
  }

  /** Initialize the runner: build system prompt and set it as the first message. */
  async init(): Promise<void> {
    const systemPrompt = await buildSystemPrompt(this.agent, this.tools);
    this.messages = [{ role: "system", content: systemPrompt }];
  }

  /** Convert internal tool definitions to Ollama tool format. */
  private getOllamaTools(): OllamaTool[] {
    return this.tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  /** Execute a tool call and return the result string. */
  private async executeTool(toolCall: OllamaToolCall): Promise<string> {
    const { name, arguments: args } = toolCall.function;
    const tool = this.tools.find((t) => t.name === name);

    if (!tool) {
      return JSON.stringify({ error: `Unknown tool: ${name}` });
    }

    try {
      this.callbacks.onToolCall?.(name, args);
      const result = await tool.execute(args);
      const resultStr = typeof result === "string" ? result : JSON.stringify(result);
      this.callbacks.onToolResult?.(name, resultStr);
      return resultStr;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.callbacks.onToolResult?.(name, `Error: ${errorMsg}`);
      return JSON.stringify({ error: errorMsg });
    }
  }

  /**
   * Send a user message and get the full assistant response.
   * Handles streaming + tool-call loops automatically.
   * Pass an AbortSignal to cancel mid-stream or between tool calls.
   */
  async send(userMessage: string, signal?: AbortSignal): Promise<string> {
    // Add user message
    const userMsg: OllamaMessage = { role: "user", content: userMessage };
    this.messages.push(userMsg);
    await appendMessage(this.sessionPath, userMsg);

    // Auto-continue: after tool calls, if the model responds with only text,
    // nudge it to keep working. Prevents the agent from stopping mid-task.
    let autoContinues = 0;
    const MAX_AUTO_CONTINUES = 5;
    let previousRoundHadTools = false;
    let lastToolHadError = false;

    // Conversation loop — continues while the model makes tool calls
    while (true) {
      // Recompute tool list each iteration (may have new tools from create_tool)
      const ollamaTools = this.tools.length > 0 ? this.getOllamaTools() : undefined;

      let fullContent = "";
      let toolCalls: OllamaToolCall[] | undefined;

      // Stream the response
      for await (const chunk of this.client.chat(
        {
          model: this.agent.model,
          messages: this.messages,
          tools: ollamaTools,
        },
        signal,
      )) {
        if (chunk.message.content) {
          fullContent += chunk.message.content;
          this.callbacks.onToken?.(chunk.message.content);
        }
        if (chunk.message.tool_calls) {
          toolCalls = chunk.message.tool_calls;
        }
      }

      // Record assistant message
      const assistantMsg: OllamaMessage = { role: "assistant", content: fullContent };
      if (toolCalls) {
        assistantMsg.tool_calls = toolCalls;
      }
      this.messages.push(assistantMsg);
      await appendMessage(this.sessionPath, assistantMsg);

      // If no tool calls, check whether we should auto-continue
      if (!toolCalls || toolCalls.length === 0) {
        if (
          previousRoundHadTools &&
          autoContinues < MAX_AUTO_CONTINUES &&
          !isAwaitingUserInput(fullContent)
        ) {
          // The model used tools recently but just responded with text —
          // it may have more work to do. Nudge it to continue.
          autoContinues++;
          const nudge: OllamaMessage = {
            role: "user",
            content: lastToolHadError
              ? "[system: The previous tool call returned an error. " +
                "Don't stop — analyze the error and try a different approach. " +
                "Use your tools to fix the problem.]"
              : "[system: If you have more work to do, continue using your tools. " +
                "If you're finished, just say so.]",
          };
          this.messages.push(nudge);
          await appendMessage(this.sessionPath, nudge);
          previousRoundHadTools = false;
          lastToolHadError = false;
          continue;
        }

        this.callbacks.onAssistantMessage?.(fullContent);
        return fullContent;
      }

      // The model made tool calls — reset continue counter and track state
      previousRoundHadTools = true;
      autoContinues = 0;
      lastToolHadError = false;

      // Execute tool calls and add results to conversation
      let createdNewTool = false;
      for (const tc of toolCalls) {
        if (signal?.aborted) break;
        const result = await this.executeTool(tc);
        const toolMsg: OllamaMessage = { role: "tool", content: result };
        this.messages.push(toolMsg);
        await appendMessage(this.sessionPath, toolMsg);

        if (result.includes('"error"')) {
          lastToolHadError = true;
        }
        if (TOOL_CREATION_TOOLS.has(tc.function.name) && !result.includes('"error"')) {
          createdNewTool = true;
        }
      }

      // Hot-reload tools if a new one was just created
      if (createdNewTool) {
        const freshAgentTools = await loadAgentTools(this.agent.id);
        // Merge: keep built-in tools, replace agent tools with fresh load
        const builtinTools = this.tools.filter(
          (t) => !freshAgentTools.some((ft) => ft.name === t.name),
        );
        this.tools = [...builtinTools, ...freshAgentTools];
      }

      // Loop back to get the model's response to the tool results
    }
  }
}
