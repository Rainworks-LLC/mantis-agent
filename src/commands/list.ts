import chalk from "chalk";
import { listAgents } from "../agents/store.js";

export async function listCommand(): Promise<void> {
  const agents = await listAgents();

  if (agents.length === 0) {
    console.log(chalk.yellow("No agents yet. Create one with: mantis create"));
    return;
  }

  console.log(chalk.bold("Your agents:\n"));
  for (const a of agents) {
    console.log(
      `  ${a.emoji} ${chalk.cyan(a.name)} ${chalk.dim(`(${a.id})`)}  model: ${chalk.dim(a.model)}`,
    );
  }
  console.log();
}
