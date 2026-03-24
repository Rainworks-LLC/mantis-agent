import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { paths } from "./paths.js";

export interface MantisConfig {
  ollamaUrl: string;
  defaultModel: string;
}

const DEFAULT_CONFIG: MantisConfig = {
  ollamaUrl: "http://127.0.0.1:11434",
  defaultModel: "llama3.1",
};

export async function loadConfig(): Promise<MantisConfig> {
  try {
    const raw = await readFile(paths.config, "utf-8");
    const parsed = JSON.parse(raw) as Partial<MantisConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: MantisConfig): Promise<void> {
  await mkdir(dirname(paths.config), { recursive: true });
  await writeFile(paths.config, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export async function getConfigValue(key: string): Promise<string | undefined> {
  const config = await loadConfig();
  return (config as unknown as Record<string, unknown>)[key] as string | undefined;
}

export async function setConfigValue(key: string, value: string): Promise<void> {
  const config = await loadConfig();
  if (!(key in DEFAULT_CONFIG)) {
    throw new Error(
      `Unknown config key: ${key}. Valid keys: ${Object.keys(DEFAULT_CONFIG).join(", ")}`,
    );
  }
  (config as unknown as Record<string, string>)[key] = value;
  await saveConfig(config);
}
