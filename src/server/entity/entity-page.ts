// /entity/[name]: a Nansen entity (an exchange, fund, market maker…) as one
// subject. The name is resolved with the two free search endpoints first,
// so a mistyped name gets suggestions instead of four failed profiler
// calls; then the profiler sections run with entity_name instead of an
// address (Nansen aggregates every address it attributes to the entity).
import { callNansen } from '@/server/nansen/client';
import { errText } from '@/server/nansen/traced';
import type { EntityNameSearchResponse, GeneralSearchResponse } from '@/types/nansen/api.gen';

export interface EntityInfo {
  name: string;
  tags: string[];
}

export type EntityLookup =
  | { found: true; entity: EntityInfo }
  | { found: false; suggestions: string[]; error: string | null };

const same = (a: string | null | undefined, b: string) => !!a && a.trim().toLowerCase() === b.trim().toLowerCase();

export async function resolveEntity(raw: string): Promise<EntityLookup> {
  const name = raw.trim().slice(0, 120);
  try {
    const [general, names] = await Promise.all([
      callNansen<GeneralSearchResponse>('search/general', { search_query: name, result_type: 'entity', limit: 10 }),
      callNansen<EntityNameSearchResponse>('search/entity-name', { search_query: name }),
    ]);
    // Names can be null: recorded demo fixtures strip every entity_name field
    // (the fixture policy treats it as a label wherever it appears).
    const generalNames = (general.data.entities ?? []).filter((e) => !!e.name);
    const searchNames = (names.data.data ?? []).map((e) => e.entity_name).filter((n): n is string => !!n);
    const exact = generalNames.find((e) => same(e.name, name));
    const exactName = searchNames.find((n) => same(n, name));
    if (exact) return { found: true, entity: { name: exact.name, tags: exact.tags ?? [] } };
    if (exactName) return { found: true, entity: { name: exactName, tags: [] } };
    const suggestions = [...new Set([...generalNames.map((e) => e.name), ...searchNames])].slice(0, 8);
    return { found: false, suggestions, error: null };
  } catch (e) {
    return { found: false, suggestions: [], error: errText(e) };
  }
}
