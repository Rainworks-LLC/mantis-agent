import * as p from "@clack/prompts";
import chalk from "chalk";
import { loadConfig } from "../config/config.js";
import { OllamaClient } from "../ollama/client.js";
import { saveAgent } from "../agents/store.js";
import { scaffoldWorkspace } from "../agents/workspace.js";
import type { AgentConfig } from "../agents/types.js";

interface CreateOptions {
  name?: string;
  model?: string;
}

/** Derive a URL-safe ID from a name. */
function toId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createCommand(opts: CreateOptions): Promise<void> {
  const config = await loadConfig();
  const client = new OllamaClient(config.ollamaUrl);

  p.intro(chalk.cyan("Create a new Mantis agent"));

  // Check Ollama first
  const available = await client.isAvailable();
  if (!available) {
    p.cancel(`Cannot reach Ollama at ${config.ollamaUrl}. Is it running?`);
    process.exitCode = 1;
    return;
  }

  // Fetch available models for the selector
  const models = await client.listModels();
  if (models.length === 0) {
    p.cancel("No Ollama models installed. Pull one first: ollama pull llama3.1");
    process.exitCode = 1;
    return;
  }

  const answers = await p.group(
    {
      name: () =>
        opts.name
          ? Promise.resolve(opts.name)
          : p.text({
              message: "What's your agent's name?",
              placeholder: "e.g. Atlas, Nova, Ziggy",
              validate: (v) => {
                if (!v.trim()) return "Name is required";
                if (v.length > 50) return "Name must be 50 characters or less";
              },
            }),
      model: () =>
        opts.model
          ? Promise.resolve(opts.model)
          : p.select({
              message: "Which Ollama model should it use?",
              options: models.map((m) => ({
                value: m.name,
                label: m.name,
                hint: m.details.parameter_size,
              })),
              initialValue: config.defaultModel,
            }),
      creatureType: () =>
        p.text({
          message: "What kind of creature is it?",
          placeholder: "e.g. owl, fox, dragon, ghost, robot",
          initialValue: "mantis",
        }),
      vibe: () =>
        p.text({
          message: "What vibe or personality style?",
          placeholder: "e.g. chill, nerdy, sarcastic, poetic, chaotic",
          initialValue: "helpful",
        }),
      emoji: () =>
        p.text({
          message: "Choose an emoji for your agent",
          placeholder: "e.g. 🦊 🐉 🤖 👻 🦉",
          initialValue: "🪲",
        }),
    },
    {
      onCancel: () => {
        p.cancel("Agent creation cancelled.");
        process.exit(0);
      },
    },
  );

  const id = toId(answers.name as string);
  const agent: AgentConfig = {
    id,
    name: answers.name as string,
    model: answers.model as string,
    createdAt: new Date().toISOString(),
    creatureType: answers.creatureType as string,
    vibe: answers.vibe as string,
    emoji: answers.emoji as string,
  };

  const s = p.spinner();
  s.start("Scaffolding agent workspace...");

  await saveAgent(agent);
  await scaffoldWorkspace(agent);

  s.stop("Agent workspace ready!");

  p.note(
    [
      `Name:     ${agent.emoji} ${agent.name}`,
      `ID:       ${agent.id}`,
      `Model:    ${agent.model}`,
      `Creature: ${agent.creatureType}`,
      `Vibe:     ${agent.vibe}`,
    ].join("\n"),
    "Agent created",
  );

  p.outro(`Start chatting: ${chalk.cyan(`mantis chat ${agent.id}`)}`);
}
