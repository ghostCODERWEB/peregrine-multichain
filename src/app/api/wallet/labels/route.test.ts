import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ mode: 'public', validated: vi.fn(), audit: vi.fn() }));
vi.mock('@/server/context', () => ({ contextFromRequest: () => ({ mode: state.mode, user: null }), contextScope: { run: (_: unknown, f: () => unknown) => f() } }));
vi.mock('@/server/portfolio/portfolio', () => ({ validated: state.validated }));
vi.mock('@/server/nansen/db', () => ({ audit: state.audit }));
vi.mock('@/server/rate', () => ({ allow: () => true, clientId: () => 'test' }));
import { POST } from './route';
const body = { address: '0x1111111111111111111111111111111111111111', chain: 'all', premium: false, confirmCredits: 100 };
const request = (value = body, origin = 'http://localhost') => new Request('http://localhost/api/wallet/labels', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(value) });
beforeEach(() => { state.mode = 'public'; state.validated.mockReset(); state.audit.mockReset(); });
it('blocks public mode before any paid call or audit write', async () => {
  expect((await POST(request())).status).toBe(403);
  expect(state.validated).not.toHaveBeenCalled();
});
it('requires the exact price for premium lookup', async () => {
  state.mode = 'member';
  expect((await POST(request({ ...body, premium: true }))).status).toBe(428);
  expect(state.validated).not.toHaveBeenCalled();
});
it('rejects a cross-origin request before any paid lookup', async () => {
  state.mode = 'owner';
  expect((await POST(request(body, 'https://docs.nansen.ai'))).status).toBe(403);
  expect(state.validated).not.toHaveBeenCalled();
});
it('serves a confirmed member lookup with private caching headers', async () => {
  state.mode = 'member';
  state.validated.mockResolvedValue({ data: { data: [{ label: 'Private label' }], pagination: { is_last_page: true } }, call: { credits: 100 } });
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(state.validated).toHaveBeenCalledWith('profiler/address/labels', expect.objectContaining({ address: body.address }), expect.anything());
});
