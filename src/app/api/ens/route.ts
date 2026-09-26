import { NextResponse } from 'next/server';
import { ensAddress, ensNames, ENS_NAME_RE } from '@/server/ens';

/** GET ?a=0x..,0x.. → { names: { addr: name|null } }; GET ?name=vitalik.eth → { address }. Public, cached. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const name = q.get('name');
  if (name) {
    if (!ENS_NAME_RE.test(name)) return NextResponse.json({ address: null }, { status: 400 });
    return NextResponse.json({ address: await ensAddress(name) }, { headers: { 'cache-control': 'public, max-age=3600' } });
  }
  const list = (q.get('a') ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 60);
  return NextResponse.json({ names: await ensNames(list) }, { headers: { 'cache-control': 'public, max-age=3600' } });
}
