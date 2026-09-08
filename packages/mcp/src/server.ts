import { TOOLS, McpToolDefinition } from "./tools/index.js";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

const MUTATING_TOOLS: Record<string, true> = {
  submit_product: true,
  cast_vote: true,
  upload_media: true,
  create_checkout: true,
  create_api_key: true,
  revoke_api_key: true
};

export class McpServer {
  private readonly tools: Map<string, McpToolDefinition> = new Map();

  constructor() {
    for (const tool of TOOLS) {
      this.tools.set(tool.name, tool);
    }
  }

  public getTool(name: string): McpToolDefinition | undefined {
    return this.tools.get(name);
  }

  public listTools(): McpToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public async handleMessage(
    rawMessage: unknown,
    context?: { workerAuth?: boolean; env?: { NLB_API_KEY?: string; NLB_API_URL?: string } }
  ): Promise<JsonRpcResponse | null> {
    if (typeof rawMessage !== "object" || rawMessage === null) {
      return {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid Request: Payload must be a JSON object" }
      };
    }

    const req = rawMessage as Partial<JsonRpcRequest>;
    const id = req.id !== undefined ? req.id : null;

    if (req.jsonrpc !== "2.0") {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32600, message: "Invalid Request: 'jsonrpc' must be exactly '2.0'" }
      };
    }

    if (!req.method || typeof req.method !== "string") {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32600, message: "Invalid Request: Missing or invalid 'method'" }
      };
    }

    const isNotification = req.id === undefined;

    switch (req.method) {
      case "initialize": {
        const result = {
          protocolVersion: "2024-11-05",
          serverInfo: {
            name: "nlb-directory-mcp",
            version: "0.1.0"
          },
          capabilities: {
            tools: {
              listChanged: false
            }
          }
        };
        return isNotification ? null : { jsonrpc: "2.0", id, result };
      }

      case "notifications/initialized":
      case "initialized": {
        return null;
      }

      case "ping": {
        return isNotification ? null : { jsonrpc: "2.0", id, result: {} };
      }

      case "tools/list": {
        const toolsList = Array.from(this.tools.values()).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema
        }));
        return isNotification ? null : { jsonrpc: "2.0", id, result: { tools: toolsList } };
      }

      case "tools/call": {
        const params = req.params;
        if (!params || typeof params !== "object") {
          return isNotification
            ? null
            : {
                jsonrpc: "2.0",
                id,
                error: { code: -32602, message: "Invalid params: 'params' must be an object" }
              };
        }

        const toolName = typeof params.name === "string" ? params.name : "";
        const toolArgs = typeof params.arguments === "object" && params.arguments !== null ? (params.arguments as Record<string, unknown>) : {};

        const tool = this.tools.get(toolName);
        if (!tool) {
          return isNotification
            ? null
            : {
                jsonrpc: "2.0",
                id,
                error: { code: -32601, message: `Tool not found: ${toolName}` }
              };
        }
        if (context && context.workerAuth !== true && MUTATING_TOOLS[toolName]) {
          return isNotification
            ? null
            : {
                jsonrpc: "2.0",
                id,
                error: {
                  code: -32001,
                  message: `Unauthorized: Tool '${toolName}' performs remote mutation and requires a valid Worker authorization token.`
                }
              };
        }

        try {
          const output = await tool.handler(toolArgs, context);
          return isNotification
            ? null
            : {
                jsonrpc: "2.0",
                id,
                result: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify(output, null, 2)
                    }
                  ],
                  isError: false
                }
              };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          return isNotification
            ? null
            : {
                jsonrpc: "2.0",
                id,
                result: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({ error: errorMessage }, null, 2)
                    }
                  ],
                  isError: true
                }
              };
        }
      }

      default: {
        return isNotification
          ? null
          : {
              jsonrpc: "2.0",
              id,
              error: { code: -32601, message: `Method not found: ${req.method}` }
            };
      }
    }
  }
}
