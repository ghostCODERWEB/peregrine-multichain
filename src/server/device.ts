import { headers } from 'next/headers';

/** A phone, from the request itself. Pages with a phone screen and a desktop
 *  screen send a phone only its own screen, instead of both with one hidden
 *  by CSS (the hidden desktop tree doubled what a phone had to download,
 *  parse and hydrate). Tablets and anything unsure still get both. */
export async function isPhone(): Promise<boolean> {
  const h = await headers();
  if (h.get('sec-ch-ua-mobile') === '?1') return true;
  return /iPhone|iPod|Android.+Mobile|Mobi/i.test(h.get('user-agent') ?? '');
}
