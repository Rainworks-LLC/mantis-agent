# Configuration

Global configuration is stored at `~/.mantis/config.json`.

## Config Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `ollamaUrl` | string | `http://127.0.0.1:11434` | Base URL for the Ollama API |
| `defaultModel` | string | `llama3.1` | Model used when creating agents (pre-selected in the wizard) |

## Commands

```bash
# Set a value
mantis config set ollamaUrl http://192.168.1.10:11434

# Read a value
mantis config get defaultModel
```

Setting an unknown key produces an error listing the valid keys.

## File Format

Plain JSON, human-readable:

```json
{
  "ollamaUrl": "http://127.0.0.1:11434",
  "defaultModel": "llama3.1"
}
```

## Directory Layout

All Mantis data lives under `~/.mantis/`:

```
~/.mantis/
├── config.json                  # Global config
└── agents/
    └── <agent-id>/
        ├── agent.json           # Agent metadata
        ├── SYSTEM.md            # Brain files (see workspace-brain-files.md)
        ├── PERSONA.md
        ├── MEMORY.md
        ├── BOOTSTRAP.md         # First-run only
        ├── HEARTBEAT.md
        ├── sessions/            # JSONL session files
        │   └── <uuid>.jsonl
        ├── tools/               # Self-built .mjs tools
        │   └── <name>.mjs
        └── memory/              # Daily memory logs
            └── YYYY-MM-DD.md
```

## Defaults

If `config.json` doesn't exist or is missing keys, defaults are applied automatically. The file is created on the first `config set` call.
