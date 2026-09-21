import { duplicateKey } from "./batch";
import type { Guia, Resultado } from "./types";

export function riskValue(results: Resultado[], guides: Map<string, Guia>): number {
  const counted = new Set<string>();
  return results.filter((result) => result.status === "PENDENTE").reduce((total, result) => {
    const guide = guides.get(result.id_guia);
    if (!guide) return total + (result.valor ?? 0);
    const key = duplicateKey(guide);
    if (counted.has(key)) return total;
    counted.add(key);
    return total + (result.valor ?? 0);
  }, 0);
}
