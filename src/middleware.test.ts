import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, sameOrigin, allow } from './middleware';
import { clientId as visitor } from '@/server/rate';

const req = (path: string, headers: Record<string, string> = {}, method = 'GET') =>
  new NextRequest(`https://peregrine.invalid${path}`, { headers, method });
const SAME = { 'sec-fetch-site': 'same-origin', 'x-forwarded-for': '203.0.113.9' };

afterEach(() => { delete process.env.TIDE_PUBLIC_SITE; });

describe('same-origin check', () => {
  it('trusts fetch metadata from browsers', () => {
    expect(sameOrigin(req('/api/weather', { 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(sameOrigin(req('/api/weather', { 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(sameOrigin(req('/api/weather', { 'sec-fetch-site': 'none' }))).toBe(false); // typed into the address bar
  });
  it('without metadata, needs an Origin or Referer on this host', () => {
    expect(sameOrigin(req('/api/weather'))).toBe(false);
    expect(sameOrigin(req('/api/weather', { origin: 'https://peregrine.invalid' }))).toBe(true);
    expect(sameOrigin(req('/api/weather', { referer: 'https://evil.invalid/page' }))).toBe(false);
  });
});

describe('rate limit', () => {
  it('allows max hits per window, then refuses until the window resets', () => {
    const t = 1_000;
    expect([1, 2, 3].map(() => allow('t:a', 2, 60_000, t))).toEqual([true, true, false]);
    expect(allow('t:b', 2, 60_000, t)).toBe(true); // another visitor
    expect(allow('t:a', 2, 60_000, t + 60_000)).toBe(true);
  });
});

describe('public-site middleware', () => {
  it('applies no access rules unless TIDE_PUBLIC_SITE=1, but always sends security headers', () => {
    const res = middleware(req('/api/public/storm'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('strict-transport-security')).toContain('max-age=');
  });

  it('closes machine interfaces that could spend the key', () => {
    process.env.TIDE_PUBLIC_SITE = '1';
    for (const p of ['/api/public/storm', '/api/mcp', '/api/mcp/token', '/api/x402/call', '/api/auth/challenge', '/api/keys', '/api/trade', '/api/alerts', '/api/agent', '/api/wallet/labels'])
      expect(middleware(req(p, SAME)).status, p).toBe(404);
  });

  it('serves the site’s own API calls only, and keeps the brief read-only', () => {
    process.env.TIDE_PUBLIC_SITE = '1';
    expect(middleware(req('/api/weather', SAME)).status).toBe(200);
    expect(middleware(req('/api/weather', { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect(middleware(req('/api/weather')).status).toBe(403); // curl without headers
    expect(middleware(req('/api/anchor?kind=bulletin', SAME)).status).toBe(200);
    expect(middleware(req('/api/anchor?kind=bulletin', SAME, 'POST')).status).toBe(403);
  });

  it('rate-limits API calls and heavy pages per visitor; in-app fetches get their own larger bucket', () => {
    process.env.TIDE_PUBLIC_SITE = '1';
    const api = { 'sec-fetch-site': 'same-origin', 'x-forwarded-for': '198.51.100.1' };
    const codes = Array.from({ length: 301 }, () => middleware(req('/api/search?q=eth', api)).status);
    expect(codes.slice(0, 300).every((c) => c === 200)).toBe(true);
    expect(codes[300]).toBe(429);
    const page = { 'x-forwarded-for': '198.51.100.2' };
    const pages = Array.from({ length: 61 }, () => middleware(req('/token/base/0xabc', page)).status);
    expect(pages[59]).toBe(200);
    expect(pages[60]).toBe(429);
    const nav = { ...page, 'sec-fetch-dest': 'empty' };
    const navs = Array.from({ length: 601 }, () => middleware(req('/chain/base', nav)).status);
    expect(navs[599]).toBe(200);
    expect(navs[600]).toBe(429);
    expect(middleware(req('/', page)).status).toBe(200); // light pages are not limited
  });

  it('redirects account and owner-only pages home and sets security headers', () => {
    process.env.TIDE_PUBLIC_SITE = '1';
    for (const p of ['/smart-money', '/agent', '/alerts', '/trade'])
      expect(middleware(req(p)).headers.get('location'), p).toBe('https://peregrine.invalid/');
    expect(middleware(req('/flows')).status).toBe(200); // public: measured net-flow map
    expect(middleware(req('/trades')).status).toBe(200); // prefix only on a path boundary
    const r = middleware(req('/account'));
    expect(r.status).toBe(307);
    expect(r.headers.get('location')).toBe('https://peregrine.invalid/');
    const h = middleware(req('/')).headers;
    expect(h.get('x-frame-options')).toBe('DENY');
    expect(h.get('content-security-policy')).toContain("connect-src 'self'");
    expect(h.get('content-security-policy')).toContain("frame-ancestors 'none'");
  });
});

describe('visitor', () => {
  const req = (h: Record<string, string>) => ({ headers: new Headers(h) });
  it('reads the address the trusted proxy appended, not the client-supplied left end', () => {
    expect(visitor(req({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }))).toBe('203.0.113.9');
    expect(visitor(req({ 'x-forwarded-for': '6.6.6.6, 198.51.100.4, 10.0.0.2' }), 2)).toBe('198.51.100.4');
  });
  it('falls back to X-Real-IP, then a shared bucket', () => {
    expect(visitor(req({ 'x-real-ip': '192.0.2.1' }))).toBe('192.0.2.1');
    expect(visitor(req({}))).toBe('direct');
  });
  it('ignores a nonsensical hop count', () => {
    expect(visitor(req({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }), 0)).toBe('203.0.113.9');
  });
});

describe('health check', () => {
  it('answers the platform probe on a public site without an Origin', () => {
    process.env.TIDE_PUBLIC_SITE = '1';
    const res = middleware(req('/api/health'));
    expect(res.status).toBe(200);
  });
});
