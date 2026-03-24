import { writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { paths } from "../../config/paths.js";
import type { MantisToolDefinition } from "../types.js";

const execFileAsync = promisify(execFile);

export function createToolProjectTool(agentId: string): MantisToolDefinition {
  return {
    name: "create_tool_project",
    description:
      "Create a complex self-built tool with npm dependencies. Creates a subdirectory with package.json + implementation, runs npm install, and generates a thin .mjs wrapper in the tools/ root so the loader picks it up.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "Tool name (lowercase alphanumeric + hyphens). Used for both the directory and the wrapper filename.",
        },
        code: {
          type: "string",
          description:
            "Full ESM JavaScript code for the tool implementation (saved as index.js inside the subdirectory). Must export { name, description, parameters, execute }.",
        },
        dependencies: {
          type: "string",
          description:
            'JSON object of npm dependencies, e.g. {"chromadb": "^1.10.0", "cheerio": "^1.0.0"}',
        },
      },
      required: ["name", "code", "dependencies"],
    },
    async execute(args) {
      const toolName = args.name as string;
      const code = args.code as string;
      const depsRaw = args.dependencies as string;

      if (!/^[a-z0-9-]+$/.test(toolName)) {
        throw new Error("Tool name must be lowercase alphanumeric with hyphens only");
      }

      let deps: Record<string, string>;
      try {
        deps = JSON.parse(depsRaw);
      } catch {
        throw new Error("dependencies must be a valid JSON object");
      }

      const toolsDir = paths.tools(agentId);
      const projectDir = join(toolsDir, toolName);
      await mkdir(projectDir, { recursive: true });

      // Write the implementation
      await writeFile(join(projectDir, "index.js"), code, "utf-8");

      // Write package.json
      const pkg = {
        name: `mantis-tool-${toolName}`,
        version: "1.0.0",
        type: "module",
        dependencies: deps,
      };
      await writeFile(
        join(projectDir, "package.json"),
        JSON.stringify(pkg, null, 2) + "\n",
        "utf-8",
      );

      // Install dependencies
      try {
        await execFileAsync("npm", ["install", "--omit=dev"], {
          cwd: projectDir,
          timeout: 300_000,
          maxBuffer: 2 * 1024 * 1024,
        });
      } catch (err) {
        const e = err as { stderr?: string; message: string };
        throw new Error(`npm install failed: ${e.stderr?.trim() || e.message}`);
      }

      // Write the thin .mjs wrapper that re-exports from the subdirectory
      const wrapper = `export { name, description, parameters, execute } from './${toolName}/index.js';\n`;
      await writeFile(join(toolsDir, `${toolName}.mjs`), wrapper, "utf-8");

      return `Created tool project: ${projectDir}/ with wrapper ${toolName}.mjs`;
    },
  };
}
