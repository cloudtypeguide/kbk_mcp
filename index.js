const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const express = require('express');
const cors = require('cors');
const axios = require('axios');

class SettlementServer {
  constructor() {
    this.server = new Server(
      {
        name: 'settlement-server',
        version: '1.0.0',
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler('tools/list', async () => {
      return {
        tools: [
          {
            name: 'add_settlement',
            description: '정산 데이터를 데이터베이스에 추가합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                deposit_scheduled_amount: {
                  type: 'number',
                  description: '입금예정정산액'
                },
                store_id: {
                  type: 'string',
                  description: '상점아이디'
                },
                settlement_date: {
                  type: 'string',
                  format: 'date',
                  description: '정산일 (YYYY-MM-DD)'
                },
                settlement_deposit_date: {
                  type: 'string',
                  format: 'date',
                  description: '정산액 입금일 (YYYY-MM-DD)'
                },
                settlement_limit: {
                  type: 'number',
                  description: '정산 한도'
                },
                remaining_settlement_limit: {
                  type: 'number',
                  description: '남은 정산한도'
                },
                daily_settlement_amount: {
                  type: 'number',
                  description: '당일 정산액'
                },
                unpaid_settlement_amount: {
                  type: 'number',
                  description: '미입금 정산액'
                },
                scheduled_deposit_amount: {
                  type: 'number',
                  description: '입금 예정 정산액'
                }
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

    // Handle tool calls
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (name === 'add_settlement') {
          const response = await axios.post('https://port-0-kbk-back-mk244bs3a55fe891.sel3.cloudtype.app/api/settlements', args);
          return {
            content: [
              {
                type: 'text',
                text: `정산 데이터가 성공적으로 추가되었습니다. ID: ${response.data.id}`
              }
            ]
          };
        } else if (name === 'get_settlements') {
          const response = await axios.get('https://port-0-kbk-back-mk244bs3a55fe891.sel3.cloudtype.app/api/settlements');
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
  }

  async run() {
    const app = express();
    app.use(cors());
    app.use(express.json());

    const transport = new SSEServerTransport('/mcp', app);
    await this.server.connect(transport);

    app.listen(3000, () => {
      console.log('Settlement MCP Server running on HTTP port 3000 with /mcp endpoint');
    });
  }
}

const server = new SettlementServer();
server.run().catch(console.error);
