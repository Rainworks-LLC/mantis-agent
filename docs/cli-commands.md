# CLI Commands

All commands available through the `mantis` CLI binary.

## `mantis create`

Launch the interactive agent creation wizard. See [Agent Creation](agent-creation.md) for the full flow.

```bash
mantis create
mantis create --name Atlas --model llama3.1
```

**Options:**
| Flag | Description |
|------|-------------|
| `--name <name>` | Skip the name prompt |
| `--model <model>` | Skip the model selector |

## `mantis list`

List all agents with their emoji, name, ID, and model.

```bash
mantis list
```

## `mantis info <id>`

Show full details for an agent, including workspace path.

```bash
mantis info atlas
```

## `mantis delete <id>`

Delete an agent and its entire workspace. Prompts for confirmation.

```bash
mantis delete atlas
```

## `mantis chat <id>`

Start an interactive chat session with an agent. Streams tokens in real time, handles tool calls automatically. Type `/quit` to exit.

```bash
mantis chat atlas
mantis chat atlas --session <session-id>
```

**Options:**
| Flag | Description |
|------|-------------|
| `--session <id>` | Resume a specific session instead of starting a new one |

## `mantis models list`

List locally installed Ollama models with name, size, and parameter count.

```bash
mantis models list
```

## `mantis doctor`

Check Ollama connectivity, count installed models, verify the default model exists, and confirm the data directory.

```bash
mantis doctor
```

## `mantis config set <key> <value>`

Set a global configuration value. See [Configuration](configuration.md) for valid keys.

```bash
mantis config set ollamaUrl http://192.168.1.10:11434
mantis config set defaultModel mistral-nemo
```

## `mantis config get <key>`

Read a single config value.

```bash
mantis config get defaultModel
```

## `mantis serve`

Start the web UI server. See [Web UI](web-ui.md) for details.

```bash
mantis serve
mantis serve --port 8080 --open
```

**Options:**
| Flag | Description |
|------|-------------|
| `--port <port>` | Port to listen on (default: `3777`) |
| `--open` | Open the browser automatically |
