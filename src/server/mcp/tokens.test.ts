import { describe, it, expect, afterEach, vi } from 'vitest';
await vi.hoisted(async () => {
  const [f, p, o] = await Promise.all([import('node:fs'), import('node:path'), import('node:os')]);
  process.env.TIDE_DB_PATH = p.join(f.mkdtempSync(p.join(o.tmpdir(), 'mcp-tok-')), 'm.db');
});
import { createToken, tokenInfo, revokeToken, contextFromMcp, tokenScope } from './tokens';
import type { RequestContext } from '@/server/context';

const owner = { mode: 'owner', user: null } as unknown as RequestContext;
const pub = { mode: 'public', user: null } as unknown as RequestContext;
const req = (auth?: string) => new Request('http://localhost/api/mcp', { headers: auth ? { authorization: auth } : {} });
const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; });

describe('personal MCP tokens', () => {
  it('needs an account, keeps one live token, and revokes it', () => {
    expect(tokenScope(pub)).toBeNull();
    expect(() => createToken(pub)).toThrow(/Sign in/);
    expect(tokenInfo(pub)).toBeNull();
    const first = createToken(owner), second = createToken(owner);
    expect(second).toMatch(/^tide_mcp_/);
    expect(contextFromMcp(req(`Bearer ${first}`))).toEqual({ error: expect.stringMatching(/revoked or replaced/) });
    process.env.TIDE_DISPLAY_MODE = 'private';
    expect(contextFromMcp(req(`Bearer ${second}`))).toMatchObject({ mode: 'owner' });
    expect(tokenInfo(owner)?.lastUsedAt).toEqual(expect.any(Number));
    process.env.TIDE_PUBLIC_SITE = '1';
    expect(contextFromMcp(req(`Bearer ${second}`))).toEqual({ error: expect.stringMatching(/private instance/) });
    revokeToken(owner);
    revokeToken(pub);
    expect(tokenInfo(owner)).toBeNull();
  });
  it('refuses a malformed authorization header', () => {
    expect(contextFromMcp(req('Basic abc'))).toEqual({ error: expect.stringMatching(/Unrecognised/) });
    expect(contextFromMcp(req())).not.toHaveProperty('error');
  });
});
