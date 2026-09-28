// TIDE as an MCP server (Streamable HTTP, JSON responses, stateless).
// Point an MCP client at https://<instance>/api/mcp. Without a token it
// sees the public view; with "Authorization: Bearer tide_mcp_…" (created on
// the account page) it acts as that account, private views included.
import { contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { contextFromMcp } from '@/server/mcp/tokens';
import { TOOLS, callTool, ToolCall } from '@/server/mcp/tools';

export const dynamic = 'force-dynamic';

const PROTOCOL = '2025-06-18';
const MAX_BATCH = 20;
type Rpc = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> };
const ok = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result });
const err = (id: Rpc['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

/** Browsers may only call from this origin (DNS-rebinding guard); MCP clients send no Origin. */
function originAllowed(req: Request): boolean {
  const o = req.headers.get('origin');
  return !o || o === new URL(req.url).origin;
}

export async function POST(req: Request) {
  if (!originAllowed(req)) return Response.json(err(null, -32000, 'Origin not allowed.'), { status: 403 });
  const ctx = contextFromMcp(req);
  if ('error' in ctx) return Response.json(err(null, -32001, ctx.error), { status: 401 });
  if (!allow('mcp', ctx.user ? `u${ctx.user.id}` : clientId(req), 120)) return Response.json(err(null, -32002, 'Rate limited: 60 requests a minute.'), { status: 429 });

  const body = await req.json().catch(() => null);
  const batch = Array.isArray(body) ? body : [body];
  // A JSON-RPC batch must not multiply one request past the rate limit: batches are capped, and every
  // tool call below also counts against it.
  if (batch.length > MAX_BATCH) return Response.json(err(null, -32600, `Batches are limited to ${MAX_BATCH} messages.`), { status: 400 });
  const who = ctx.user ? `u${ctx.user.id}` : clientId(req);
  const out: unknown[] = [];
  for (const m of batch as Rpc[]) {
    if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') { out.push(err(null, -32600, 'Invalid request.')); continue; }
    const notification = m.id === undefined;
    switch (m.method) {
      case 'initialize':
        out.push(ok(m.id, {
          protocolVersion: typeof m.params?.protocolVersion === 'string' ? m.params.protocolVersion : PROTOCOL,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'tide', title: 'Peregrine · smart-money intelligence on the Nansen API', version: '1.0.0' },
          instructions: `Peregrine derives flow and risk signals from Nansen data: chain flow, dump-risk scores, alpha, perp flow, prediction flows, sectors, capital rotations and smart-money conviction. You are in the ${ctx.mode} view. For raw Nansen data use Nansen's own MCP; use Peregrine for the derived readings.`,
        }));
        break;
      case 'notifications/initialized':
      case 'notifications/cancelled':
        break;
      case 'ping':
        out.push(ok(m.id, {}));
        break;
      case 'tools/list':
        out.push(ok(m.id, { tools: TOOLS.filter((t) => !t.private || ctx.mode !== 'public').map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) }));
        break;
      case 'tools/call': {
        const p = ToolCall.safeParse(m.params);
        if (!p.success) { out.push(err(m.id, -32602, 'tools/call needs {name, arguments}.')); break; }
        if (!allow('mcp-call', who, 60)) { out.push(err(m.id, -32002, 'Rate limited: 60 tool calls a minute.')); break; }
        out.push(ok(m.id, await contextScope.run(ctx, () => callTool(ctx, p.data.name, p.data.arguments ?? {}))));
        break;
      }
      default:
        if (!notification) out.push(err(m.id, -32601, `Method not found: ${m.method}`));
    }
  }
  if (!out.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? out : out[0], { headers: { 'Cache-Control': 'no-store', 'MCP-Protocol-Version': PROTOCOL } });
}

export function GET() {
  // No server-initiated stream: every answer comes back on the POST.
  return new Response('Peregrine MCP: POST JSON-RPC here (Streamable HTTP, JSON responses).', { status: 405, headers: { Allow: 'POST' } });
}
