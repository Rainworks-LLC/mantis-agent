import chalk from "chalk";
import { loadConfig } from "../config/config.js";
import { OllamaClient } from "../ollama/client.js";

export async function listModelsCommand(): Promise<void> {
  const config = await loadConfig();
  const client = new OllamaClient(config.ollamaUrl);

  const available = await client.isAvailable();
  if (!available) {
    console.error(chalk.red(`Cannot reach Ollama at ${config.ollamaUrl}`));
    console.error(chalk.dim("Is Ollama running? Try: ollama serve"));
    process.exitCode = 1;
    return;
  }

  const models = await client.listModels();
  if (models.length === 0) {
    console.log(chalk.yellow("No models installed. Pull one with: ollama pull llama3.1"));
    return;
  }

  console.log(chalk.bold("Installed Ollama models:\n"));
  for (const m of models) {
    const size = (m.size / 1e9).toFixed(1) + " GB";
    console.log(
      `  ${chalk.cyan(m.name)}  ${chalk.dim(m.details.parameter_size)}  ${chalk.dim(size)}`,
    );
  }
  console.log();
}
