import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { paths } from "../../config/paths.js";
import type { MantisToolDefinition } from "../types.js";

const execFileAsync = promisify(execFile);

export function runShellTool(agentId: string): MantisToolDefinition {
  const workspace = paths.agent(agentId);
  return {
    name: "run_shell",
    description: "Execute a shell command in the agent workspace. Returns stdout and stderr.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" },
      },
      required: ["command"],
    },
    async execute(args) {
      const command = args.command as string;
      try {
        const { stdout, stderr } = await execFileAsync("sh", ["-c", command], {
          cwd: workspace,
          timeout: 300_000,
          maxBuffer: 1024 * 1024,
        });
        return JSON.stringify({ stdout: stdout.trim(), stderr: stderr.trim() });
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string; message: string };
        return JSON.stringify({
          error: e.message,
          stdout: e.stdout?.trim() ?? "",
          stderr: e.stderr?.trim() ?? "",
        });
      }
    },
  };
}
