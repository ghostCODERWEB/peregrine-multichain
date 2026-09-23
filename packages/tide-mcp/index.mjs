#!/usr/bin/env node
// TIDE as a tool for other agents (spec 6.4): a Model Context Protocol
// server over stdio with three tools. It reads TIDE's public JSON APIs
// (TIDE_URL, default http://localhost:3200), which serve TIDE's own
// Nansen-derived numbers — so an agent asking TIDE never spends Nansen
// credits. No dependencies: the MCP wire format is newline-delimited
// JSON-RPC 2.0, implemented directly below.
import { createInterface } from 'node:readline';

const TIDE = (process.env.TIDE_URL ?? 'http://localhost:3200').replace(/\/$/, '');

const TOOLS = [
  {
    name: 'tide_weather',
    description: 'Chain Pressure Index (0-100, from Nansen smart-money net flow; >65 net buying, <35 net selling) and its 24h forecast with track record. Omit chain for every chain.',
    inputSchema: { type: 'object', properties: { chain: { type: 'string', description: 'Nansen chain id, e.g. base, ethereum, solana' } } },
    path: (a) => `/api/public/forecast${a.chain ? `?chain=${encodeURIComponent(a.chain)}` : ''}`,
  },
  {
    name: 'tide_storm_score',
    description: 'Storm Score (7-day dump risk, 0-100) TIDE computed for a token, with sub-scores and confidence. Omit token for the current storm warnings across chains.',
    inputSchema: { type: 'object', properties: { chain: { type: 'string' }, token: { type: 'string', description: 'token contract address' } } },
    path: (a) => (a.token ? `/api/public/storm?chain=${encodeURIComponent(a.chain ?? '')}&token=${encodeURIComponent(a.token)}` : '/api/public/storm'),
  },
  {
    name: 'tide_rotation_fronts',
    description: 'Rotation fronts: net smart-money capital moving between chains, measured from wallets that sold risk on one chain and bought on another within 12h.',
    inputSchema: { type: 'object', properties: { hours: { type: 'number', description: 'lookback, 1-168 (default 24)' } } },
    path: (a) => `/api/public/fronts?hours=${Number(a.hours ?? 24)}`,
  },
];

const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

async function callTool(id, name, args) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return fail(id, -32602, `Unknown tool ${name}`);
  try {
    const res = await fetch(`${TIDE}${tool.path(args ?? {})}`, { signal: AbortSignal.timeout(20_000) });
    const text = await res.text();
    reply(id, { content: [{ type: 'text', text }], isError: !res.ok });
  } catch (e) {
    reply(id, { content: [{ type: 'text', text: `TIDE is not reachable at ${TIDE}: ${e.message}` }], isError: true });
  }
}

createInterface({ input: process.stdin }).on('line', (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return fail(null, -32700, 'Parse error'); }
  const { id, method, params } = msg;
  if (id === undefined) return; // notifications (e.g. notifications/initialized) need no reply
  switch (method) {
    case 'initialize':
      return reply(id, {
        protocolVersion: params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'tide-mcp', version: '0.1.0' },
        instructions: 'TIDE: a smart-money weather map built only on Nansen data. Numbers are probabilistic readings, not financial advice.',
      });
    case 'ping':
      return reply(id, {});
    case 'tools/list':
      return reply(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call':
      return void callTool(id, params?.name, params?.arguments);
    default:
      return fail(id, -32601, `Method not found: ${method}`);
  }
});
