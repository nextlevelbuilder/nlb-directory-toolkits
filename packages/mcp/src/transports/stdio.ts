import { createInterface } from "node:readline";
import { McpServer } from "../server.js";

export function startStdioServer(): void {
  const server = new McpServer();
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on("line", async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const parsed = JSON.parse(trimmed);
      const response = await server.handleMessage(parsed);
      if (response !== null) {
        process.stdout.write(JSON.stringify(response) + "\n");
      }
    } catch (err) {
      const parseError = {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: `Parse error: ${err instanceof Error ? err.message : String(err)}`
        }
      };
      process.stdout.write(JSON.stringify(parseError) + "\n");
    }
  });

  process.on("SIGINT", () => {
    rl.close();
    process.exit(0);
  });
}
