import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import axios from "axios";

const API_BASE_URL = "https://port-0-kbk-back-mk244bs3a55fe891.sel3.cloudtype.app";

const addSettlementInputSchema = {
  type: 'object',
  properties: {
    deposit_scheduled_amount: { type: 'number' },
    store_id: { type: 'string' },
    settlement_date: { type: 'string', format: 'date' },
    settlement_deposit_date: { type: 'string', format: 'date' },
    settlement_limit: { type: 'number' },
    remaining_settlement_limit: { type: 'number' },
    daily_settlement_amount: { type: 'number' },
    unpaid_settlement_amount: { type: 'number' },
    scheduled_deposit_amount: { type: 'number' },
  },
  required: [
    'deposit_scheduled_amount',
    'store_id',
    'settlement_date',
    'settlement_deposit_date',
    'settlement_limit',
    'remaining_settlement_limit',
    'daily_settlement_amount',
    'unpaid_settlement_amount',
    'scheduled_deposit_amount'
  ]
};

function createSettlementServer() {
  const server = new McpServer({ name: "settlement-mcp", version: "1.0.0" });

  server.registerTool(
    'add_settlement',
    {
      title: '정산 데이터 추가',
      description: '정산 데이터를 데이터베이스에 추가합니다.',
      inputSchema: addSettlementInputSchema,
    },
    async (args) => {
      try {
        const response = await axios.post(`${API_BASE_URL}/api/settlements`, args);
        return {
          content: [{ type: 'text', text: `정산 데이터가 성공적으로 추가되었습니다. ID: ${response.data.id}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `정산 데이터 추가 실패: ${error.message}` }],
        };
      }
    }
  );

  server.registerTool(
    'get_settlements',
    {
      title: '정산 데이터 조회',
      description: '모든 정산 데이터를 조회합니다.',
      inputSchema: z.object({}),
    },
    async (args) => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/settlements`);
        return {
          content: [{ type: 'text', text: `정산 데이터 목록:\n${JSON.stringify(response.data, null, 2)}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `정산 데이터 조회 실패: ${error.message}` }],
        };
      }
    }
  );

  return server;
}

const port = Number(process.env.PORT ?? 3000);
const MCP_PATH = "/mcp";

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/plain" }).end("Settlement MCP server");
    return;
  }

  const MCP_METHODS = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && MCP_METHODS.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const server = createSettlementServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.writeHead(500).end("Internal server error");
      }
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`Settlement MCP server listening on http://localhost:${port}${MCP_PATH}`);
});
