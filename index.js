import { createServer } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

const API_BASE_URL = "https://port-0-kbk-back-mk244bs3a55fe891.sel3.cloudtype.app";

function createSettlementServer() {
  const server = new Server(
    {
      name: 'settlement-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'add_settlement',
          description: '정산 데이터를 데이터베이스에 추가합니다.',
          inputSchema: {
            type: 'object',
            properties: {
              deposit_scheduled_amount: { type: 'number', description: '입금예정정산액' },
              store_id: { type: 'string', description: '상점아이디' },
              settlement_date: { type: 'string', format: 'date', description: '정산일 (YYYY-MM-DD)' },
              settlement_deposit_date: { type: 'string', format: 'date', description: '정산액 입금일 (YYYY-MM-DD)' },
              settlement_limit: { type: 'number', description: '정산 한도' },
              remaining_settlement_limit: { type: 'number', description: '남은 정산한도' },
              daily_settlement_amount: { type: 'number', description: '당일 정산액' },
              unpaid_settlement_amount: { type: 'number', description: '미입금 정산액' },
              scheduled_deposit_amount: { type: 'number', description: '입금 예정 정산액' },
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
          }
        },
        {
          name: 'get_settlements',
          description: '모든 정산 데이터를 조회합니다.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'add_settlement') {
        const response = await axios.post(`${API_BASE_URL}/api/settlements`, args);
        return {
          content: [
            {
              type: 'text',
              text: `정산 데이터가 성공적으로 추가되었습니다. ID: ${response.data.id}`
            }
          ]
        };
      } else if (name === 'get_settlements') {
        const response = await axios.get(`${API_BASE_URL}/api/settlements`);
        return {
          content: [
            {
              type: 'text',
              text: `정산 데이터 목록:\n${JSON.stringify(response.data, null, 2)}`
            }
          ]
        };
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `오류 발생: ${error.message}`
          }
        ],
        isError: true
      };
    }
  });

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
