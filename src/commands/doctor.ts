import chalk from "chalk";
import { loadConfig } from "../config/config.js";
import { OllamaClient } from "../ollama/client.js";
import { paths } from "../config/paths.js";

export async function doctorCommand(): Promise<void> {
  const config = await loadConfig();
  console.log(chalk.bold("Mantis Doctor\n"));

  // Check data directory
  console.log(`  Data directory: ${chalk.cyan(paths.home)}`);
  console.log(`  Ollama URL:    ${chalk.cyan(config.ollamaUrl)}`);
  console.log(`  Default model: ${chalk.cyan(config.defaultModel)}`);
  console.log();

  // Check Ollama connectivity
  const client = new OllamaClient(config.ollamaUrl);
  const available = await client.isAvailable();
  if (available) {
    console.log(`  Ollama: ${chalk.green("✓ connected")}`);
    const models = await client.listModels();
    console.log(`  Models: ${chalk.green(`${models.length} installed`)}`);

    const hasDefault = models.some(
      (m) => m.name === config.defaultModel || m.name.startsWith(config.defaultModel + ":"),
    );
    if (hasDefault) {
      console.log(`  Default model: ${chalk.green("✓ available")}`);
    } else {
      console.log(
        `  Default model: ${chalk.yellow("✗ not found")} — pull it with: ollama pull ${config.defaultModel}`,
      );
    }
  } else {
    console.log(`  Ollama: ${chalk.red("✗ unreachable")}`);
    console.log(chalk.dim("  Is Ollama running? Try: ollama serve"));
  }

  console.log();
}
