import { describe, it, expect } from 'vitest';
import { failFrom, cookie } from './http';
import { UserInputError } from '@/server/errors';
import { DailyBudgetExhausted } from '@/server/site';

describe('failFrom', () => {
  it('maps who is at fault to the status', async () => {
    const user = failFrom(new UserInputError('That is not a wallet address.'));
    expect(user.status).toBe(422);
    expect(await user.json()).toEqual({ error: 'That is not a wallet address.' });
    const budget = failFrom(new DailyBudgetExhausted(1000));
    expect(budget.status).toBe(503);
    expect(budget.headers.get('retry-after')).toBe('3600');
    expect(failFrom(new Error('Nansen 500')).status).toBe(502);
  });
});

describe('cookie', () => {
  const req = (url: string, h: Record<string, string> = {}) => new Request(url, { headers: h });
  it('is Secure behind a TLS-terminating proxy, and clears with Max-Age=0', () => {
    expect(cookie(req('http://app.internal/x', { 'x-forwarded-proto': 'https' }), 's', 'v', 60)).toBe('s=v; Path=/; HttpOnly; SameSite=Lax; Max-Age=60; Secure');
    expect(cookie(req('http://localhost/x'), 's', '', 0)).toBe('s=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  });
});
