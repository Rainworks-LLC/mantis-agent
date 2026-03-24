import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { paths } from "../config/paths.js";
import { executeSandboxed } from "./sandbox.js";
import type { MantisToolDefinition } from "./types.js";

interface RawToolExport {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Load all self-built .mjs tools from an agent's tools directory.
 * Each tool is wrapped to execute in a sandboxed child process.
 */
export async function loadAgentTools(agentId: string): Promise<MantisToolDefinition[]> {
  const toolsDir = paths.tools(agentId);
  if (!existsSync(toolsDir)) return [];

  const files = await readdir(toolsDir);
  const mjsFiles = files.filter((f) => f.endsWith(".mjs"));
  const tools: MantisToolDefinition[] = [];

  for (const file of mjsFiles) {
    try {
      const filePath = join(toolsDir, file);
      // Cache-bust so updated tools get reloaded
      const fileUrl = pathToFileURL(filePath).href + `?t=${Date.now()}`;
      const mod = (await import(fileUrl)) as RawToolExport;

      if (!mod.name || !mod.description || !mod.parameters) {
        console.warn(`Skipping ${file}: missing required exports (name, description, parameters)`);
        continue;
      }

      // Wrap execution in sandbox
      tools.push({
        name: mod.name,
        description: mod.description,
        parameters: mod.parameters,
        execute: (args) => executeSandboxed(filePath, args, agentId),
      });
    } catch (err) {
      console.warn(`Failed to load tool ${file}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return tools;
}
