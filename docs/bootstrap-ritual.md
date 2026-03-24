# Bootstrap Ritual

The bootstrap ritual is a one-time first-run experience where a new agent discovers its identity and gets to know its user.

## How It Triggers

When `mantis create` scaffolds a new agent, `BOOTSTRAP.md` is written to the workspace. On the first `mantis chat` session, the system prompt builder detects this file and **prepends** its contents to the system prompt, before all other [brain files](workspace-brain-files.md).

## What the Agent Does

The bootstrap template instructs the agent to:

1. **Introduce itself** — Share its name, creature type, and emoji.
2. **Learn about the user** — Ask for their name, timezone, and what they'd like help with. Write answers to the User section in `PERSONA.md`.
3. **Develop its personality** — Based on its configured vibe, flesh out the Personality and Communication Style sections in `PERSONA.md`.
4. **Explore its tools** — Read `SYSTEM.md` to understand its capabilities.
5. **Delete BOOTSTRAP.md** — Once complete, the agent deletes the file using the `write_file` or `run_shell` tool so future sessions start normally.

## Behavior Guidelines

The template tells the agent to:
- Be enthusiastic but not overwhelming
- Ask questions one or two at a time
- Write to brain files as it learns things

## After Bootstrap

Once `BOOTSTRAP.md` is deleted, subsequent sessions load the regular brain files. The agent now has a populated `PERSONA.md` with its developed personality, communication style, and information about the human.

## Re-triggering Bootstrap

If you want an agent to re-bootstrap, manually create a `BOOTSTRAP.md` file in its workspace:

```bash
# Copy the template back
cp ~/.mantis/agents/<id>/... # or create manually
```

The system prompt builder will detect it and enter bootstrap mode again on the next chat.
