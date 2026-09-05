import type { MyTechnology, TaxonomyEdgeInput } from "./types.js";

export interface CoverageResult {
  score: number;
  via: string | null;
}

/**
 * Single-hop graph expansion (PLAN.md's "required technologies resolve
 * through the alias table and then the implies/adjacent graph, so NestJS
 * covers 'Node.js'"). Deliberately not multi-hop: a two-hop transitive
 * chain (A implies B implies C) compounds two already-lossy weights into a
 * number nobody can sanity-check by reading the seed edges, and PLAN.md's
 * own edge list is authored as direct pairs, not chains meant to be walked
 * transitively.
 */
export function coverageFor(
  requiredName: string,
  myTechnologies: readonly MyTechnology[],
  edges: readonly TaxonomyEdgeInput[],
): CoverageResult {
  const exact = myTechnologies.find((t) => t.name === requiredName);
  if (exact) {
    return { score: exact.compositeScore, via: exact.name };
  }

  let best = 0;
  let bestVia: string | null = null;
  for (const myTech of myTechnologies) {
    const edge = edges.find((e) => e.from === myTech.name && e.to === requiredName);
    if (!edge) continue;
    const credit = myTech.compositeScore * edge.weight;
    if (credit > best) {
      best = credit;
      bestVia = myTech.name;
    }
  }
  return { score: best, via: bestVia };
}
