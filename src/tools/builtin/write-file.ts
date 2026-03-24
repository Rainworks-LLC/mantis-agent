import { writeFile, mkdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { paths } from "../../config/paths.js";
import type { MantisToolDefinition } from "../types.js";

export function writeFileTool(agentId: string): MantisToolDefinition {
  const workspace = paths.agent(agentId);
  return {
    name: "write_file",
    description:
      "Write content to a file. Path is relative to the agent workspace. Creates directories as needed.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to workspace" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
    async execute(args) {
      const filePath = resolve(workspace, args.path as string);
      if (!filePath.startsWith(workspace)) {
        throw new Error("Path must be within the agent workspace");
      }
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, args.content as string, "utf-8");
      return `Wrote ${filePath}`;
    },
  };
}
