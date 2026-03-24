import chalk from "chalk";
import { loadAgent } from "../agents/store.js";
import { paths } from "../config/paths.js";

export async function infoCommand(id: string): Promise<void> {
  const agent = await loadAgent(id);
  if (!agent) {
    console.error(chalk.red(`Agent not found: ${id}`));
    process.exitCode = 1;
    return;
  }

  console.log(chalk.bold(`\n${agent.emoji} ${agent.name}\n`));
  console.log(`  ID:        ${agent.id}`);
  console.log(`  Model:     ${agent.model}`);
  console.log(`  Creature:  ${agent.creatureType}`);
  console.log(`  Vibe:      ${agent.vibe}`);
  console.log(`  Created:   ${agent.createdAt}`);
  console.log(`  Workspace: ${chalk.dim(paths.agent(agent.id))}`);
  console.log();
}
