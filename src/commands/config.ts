import chalk from "chalk";
import { getConfigValue, setConfigValue, loadConfig } from "../config/config.js";

export async function configSetCommand(key: string, value: string): Promise<void> {
  try {
    await setConfigValue(key, value);
    console.log(chalk.green(`${key} = ${value}`));
  } catch (err) {
    console.error(chalk.red((err as Error).message));
    process.exitCode = 1;
  }
}

export async function configGetCommand(key: string): Promise<void> {
  const config = await loadConfig();
  const value = (config as unknown as Record<string, unknown>)[key];
  if (value === undefined) {
    console.error(chalk.red(`Unknown config key: ${key}`));
    console.error(chalk.dim(`Valid keys: ${Object.keys(config).join(", ")}`));
    process.exitCode = 1;
    return;
  }
  console.log(`${key} = ${value}`);
}
