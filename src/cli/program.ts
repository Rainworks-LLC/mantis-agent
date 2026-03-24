import { Command } from "commander";

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("mantis")
    .description("Autonomous, self-constructing agents backed by Ollama")
    .version("0.1.0");

  // Phase 2: models, config, doctor
  program
    .command("models")
    .description("Manage Ollama models")
    .command("list")
    .description("List available Ollama models")
    .action(async () => {
      const { listModelsCommand } = await import("../commands/models.js");
      await listModelsCommand();
    });

  program
    .command("doctor")
    .description("Check Ollama connectivity and system status")
    .action(async () => {
      const { doctorCommand } = await import("../commands/doctor.js");
      await doctorCommand();
    });

  const configCmd = program.command("config").description("Manage global configuration");

  configCmd
    .command("set <key> <value>")
    .description("Set a config value")
    .action(async (key: string, value: string) => {
      const { configSetCommand } = await import("../commands/config.js");
      await configSetCommand(key, value);
    });

  configCmd
    .command("get <key>")
    .description("Get a config value")
    .action(async (key: string) => {
      const { configGetCommand } = await import("../commands/config.js");
      await configGetCommand(key);
    });

  // Phase 3: create, list, delete, info
  program
    .command("create")
    .description("Create a new agent")
    .option("--name <name>", "Agent name")
    .option("--model <model>", "Ollama model to use")
    .action(async (opts) => {
      const { createCommand } = await import("../commands/create.js");
      await createCommand(opts);
    });

  program
    .command("list")
    .description("List all agents")
    .action(async () => {
      const { listCommand } = await import("../commands/list.js");
      await listCommand();
    });

  program
    .command("delete <id>")
    .description("Delete an agent")
    .action(async (id: string) => {
      const { deleteCommand } = await import("../commands/delete.js");
      await deleteCommand(id);
    });

  program
    .command("info <id>")
    .description("Show agent details")
    .action(async (id: string) => {
      const { infoCommand } = await import("../commands/info.js");
      await infoCommand(id);
    });

  // Phase 4: chat
  program
    .command("chat <id>")
    .description("Chat with an agent")
    .option("--session <sessionId>", "Resume a specific session")
    .action(async (id: string, opts) => {
      const { chatCommand } = await import("./chat.js");
      await chatCommand(id, opts);
    });

  // Phase 6: serve
  program
    .command("serve")
    .description("Start the web UI server")
    .option("--port <port>", "Port to listen on", "3777")
    .option("--open", "Open browser automatically")
    .action(async (opts) => {
      const { serveCommand } = await import("../commands/serve.js");
      await serveCommand(opts);
    });

  return program;
}
