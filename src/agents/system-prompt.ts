import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { paths } from "../config/paths.js";
import type { AgentConfig } from "./types.js";
import type { MantisToolDefinition } from "../tools/types.js";

/**
 * Brain files loaded every session, in order.
 * Missing files are silently skipped.
 */
const BRAIN_FILES = ["SYSTEM.md", "PERSONA.md", "MEMORY.md"] as const;

/** Read a file if it exists, otherwise return null. */
async function readOptional(filePath: string): Promise<string | null> {
  if (!existsSync(filePath)) return null;
  return readFile(filePath, "utf-8");
}

/** Get today's date as YYYY-MM-DD. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Get yesterday's date as YYYY-MM-DD. */
function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Assemble the full system prompt for an agent from workspace brain files.
 * Reads files in order, skips missing ones, appends date/time and tool instructions.
 */
export async function buildSystemPrompt(
  agent: AgentConfig,
  tools?: MantisToolDefinition[],
): Promise<string> {
  const dir = paths.agent(agent.id);
  const sections: string[] = [];

  // Check for bootstrap file (first-run only)
  const bootstrap = await readOptional(join(dir, "BOOTSTRAP.md"));
  if (bootstrap) {
    sections.push(bootstrap);
  }

  // Load brain files
  for (const file of BRAIN_FILES) {
    const content = await readOptional(join(dir, file));
    if (content) {
      sections.push(content);
    }
  }

  // Load today's + yesterday's daily memory
  for (const date of [today(), yesterday()]) {
    const memoryFile = join(paths.memory(agent.id), `${date}.md`);
    const content = await readOptional(memoryFile);
    if (content) {
      sections.push(`# Daily Memory — ${date}\n\n${content}`);
    }
  }

  // Append runtime context
  const now = new Date();

  // Build tool list for the agent to see
  const toolListLines = tools
    ? tools.map((t) => `- \`${t.name}\` — ${t.description}`).join("\n")
    : "(no tools loaded)";

  sections.push(`# Runtime Context

- **Current date:** ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
- **Current time:** ${now.toLocaleTimeString("en-US")}
- **Agent ID:** ${agent.id}
- **Workspace:** ${dir}

## Available Tools (call by name)
${toolListLines}

**IMPORTANT:** Every tool listed above — both built-in and self-built — is called the same way: just use the tool by name with the required parameters. You do NOT create scripts or use run_shell to invoke your own tools. The system handles execution automatically.

## Tool Creation
When you need a capability that doesn't exist in your available tools, you have two options:

### Simple tools (no dependencies)
Use \`create_tool\` to create a single .mjs file in your tools/ directory. The file must export: \`{ name, description, parameters, execute }\`.

### Complex tools (with npm dependencies)
Use \`create_tool_project\` to create a tool with its own directory, package.json, and npm dependencies. This:
1. Creates \`tools/<name>/\` with your code as \`index.js\` and a \`package.json\`
2. Runs \`npm install\` to install dependencies
3. Generates a thin \`tools/<name>.mjs\` wrapper that the loader picks up

Your index.js must export \`{ name, description, parameters, execute }\` just like a simple tool.

After creating a tool, it is **automatically available** — call it by name just like any built-in tool. Do NOT write scripts to invoke it.
`);

  return sections.join("\n\n---\n\n");
}
