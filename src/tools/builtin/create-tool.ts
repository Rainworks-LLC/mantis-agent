import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { paths } from "../../config/paths.js";
import type { MantisToolDefinition } from "../types.js";

export function createToolTool(agentId: string): MantisToolDefinition {
  return {
    name: "create_tool",
    description:
      "Create a new self-built tool as a .mjs file in the agent's tools directory. The file must export: { name, description, parameters, execute }.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Tool name (alphanumeric + hyphens)" },
        code: {
          type: "string",
          description:
            "Full JavaScript ESM code for the tool. Must export { name, description, parameters, execute }.",
        },
      },
      required: ["name", "code"],
    },
    async execute(args) {
      const toolName = args.name as string;
      const code = args.code as string;

      // Validate name
      if (!/^[a-z0-9-]+$/.test(toolName)) {
        throw new Error("Tool name must be lowercase alphanumeric with hyphens only");
      }

      const toolsDir = paths.tools(agentId);
      await mkdir(toolsDir, { recursive: true });

      const filePath = join(toolsDir, `${toolName}.mjs`);
      await writeFile(filePath, code, "utf-8");

      return `Created tool: ${filePath}`;
    },
  };
}
