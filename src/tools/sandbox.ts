import { fork } from "node:child_process";
import { join } from "node:path";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { paths } from "../config/paths.js";

const TIMEOUT_MS = 120_000;

/**
 * Execute a self-built tool in a forked child process with cwd locked to the agent workspace.
 * Returns the result as a parsed value.
 */
export async function executeSandboxed(
  toolPath: string,
  args: Record<string, unknown>,
  agentId: string,
): Promise<unknown> {
  const workspace = paths.agent(agentId);

  // Write a small runner script that imports the tool and calls execute
  const runnerId = randomUUID();
  const runnerPath = join(tmpdir(), `mantis-sandbox-${runnerId}.mjs`);
  const runnerCode = `
import { pathToFileURL } from "node:url";
const toolPath = ${JSON.stringify(toolPath)};
const args = ${JSON.stringify(args)};
const fileUrl = pathToFileURL(toolPath).href;
const mod = await import(fileUrl);
try {
  const result = await mod.execute(args);
  process.stdout.write(JSON.stringify({ ok: true, result }));
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: err.message || String(err) }));
}
`;

  await writeFile(runnerPath, runnerCode, "utf-8");

  try {
    return await new Promise<unknown>((resolve, reject) => {
      const child = fork(runnerPath, [], {
        cwd: workspace,
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        timeout: TIMEOUT_MS,
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });
      child.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("error", (err) => reject(err));

      child.on("close", (code) => {
        try {
          const parsed = JSON.parse(stdout) as { ok: boolean; result?: unknown; error?: string };
          if (parsed.ok) {
            resolve(parsed.result);
          } else {
            reject(new Error(parsed.error ?? "Tool execution failed"));
          }
        } catch {
          reject(new Error(`Tool exited with code ${code}. stderr: ${stderr.trim()}`));
        }
      });
    });
  } finally {
    // Clean up runner script
    await unlink(runnerPath).catch(() => {});
  }
}
