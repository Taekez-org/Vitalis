import { duplicateKey } from "./batch";
import type { Guia, Resultado } from "./types";

export function riskValue(results: Resultado[], guides: Map<string, Guia>): number {
  const exposures = new Map<string, number>();
  for (const result of results.filter((item) => item.status === "PENDENTE")) {
    const guide = guides.get(result.id_guia);
    const key = guide ? duplicateKey(guide) : result.id_guia;
    const value = Number.isFinite(result.valor) ? Math.max(result.valor ?? 0, 0) : 0;
    exposures.set(key, Math.max(exposures.get(key) ?? 0, value));
  }
  return [...exposures.values()].reduce((total, value) => total + value, 0);
}
