import { startServer } from "../server/index.js";

interface ServeOptions {
  port: string;
  open?: boolean;
}

export async function serveCommand(opts: ServeOptions): Promise<void> {
  const port = parseInt(opts.port, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error("Invalid port number");
    process.exitCode = 1;
    return;
  }

  await startServer(port);

  if (opts.open) {
    const { exec } = await import("node:child_process");
    exec(`open http://127.0.0.1:${port}`);
  }
}
