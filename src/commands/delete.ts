import * as p from "@clack/prompts";
import chalk from "chalk";
import { loadAgent, deleteAgent } from "../agents/store.js";

export async function deleteCommand(id: string): Promise<void> {
  const agent = await loadAgent(id);
  if (!agent) {
    console.error(chalk.red(`Agent not found: ${id}`));
    process.exitCode = 1;
    return;
  }

  const confirmed = await p.confirm({
    message: `Delete agent ${agent.emoji} ${agent.name} (${id})? This cannot be undone.`,
  });

  if (!confirmed || p.isCancel(confirmed)) {
    p.cancel("Deletion cancelled.");
    return;
  }

  await deleteAgent(id);
  console.log(chalk.green(`Deleted agent: ${agent.name} (${id})`));
}
