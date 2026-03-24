import { readFile, writeFile, readdir, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { paths } from "../config/paths.js";
import type { AgentConfig } from "./types.js";

/** Save an agent config to disk and ensure workspace dirs exist. */
export async function saveAgent(agent: AgentConfig): Promise<void> {
  const dir = paths.agent(agent.id);
  await mkdir(dir, { recursive: true });
  await mkdir(paths.sessions(agent.id), { recursive: true });
  await mkdir(paths.tools(agent.id), { recursive: true });
  await mkdir(paths.memory(agent.id), { recursive: true });
  await writeFile(paths.agentConfig(agent.id), JSON.stringify(agent, null, 2) + "\n", "utf-8");
}

/** Load a single agent config by ID. Returns null if not found. */
export async function loadAgent(id: string): Promise<AgentConfig | null> {
  const configPath = paths.agentConfig(id);
  if (!existsSync(configPath)) return null;
  const raw = await readFile(configPath, "utf-8");
  return JSON.parse(raw) as AgentConfig;
}

/** List all agent configs. */
export async function listAgents(): Promise<AgentConfig[]> {
  const agentsDir = paths.agents;
  if (!existsSync(agentsDir)) return [];

  const entries = await readdir(agentsDir, { withFileTypes: true });
  const agents: AgentConfig[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const agent = await loadAgent(entry.name);
    if (agent) agents.push(agent);
  }

  return agents;
}

/** Delete an agent and its entire workspace. */
export async function deleteAgent(id: string): Promise<boolean> {
  const dir = paths.agent(id);
  if (!existsSync(dir)) return false;
  await rm(dir, { recursive: true, force: true });
  return true;
}
