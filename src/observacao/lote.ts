import type { Guia, Resultado } from "../core/types";
import { chaveLeitura } from "./seguranca";
import { leitorIaLigado } from "./config";
import { readObservation, type ObservationReadResult, type ObservationReader } from "./leitor";
import type { ObservationContext } from "./contrato";

export type ObservationJob = { guide: Guia; result: Resultado; context: ObservationContext };

const MAX_CONCURRENCY = 5;
const BUDGET_MS = 6000;

export async function processarObservacoes(jobs: ObservationJob[], reader?: ObservationReader): Promise<Map<string, Resultado["observacao"]>> {
  const output = new Map<string, Resultado["observacao"]>();
  const activeJobs = jobs.filter((job) => job.guide.observacao_recepcao.trim());
  for (const job of jobs.filter((item) => !item.guide.observacao_recepcao.trim())) output.set(job.guide.id_guia, undefined);
  if (!activeJobs.length) return output;
  if (!leitorIaLigado()) {
    for (const job of activeJobs) output.set(job.guide.id_guia, { origem: "desligada", classe: "desligada", sinais: [], prompt_versao: "obs-v1" });
    return output;
  }

  const started = Date.now();
  let cursor = 0;
  const inFlight = new Map<string, Promise<ObservationReadResult>>();
  const worker = async () => {
    while (true) {
      const index = cursor++;
      const job = activeJobs[index];
      if (!job) return;
      const key = chaveLeitura(job.guide.observacao_recepcao, job.context, "obs-v1", process.env.GROQ_MODEL ?? "");
      let reading = inFlight.get(key);
      if (!reading) {
        const remaining = BUDGET_MS - (Date.now() - started);
        reading = remaining <= 0 ? Promise.resolve({ source: "nao_lida", reason: "ORCAMENTO_EXCEDIDO", promptVersion: "obs-v1" }) : withTimeout(readObservation(job.guide.observacao_recepcao, job.context, reader), remaining);
        inFlight.set(key, reading);
      }
      const result = await reading;
      output.set(job.guide.id_guia, toSummary(result, key));
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, activeJobs.length) }, () => worker()));
  return output;
}

function toSummary(result: ObservationReadResult, key: string): Resultado["observacao"] {
  return {
    origem: result.source,
    classe: result.reading?.classe ?? (result.source === "desligada" ? "desligada" : "nao_lida"),
    sinais: result.reading?.sinais ?? [],
    ...(result.reading?.motivo ? { motivo: result.reading.motivo } : {}),
    ...(result.source !== "desligada" ? { chave: key } : {}),
    prompt_versao: result.promptVersion,
    ...(result.model ? { modelo: result.model } : {}),
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve({ source: "nao_lida", reason: "ORCAMENTO_EXCEDIDO", promptVersion: "obs-v1" } as T), timeoutMs))]);
}
