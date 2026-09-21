import { duplicateKey } from "../core/batch";
import type { Guia } from "../core/types";
import type { VerificationRecord } from "../infra/store";
import { diaEmSaoPaulo, hojeEmSaoPaulo } from "../infra/relogio";

export type Periodo = { inicio: string; fim: string };

export type RelatorioPeriodo = {
  inicio: string;
  fim: string;
  verificadas: number;
  ok: number;
  pendentes: number;
  valor_em_risco: number;
  glosa_evitada: number;
  por_codigo: Record<string, number>;
  por_unidade: Record<string, number>;
  por_convenio: Record<string, number>;
};

export function periodoFromParams(inicio: string | null, fim: string | null, hoje = hojeEmSaoPaulo()): Periodo {
  const start = inicio || fim || hoje;
  const end = fim || inicio || hoje;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) throw new Error("PERIODO_INVALIDO");
  return { inicio: start, fim: end };
}

export function calcularRelatorioPeriodo(records: VerificationRecord[], guides: Map<string, Guia>, periodo: Periodo): RelatorioPeriodo {
  const grouped = new Map<string, VerificationRecord[]>();
  for (const record of records) grouped.set(record.id_guia, [...(grouped.get(record.id_guia) ?? []), record]);
  for (const values of grouped.values()) values.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.loadId.localeCompare(b.loadId));

  const inPeriod = (record: VerificationRecord) => {
    const day = diaEmSaoPaulo(record.createdAt);
    return day >= periodo.inicio && day <= periodo.fim;
  };
  const snapshot = [...grouped.values()].map((values) => values.filter((record) => diaEmSaoPaulo(record.createdAt) <= periodo.fim).at(-1)).filter((record): record is VerificationRecord => Boolean(record));
  const periodRecords = records.filter(inPeriod);
  const latestInPeriod = new Map<string, VerificationRecord>();
  for (const record of periodRecords) latestInPeriod.set(record.id_guia, record);
  const pending = snapshot.filter((record) => record.status === "PENDENTE");

  const riskKeys = new Set<string>();
  const valorEmRisco = pending.reduce((total, record) => {
    const guide = guides.get(record.id_guia);
    const key = guide ? duplicateKey(guide) : record.id_guia;
    if (riskKeys.has(key)) return total;
    riskKeys.add(key);
    return total + (record.valor ?? 0);
  }, 0);

  const avoidedKeys = new Set<string>();
  let glosaEvitada = 0;
  for (const [id, values] of grouped) {
    let open: VerificationRecord | undefined;
    for (const record of values) {
      if (record.status === "PENDENTE") {
        open ??= record;
        continue;
      }
      if (record.status !== "OK" || !open || !inPeriod(record)) continue;
      const guide = guides.get(id);
      const key = `${id}:${open.createdAt}:${guide ? duplicateKey(guide) : ""}`;
      if (!avoidedKeys.has(key)) {
        avoidedKeys.add(key);
        glosaEvitada += open.valor ?? 0;
      }
      open = undefined;
    }
  }

  return {
    inicio: periodo.inicio,
    fim: periodo.fim,
    verificadas: latestInPeriod.size,
    ok: [...latestInPeriod.values()].filter((record) => record.status === "OK").length,
    pendentes: pending.length,
    valor_em_risco: valorEmRisco,
    glosa_evitada: glosaEvitada,
    por_codigo: countReasons(pending),
    por_unidade: countGuides(pending, (id) => guides.get(id)?.unidade ?? "Desconhecida"),
    por_convenio: countGuides(pending, (id) => guides.get(id)?.convenio ?? "Desconhecido"),
  };
}

function countReasons(records: VerificationRecord[]) {
  return Object.fromEntries(records.flatMap((record) => record.motivos.map((reason) => reason.codigo)).reduce((counts, code) => counts.set(code, (counts.get(code) ?? 0) + 1), new Map<string, number>()));
}

function countGuides(records: VerificationRecord[], key: (id: string) => string) {
  return Object.fromEntries(records.reduce((counts, record) => counts.set(key(record.id_guia), (counts.get(key(record.id_guia)) ?? 0) + 1), new Map<string, number>()));
}
