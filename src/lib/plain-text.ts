/**
 * Nansen's agent sometimes answers in markdown despite "plain text" in the
 * prompt, and invents links (seen live: token-god-mode URLs with a symbol
 * where the address belongs). The anchor card renders text verbatim, so
 * keep link labels, drop URLs and emphasis markers, and tidy the spacing.
 */
export function plainAnchorText(s: string): string {
  return s
    .replace(/\[([^\]\n]+)\]\((?:https?:\/\/|www\.)[^)\s]*\)/g, '$1')
    .replace(/\s*\([^()\n]*https?:\/\/[^()\n]*\)/g, '')
    .replace(/\s*\(?https?:\/\/[^\s)]*[^\s).,;:!?]\)?/g, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,;:!?])/g, '$1');
}
