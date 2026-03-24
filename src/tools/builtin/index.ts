import type { MantisToolDefinition } from "../types.js";
import { readFileTool } from "./read-file.js";
import { writeFileTool } from "./write-file.js";
import { runShellTool } from "./run-shell.js";
import { fetchUrlTool } from "./fetch-url.js";
import { createToolTool } from "./create-tool.js";
import { createToolProjectTool } from "./create-tool-project.js";

/** Get all built-in tools for a given agent. */
export function getBuiltinTools(agentId: string): MantisToolDefinition[] {
  return [
    readFileTool(agentId),
    writeFileTool(agentId),
    runShellTool(agentId),
    fetchUrlTool(),
    createToolTool(agentId),
    createToolProjectTool(agentId),
  ];
}
