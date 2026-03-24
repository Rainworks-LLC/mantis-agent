# Agent Creation

The `mantis create` command launches an interactive onboarding wizard that guides you through creating a new agent.

## Wizard Flow

The wizard (powered by `@clack/prompts`) collects five pieces of information:

1. **Name** — The agent's display name (e.g. "Atlas", "Nova"). Used to derive the agent ID.
2. **Model** — Ollama model picker. Lists all locally installed models with parameter sizes. Defaults to the configured `defaultModel`.
3. **Creature Type** — What kind of creature the agent is (e.g. owl, fox, dragon, robot). Defaults to "mantis".
4. **Vibe** — Personality style (e.g. chill, nerdy, sarcastic, poetic). Defaults to "helpful".
5. **Emoji** — A single emoji for display in lists and UI. Defaults to 🪲.

## Skipping Prompts

Supply `--name` and/or `--model` to skip those prompts:

```bash
mantis create --name Ziggy --model mistral-nemo
```

Creature type, vibe, and emoji are always prompted interactively.

## What Gets Created

After the wizard completes, two things happen:

1. **Agent config** is saved to `~/.mantis/agents/<id>/agent.json` containing all metadata (id, name, model, createdAt, creatureType, vibe, emoji).
2. **Workspace is scaffolded** — 8 [brain files](workspace-brain-files.md) are written into the agent directory with template placeholders filled in. Subdirectories for `sessions/`, `tools/`, and `memory/` are created.

## Agent IDs

The ID is derived from the name: lowercased, non-alphanumeric characters replaced with hyphens, leading/trailing hyphens stripped.

| Name | ID |
|------|-----|
| Atlas | `atlas` |
| My Cool Bot | `my-cool-bot` |
| R2-D2 | `r2-d2` |

## Prerequisites

- Ollama must be running and reachable (checked at the start of the wizard).
- At least one model must be installed. If none are found, the wizard suggests running `ollama pull llama3.1`.

## First Conversation

After creation, the agent's workspace contains a `BOOTSTRAP.md` file. The first time you `mantis chat <id>`, the agent enters its [bootstrap ritual](bootstrap-ritual.md) — introducing itself, learning about you, and developing its personality.
