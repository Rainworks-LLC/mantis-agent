# Workspace Brain Files

Each agent's identity, personality, and memory are stored as markdown files in its workspace directory (`~/.mantis/agents/<id>/`). These files compose the system prompt at runtime.

## File Overview

| File | Purpose | Loaded |
|------|---------|--------|
| `SYSTEM.md` | Session protocol, safety defaults, built-in tool list, tool usage guidelines, environment notes | Every session |
| `PERSONA.md` | Identity (name, creature type, vibe, emoji), personality, values, communication style, user profile | Every session |
| `MEMORY.md` | Long-term curated memory | Every session |
| `BOOTSTRAP.md` | First-run ritual instructions | First session only |
| `HEARTBEAT.md` | Periodic maintenance tasks | Heartbeat runs only |

## Load Order

The system prompt builder (`src/agents/system-prompt.ts`) assembles the prompt in this order:

1. **BOOTSTRAP.md** (if it exists — first run only)
2. **SYSTEM.md** → **PERSONA.md** → **MEMORY.md**
3. **Daily memory** — today's and yesterday's `memory/YYYY-MM-DD.md` files
4. **Runtime context** — current date/time, agent ID, workspace path, tool-creation instructions

Missing files are silently skipped.

## Template Variables

When scaffolded during `mantis create`, templates have these placeholders filled in:

| Variable | Source |
|----------|--------|
| `{{NAME}}` | Agent name |
| `{{MODEL}}` | Ollama model name |
| `{{CREATURE_TYPE}}` | Creature type |
| `{{VIBE}}` | Personality vibe |
| `{{EMOJI}}` | Display emoji |
| `{{CREATED_AT}}` | ISO timestamp |

## File Details

### SYSTEM.md
The foundational protocol file. Defines the session protocol, memory rules (write to MEMORY.md, log to daily memory), safety defaults (no destructive ops without confirmation, no secrets exposure), built-in tool inventory, tool usage guidelines, and self-built tool notes.

### PERSONA.md
Combines the agent's identity metadata (name, creature type, vibe, emoji, model, creation timestamp) with personality traits, values, communication style, and user profile. Starts mostly empty — the agent fills in the Personality, Communication Style, and User sections during its [bootstrap ritual](bootstrap-ritual.md).

### MEMORY.md
Persistent curated memory. The agent is instructed to store important facts, user preferences, and lessons learned here. Loaded every session for continuity.

### BOOTSTRAP.md
One-time file that triggers the [bootstrap ritual](bootstrap-ritual.md). Guides the agent through introductions, personality development, and user discovery. The agent deletes this file after completing the ritual.

### HEARTBEAT.md
Defines periodic maintenance tasks: reviewing memory for outdated entries, checking tools, summarizing daily logs. Only loaded during heartbeat runs, not regular chat sessions.

## Ownership

After initial scaffolding, brain files belong to the agent. The agent reads and writes them via `read_file` and `write_file` tools. Application code never overwrites them after creation.
