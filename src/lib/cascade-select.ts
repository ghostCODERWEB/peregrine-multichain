/** The wallet the Cascade explorer opens on: the first that survives FDR, else the first listed. */
export const firstSelected = (nodes: Array<{ wallet: string; q: boolean }>): string | null => (nodes.find((n) => n.q) ?? nodes[0])?.wallet ?? null;
