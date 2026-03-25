import chalk from "chalk";
import { loadConfig } from "../config/config.js";
import { OllamaClient } from "../ollama/client.js";
import { loadAgent } from "../agents/store.js";
import { AgentRunner } from "../agents/runner.js";
import { getBuiltinTools } from "../tools/builtin/index.js";
import { loadAgentTools } from "../tools/loader.js";

interface ChatOptions {
  session?: string;
}

type TuiState = "idle" | "streaming" | "processing";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export async function chatCommand(id: string, _opts: ChatOptions): Promise<void> {
  const agent = await loadAgent(id);
  if (!agent) {
    console.error(chalk.red(`Agent not found: ${id}`));
    process.exitCode = 1;
    return;
  }

  const config = await loadConfig();
  const client = new OllamaClient(config.ollamaUrl);

  const available = await client.isAvailable();
  if (!available) {
    console.error(chalk.red(`Cannot reach Ollama at ${config.ollamaUrl}`));
    process.exitCode = 1;
    return;
  }

  // After null check above, we know agent is non-null. Re-bind for closure narrowing.
  const agentConfig = agent;

  const builtinTools = getBuiltinTools(agentConfig.id);
  const agentTools = await loadAgentTools(agentConfig.id);
  const tools = [...builtinTools, ...agentTools];

  // --- TUI State ---
  let state: TuiState = "idle";
  let inputBuffer = "";
  let cursorPos = 0;
  let abortController: AbortController | null = null;
  let spinnerTimer: ReturnType<typeof setInterval> | null = null;
  let spinnerFrame = 0;
  let currentToolName = "";
  let pendingInput: string | null = null;
  let awaitingFirstToken = false;
  let termRows = process.stdout.rows || 24;
  const promptWidth = 2; // visual width of "❯ "
  let currentInputRows = 1; // how many rows the input area currently occupies

  /** How many terminal rows the current input buffer needs. */
  function computeInputRows(): number {
    const cols = process.stdout.columns || 80;
    return Math.max(1, Math.ceil((promptWidth + Math.max(inputBuffer.length, 1)) / cols));
  }

  // --- Scroll region layout ---
  // Terminal split: rows 1..(H - inputRows) scrollable output,
  // rows (H - inputRows + 1)..H = always-visible input area.
  // Cursor always rests on the logical cursor position between operations.

  function setupLayout(): void {
    currentInputRows = 1;
    process.stdout.write("\x1b[2J\x1b[1;1H"); // Clear screen, cursor to top
    process.stdout.write(`\x1b[1;${termRows - 1}r`); // Scroll region: rows 1..(H-1)
    process.stdout.write("\x1b[?7h"); // Enable line wrapping (DECAWM)
    process.stdout.write("\x1b[1;1H"); // Cursor to output start
    process.stdout.write("\x1b7"); // Save output cursor
    parkCursor();
  }

  function teardownLayout(): void {
    process.stdout.write("\x1b[r"); // Reset scroll region
    process.stdout.write(`\x1b[${termRows};1H\n`);
  }

  /** Park cursor at the logical position within the (possibly multi-row) input area. */
  function parkCursor(): void {
    const cols = process.stdout.columns || 80;
    const inputRows = computeInputRows();
    const inputStartRow = termRows - inputRows + 1;
    const offset = promptWidth + cursorPos;
    const cursorRow = inputStartRow + Math.floor(offset / cols);
    const cursorCol = (offset % cols) + 1;
    process.stdout.write(`\x1b[${cursorRow};${cursorCol}H`);
  }

  /** Render the input prompt, expanding to multiple rows as needed. */
  function renderInputLine(): void {
    const newInputRows = computeInputRows();
    const inputStartRow = termRows - newInputRows + 1;

    // Update scroll region only when the input height changes
    if (newInputRows !== currentInputRows) {
      process.stdout.write(`\x1b[1;${inputStartRow - 1}r`);
      currentInputRows = newInputRows;
    }

    // Clear all rows occupied by the input area
    for (let r = inputStartRow; r <= termRows; r++) {
      process.stdout.write(`\x1b[${r};1H\x1b[2K`);
    }

    const p = state === "idle" ? chalk.green("❯ ") : chalk.dim("❯ ");
    process.stdout.write(`\x1b[${inputStartRow};1H${p}${inputBuffer}`);
    parkCursor();
  }

  // Alias so existing keystroke handler calls keep working
  const renderInput = () => renderInputLine();

  /** Write text into the output scroll region, then return cursor to input. */
  function output(text: string): void {
    process.stdout.write("\x1b8"); // Restore saved output position
    process.stdout.write(text);
    process.stdout.write("\x1b7"); // Save new output position
    parkCursor(); // Return cursor to input row
  }

  /** Rewrite current line in scroll region (for spinner/thinking). */
  function rewriteOutputLine(text: string): void {
    process.stdout.write("\x1b8\r\x1b[2K"); // Restore & clear line
    process.stdout.write(text);
    process.stdout.write("\x1b7"); // Save position
    parkCursor();
  }

  // --- Spinner (tool execution) ---
  function startSpinner(label: string): void {
    spinnerFrame = 0;
    currentToolName = label;
    const first = chalk.cyan(SPINNER_FRAMES[0]);
    output(`     ${first} ${chalk.dim(currentToolName + "…")}`);
    spinnerTimer = setInterval(() => {
      spinnerFrame++;
      const frame = chalk.cyan(SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]);
      rewriteOutputLine(`     ${frame} ${chalk.dim(currentToolName + "…")}`);
    }, 80);
  }

  function stopSpinner(): void {
    if (spinnerTimer) {
      clearInterval(spinnerTimer);
      spinnerTimer = null;
    }
    rewriteOutputLine("");
  }

  // --- Thinking dots (before first token) ---
  let thinkingTimer: ReturnType<typeof setInterval> | null = null;
  let thinkingDots = 0;

  function startThinking(): void {
    thinkingDots = 0;
    output(`  ${chalk.dim("·")}`);
    thinkingTimer = setInterval(() => {
      thinkingDots++;
      const dots = chalk.dim("·".repeat((thinkingDots % 3) + 1));
      rewriteOutputLine(`  ${dots}`);
    }, 400);
  }

  function stopThinking(): void {
    if (thinkingTimer) {
      clearInterval(thinkingTimer);
      thinkingTimer = null;
    }
    rewriteOutputLine("");
  }

  // --- Build runner ---
  let runner = new AgentRunner(agent, client, tools, {
    onToken: (token) => {
      if (awaitingFirstToken) {
        stopThinking();
        awaitingFirstToken = false;
      }
      if (state === "streaming") {
        output(token);
      }
    },
    onAssistantMessage: () => {
      output("\n\n");
    },
    onToolCall: (name, args) => {
      stopSpinner();
      stopThinking();
      awaitingFirstToken = false;
      const argParts = Object.entries(args).map(([k, v]) => {
        const val = typeof v === "string" ? v : JSON.stringify(v);
        return val.length > 40 ? val.slice(0, 40) + "…" : val;
      });
      const argsStr = argParts.length > 0 ? " " + chalk.dim(argParts.join(" ")) : "";
      output(`\n  ${chalk.dim("⎿")}  ${chalk.yellow(name)}${argsStr}\n`);
      state = "processing";
      startSpinner(name);
    },
    onToolResult: (_name, result) => {
      stopSpinner();
      const lines = result.split("\n").length;
      const chars = result.length;
      let summary: string;
      if (chars <= 60) {
        summary = result.replace(/\n/g, " ").trim();
      } else if (lines > 1) {
        summary = `${lines} lines · ${chars} chars`;
      } else {
        summary = result.slice(0, 60) + "…";
      }
      output(`     ${chalk.dim(summary)}\n`);
      state = "streaming";
    },
  });

  await runner.init();

  // --- Send message to runner ---
  async function sendMessage(text: string): Promise<void> {
    state = "streaming";
    abortController = new AbortController();
    renderInputLine();

    output(`\n${chalk.bold.cyan(agentConfig.emoji)} ${chalk.bold(agentConfig.name)}\n`);
    awaitingFirstToken = true;
    startThinking();

    try {
      await runner.send(text, abortController.signal);
    } catch (err: unknown) {
      stopSpinner();
      stopThinking();
      awaitingFirstToken = false;
      if (err instanceof Error && err.name === "AbortError") {
        output(chalk.dim("\n⏹ Interrupted\n\n"));
      } else {
        output(chalk.red(`\nError: ${err instanceof Error ? err.message : err}\n\n`));
      }
    }

    abortController = null;
    state = "idle";
    awaitingFirstToken = false;
    stopSpinner();
    renderInputLine();

    // If user queued a message while the model was working, send it now
    if (pendingInput) {
      const next = pendingInput;
      pendingInput = null;
      await handleSubmit(next);
    }
  }

  // --- Handle submitted input ---
  async function handleSubmit(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      renderInput();
      return;
    }

    // Slash commands
    if (trimmed === "/quit" || trimmed === "/exit") {
      cleanup();
      return;
    }

    if (trimmed === "/stop") {
      if (abortController) {
        abortController.abort();
      }
      inputBuffer = "";
      cursorPos = 0;
      renderInputLine();
      return;
    }

    if (trimmed === "/new") {
      // Create a fresh runner with new session
      runner = new AgentRunner(agentConfig, client, tools, runner.callbacks);
      await runner.init();
      output(chalk.dim(`\n  ✦ New session · ${runner.sessionId.slice(0, 8)}\n\n`));
      renderInputLine();
      return;
    }

    if (trimmed.startsWith("/")) {
      output(chalk.yellow(`Unknown command: ${trimmed}\n\n`));
      renderInputLine();
      return;
    }

    // Queue message if model is still working
    if (state !== "idle") {
      pendingInput = trimmed;
      output(chalk.dim(`  (queued: ${trimmed})\n`));
      return;
    }

    // Echo user input
    output(chalk.bold.green("❯ ") + chalk.white(trimmed) + "\n");

    await sendMessage(trimmed);
  }

  // --- Non-TTY fallback ---
  const { stdin } = process;
  if (!stdin.isTTY) {
    const readline = await import("node:readline/promises");
    const rl = readline.createInterface({ input: stdin, output: process.stdout });
    try {
      while (true) {
        const input = await rl.question(chalk.green("❯ "));
        const trimmed = input.trim();
        if (!trimmed) continue;
        if (trimmed === "/quit" || trimmed === "/exit") break;
        process.stdout.write(chalk.cyan(`\n${agentConfig.emoji} `));
        try {
          await runner.send(trimmed);
        } catch (err) {
          console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`));
        }
        console.log();
      }
    } finally {
      rl.close();
    }
    console.log(chalk.dim("\nSession saved. Goodbye!"));
    return;
  }

  // --- Raw mode for interactive TUI ---
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf-8");

  setupLayout();

  // --- Header (in scroll region) ---
  const termWidth = Math.min(process.stdout.columns || 80, 60);
  output(
    `  ${chalk.dim("╭")} ${chalk.bold(`${agentConfig.emoji} ${agentConfig.name}`)}  ${chalk.dim(agentConfig.model)}\n`,
  );
  output(`  ${chalk.dim("│")} ${chalk.dim("/stop · /new · /quit · Esc to interrupt")}\n`);
  output(`  ${chalk.dim("╰" + "─".repeat(termWidth - 3))}\n\n`);
  renderInputLine();

  // Handle terminal resize
  process.stdout.on("resize", () => {
    termRows = process.stdout.rows || 24;
    currentInputRows = 1; // force scroll region recalc on next render
    renderInputLine();
  });

  let shouldExit = false;

  function cleanup(): void {
    shouldExit = true;
    stopSpinner();
    stopThinking();
    if (abortController) abortController.abort();
    teardownLayout();
    stdin.setRawMode(false);
    stdin.pause();
    console.log(chalk.dim("Session saved. Goodbye!"));
    process.exit(0);
  }

  stdin.on("data", (data: string) => {
    for (let i = 0; i < data.length; i++) {
      const ch = data[i]!;
      const code = ch.charCodeAt(0);

      // Ctrl+C — exit
      if (code === 3) {
        cleanup();
        return;
      }

      // Ctrl+D — exit
      if (code === 4) {
        cleanup();
        return;
      }

      // Escape key or escape sequences (arrow keys)
      if (code === 27) {
        if (i + 1 < data.length && data[i + 1] === "[") {
          // ANSI escape sequence
          i += 2;
          if (i < data.length) {
            const seq = data[i];
            if (seq === "C" && cursorPos < inputBuffer.length) {
              cursorPos++;
              renderInput();
            } else if (seq === "D" && cursorPos > 0) {
              cursorPos--;
              renderInput();
            } else if (seq === "H") {
              cursorPos = 0;
              renderInput();
            } else if (seq === "F") {
              cursorPos = inputBuffer.length;
              renderInput();
            }
            // Ignore up/down (A/B) — no history yet
          }
          continue;
        }

        // Plain Escape — abort current generation
        if (state === "streaming" || state === "processing") {
          if (abortController) {
            abortController.abort();
          }
        }
        continue;
      }

      // Enter — submit
      if (code === 13) {
        const text = inputBuffer;
        inputBuffer = "";
        cursorPos = 0;
        handleSubmit(text);
        continue;
      }

      // Backspace (127 on macOS, 8 on some systems)
      if (code === 127 || code === 8) {
        if (cursorPos > 0) {
          inputBuffer = inputBuffer.slice(0, cursorPos - 1) + inputBuffer.slice(cursorPos);
          cursorPos--;
          renderInput();
        }
        continue;
      }

      // Ctrl+A — beginning of line
      if (code === 1) {
        cursorPos = 0;
        renderInput();
        continue;
      }

      // Ctrl+E — end of line
      if (code === 5) {
        cursorPos = inputBuffer.length;
        renderInput();
        continue;
      }

      // Ctrl+U — clear line
      if (code === 21) {
        inputBuffer = "";
        cursorPos = 0;
        renderInput();
        continue;
      }

      // Ctrl+W — delete word backward
      if (code === 23) {
        if (cursorPos > 0) {
          const before = inputBuffer.slice(0, cursorPos);
          const after = inputBuffer.slice(cursorPos);
          const trimmed = before.replace(/\S+\s*$/, "");
          inputBuffer = trimmed + after;
          cursorPos = trimmed.length;
          renderInput();
        }
        continue;
      }

      // Tab — ignore
      if (code === 9) continue;

      // Regular printable character
      if (code >= 32) {
        inputBuffer = inputBuffer.slice(0, cursorPos) + ch + inputBuffer.slice(cursorPos);
        cursorPos++;
        renderInput();
      }
    }
  });

  // Keep the process alive until exit
  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (shouldExit) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
}
