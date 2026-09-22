import { duplicateKey } from "../core/batch";
import type { Guia } from "../core/types";
import type { VerificationRecord } from "../infra/store";
import type { Treatment, TreatmentEvent } from "../infra/store";
import { diaEmSaoPaulo, hojeEmSaoPaulo } from "../infra/relogio";
import { riskValue } from "../core/metrics";
import { eGlosaNaoRecuperavel } from "./classificacao-pendencia";

export type Periodo = { inicio: string; fim: string };

export type RelatorioPeriodo = {
  inicio: string;
  fim: string;
  verificadas: number;
  ok: number;
  pendentes: number;
  valor_em_risco: number;
  glosa_evitada: number;
  aguardando_reverificacao: number;
  por_codigo: Record<string, number>;
  por_unidade: Record<string, number>;
  por_convenio: Record<string, number>;
  risco_por_convenio?: Record<string, number>;
  glosa_nao_recuperavel: number;
};

export function periodoFromParams(inicio: string | null, fim: string | null, hoje = hojeEmSaoPaulo()): Periodo {
  const start = inicio || fim || hoje;
  const end = fim || inicio || hoje;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) throw new Error("PERIODO_INVALIDO");
  return { inicio: start, fim: end };
}

export function calcularRelatorioPeriodo(records: VerificationRecord[], guides: Map<string, Guia>, periodo: Periodo, treatments?: Map<string, Treatment>, treatmentEvents: TreatmentEvent[] = []): RelatorioPeriodo {
  const grouped = new Map<string, VerificationRecord[]>();
  for (const record of records) grouped.set(record.id_guia, [...(grouped.get(record.id_guia) ?? []), record]);
  for (const values of grouped.values()) values.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.loadId.localeCompare(b.loadId));

  const inPeriod = (record: VerificationRecord) => {
    const day = diaEmSaoPaulo(record.createdAt);
    return day >= periodo.inicio && day <= periodo.fim;
  };
  const snapshot = [...grouped.values()].map((values) => values.filter((record) => diaEmSaoPaulo(record.createdAt) <= periodo.fim).at(-1)).filter((record): record is VerificationRecord => Boolean(record));
  const periodRecords = records.filter(inPeriod).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.loadId.localeCompare(b.loadId));
  const latestInPeriod = new Map<string, VerificationRecord>();
  for (const record of periodRecords) latestInPeriod.set(record.id_guia, record);
  const pending = snapshot.filter((record) => record.status === "PENDENTE");

  const valorEmRisco = riskValue(pending, guides);

  let glosaEvitada = 0;
  const byExposureKey = new Map<string, VerificationRecord[]>();
  for (const values of grouped.values()) {
    for (const record of values) {
      const guide = guides.get(record.id_guia);
      const key = guide ? duplicateKey(guide) : record.id_guia;
      byExposureKey.set(key, [...(byExposureKey.get(key) ?? []), record]);
    }
  }
  for (const values of byExposureKey.values()) {
    values.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.loadId.localeCompare(b.loadId));
    const open = new Map<string, VerificationRecord>();
    for (const record of values) {
      if (record.status === "PENDENTE") {
        open.set(record.id_guia, record);
        continue;
      }
      if (record.status !== "OK" || !inPeriod(record)) continue;
      open.delete(record.id_guia);
    }
    const latest = values.at(-1);
    if (latest?.status === "OK" && inPeriod(latest) && !open.size) {
      const pendingHistory = values.filter((record) => record.status === "PENDENTE");
      if (pendingHistory.length) glosaEvitada += riskValue(pendingHistory, guides);
    }
  }

  return {
    inicio: periodo.inicio,
    fim: periodo.fim,
     verificadas: latestInPeriod.size,
     ok: [...latestInPeriod.values()].filter((record) => record.status === "OK").length,
     pendentes: pending.length,
     valor_em_risco: valorEmRisco,
       glosa_nao_recuperavel: riskValue(pending.filter((record) => record.motivos.some((reason) => eGlosaNaoRecuperavel(reason.codigo))), guides),
     glosa_evitada: glosaEvitada,
     aguardando_reverificacao: countAwaitingAtEnd(treatments, treatmentEvents, periodo.fim),
     por_codigo: countReasons(pending),
     por_unidade: countGuides(pending, (id) => guides.get(id)?.unidade ?? "Desconhecida"),
     por_convenio: countGuides(pending, (id) => guides.get(id)?.convenio ?? "Desconhecido"),
     risco_por_convenio: countRisk(pending, guides),
  };
}

function countAwaitingAtEnd(treatments: Map<string, Treatment> | undefined, events: TreatmentEvent[], end: string) {
  if (!treatments) return 0;
  return [...treatments.keys()].filter((id) => {
    const history = events.filter((event) => event.id_guia === id && diaEmSaoPaulo(event.createdAt) <= end).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const lastEvent = history.at(-1);
    const treatment = treatments.get(id);
    const status = lastEvent?.newStatus ?? (treatment && diaEmSaoPaulo(treatment.markedAt) <= end ? treatment.status : undefined);
    return status === "AGUARDANDO_REVERIFICACAO";
  }).length;
}

function countReasons(records: VerificationRecord[]) {
  return Object.fromEntries(records.flatMap((record) => record.motivos.map((reason) => reason.codigo)).reduce((counts, code) => counts.set(code, (counts.get(code) ?? 0) + 1), new Map<string, number>()));
}

function countGuides(records: VerificationRecord[], key: (id: string) => string) {
  return Object.fromEntries(records.reduce((counts, record) => counts.set(key(record.id_guia), (counts.get(key(record.id_guia)) ?? 0) + 1), new Map<string, number>()));
}

function countRisk(records: VerificationRecord[], guides: Map<string, Guia>) {
  const grouped = new Map<string, VerificationRecord[]>();
  for (const record of records) {
    const convenio = guides.get(record.id_guia)?.convenio ?? "Desconhecido";
    grouped.set(convenio, [...(grouped.get(convenio) ?? []), record]);
  }
  return Object.fromEntries([...grouped.entries()].map(([convenio, values]) => [convenio, riskValue(values, guides)]));
}
