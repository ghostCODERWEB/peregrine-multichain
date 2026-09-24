import { describe, it, expect } from 'vitest';
import { parseCommand, windowLabel } from './commands';

describe('⌘K commands', () => {
  it('parses slash commands with windows', () => {
    expect(parseCommand('/who-bought $AERO 6h')).toEqual({ kind: 'who', side: 'buy', token: 'AERO', hours: 6 });
    expect(parseCommand('/who-sold aero last 2 days')).toEqual({ kind: 'who', side: 'sell', token: 'aero', hours: 48 });
    expect(parseCommand('/who-bought AERO')).toMatchObject({ hours: 24 });
    expect(parseCommand('/who-bought AERO 30d')).toMatchObject({ hours: 168 }); // capped at 7 days
    expect(parseCommand('/related 0xAbC on base')).toEqual({ kind: 'related', address: '0xAbC', chain: 'base' });
    expect(parseCommand('/replay AERO 7d')).toEqual({ kind: 'replay', token: 'AERO', at: '7d' });
    expect(parseCommand('/replay AERO')).toMatchObject({ at: '24h' });
    expect(parseCommand('/desk')).toEqual({ kind: 'desk' });
    expect(parseCommand('/')).toEqual({ kind: 'help' });
  });
  it('understands the plain-English phrasings from the brief', () => {
    expect(parseCommand('who bought $TOKEN last 6h')).toEqual({ kind: 'who', side: 'buy', token: 'TOKEN', hours: 6 });
    expect(parseCommand('who is selling VIRTUAL in the last 3 hours?')).toEqual({ kind: 'who', side: 'sell', token: 'VIRTUAL', hours: 3 });
    expect(parseCommand('related wallets of 0x1234567890abcdef1234567890abcdef12345678')).toMatchObject({ kind: 'related', chain: null });
    expect(parseCommand('fade this if whales dump')).toEqual({ kind: 'alert', token: 'this' });
    expect(parseCommand('short AERO when smart money sells')).toEqual({ kind: 'alert', token: 'AERO' });
    expect(parseCommand('replay AERO 24h ago')).toMatchObject({ kind: 'replay', at: '24h' });
    expect(parseCommand('replay AERO T-1h')).toMatchObject({ kind: 'replay', at: '1h' });
    expect(parseCommand('who bought this')).toEqual({ kind: 'who', side: 'buy', token: 'this', hours: 24 });
  });
  it('leaves ordinary searches alone', () => {
    for (const q of ['aero', 'Wintermute', 'base', '0x1234567890abcdef1234567890abcdef12345678', 'who', 'related']) expect(parseCommand(q)).toBeNull();
  });
  it('labels windows', () => {
    expect(windowLabel(6)).toBe('6h');
    expect(windowLabel(48)).toBe('2d');
  });
});
