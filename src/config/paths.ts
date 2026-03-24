import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

const MANTIS_HOME = join(homedir(), ".mantis");

export const paths = {
  /** Root: ~/.mantis/ */
  home: MANTIS_HOME,
  /** Global config file */
  config: join(MANTIS_HOME, "config.json"),
  /** All agents directory */
  agents: join(MANTIS_HOME, "agents"),
  /** Per-agent workspace root */
  agent(id: string): string {
    return join(MANTIS_HOME, "agents", id);
  },
  /** Per-agent config */
  agentConfig(id: string): string {
    return join(MANTIS_HOME, "agents", id, "agent.json");
  },
  /** Per-agent sessions directory */
  sessions(id: string): string {
    return join(MANTIS_HOME, "agents", id, "sessions");
  },
  /** Per-agent self-built tools directory */
  tools(id: string): string {
    return join(MANTIS_HOME, "agents", id, "tools");
  },
  /** Per-agent daily memory directory */
  memory(id: string): string {
    return join(MANTIS_HOME, "agents", id, "memory");
  },
} as const;

/** Ensure core directories exist. Call once at CLI startup. */
export async function ensureDirs(): Promise<void> {
  await mkdir(paths.agents, { recursive: true });
}
