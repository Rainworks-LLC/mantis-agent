import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { paths } from "../../config/paths.js";
import type { MantisToolDefinition } from "../types.js";

export function readFileTool(agentId: string): MantisToolDefinition {
  const workspace = paths.agent(agentId);
  return {
    name: "read_file",
    description: "Read the contents of a file. Path is relative to the agent workspace.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to workspace" },
      },
      required: ["path"],
    },
    async execute(args) {
      const filePath = resolve(workspace, args.path as string);
      // Security: ensure the resolved path is within the workspace
      if (!filePath.startsWith(workspace)) {
        throw new Error("Path must be within the agent workspace");
      }
      return readFile(filePath, "utf-8");
    },
  };
}
