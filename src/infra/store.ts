import type { Guia, Motivo, Resultado } from "../core/types";
import { supabase } from "./supabase";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export type VerificationRecord = Resultado & { createdAt: string; loadId: string };
export type Treatment = { id_guia: string; status: "ABERTA" | "EM_TRATAMENTO" | "AGUARDANDO_REVERIFICACAO" | "RESOLVIDA"; markedAt: string; markedBy: string };
export type TreatmentEvent = { id_guia: string; loadId?: string; technicalStatus?: "OK" | "PENDENTE"; previousStatus?: Treatment["status"]; newStatus: Treatment["status"]; event: string; by: string; comment?: string; createdAt: string };
export type ObservationRevision = { id_guia: string; chave: string; status: "ABERTA" | "RESOLVIDA"; origem: "groq" | "nao_lida"; classe: "sinal" | "revisar" | "nao_lida"; sinais: string[]; motivo?: string; createdAt: string; resolvedAt?: string; resolvedBy?: string; comment?: string };

type LocalStore = { guides: Map<string, Guia>; verifications: VerificationRecord[]; treatments: Map<string, Treatment>; treatmentEvents: TreatmentEvent[]; observationRevisions: Map<string, ObservationRevision>; loads: { id: string; fileName: string; fileHash?: string; count: number; createdAt: string }[] };
const globalStore = globalThis as typeof globalThis & { vitalisStore?: LocalStore };

function loadLocal(): LocalStore {
  if (process.env.VITALIS_STORE_FILE === "memory") return { guides: new Map(), verifications: [], treatments: new Map(), treatmentEvents: [], observationRevisions: new Map(), loads: [] };
  const file = resolve(process.cwd(), "data/.local-store.json");
  if (!existsSync(file)) return { guides: new Map(), verifications: [], treatments: new Map(), treatmentEvents: [], observationRevisions: new Map(), loads: [] };
  try {
    const saved = JSON.parse(readFileSync(file, "utf8")) as { guides: [string, Guia][]; verifications: VerificationRecord[]; treatments: [string, Treatment][]; treatmentEvents?: TreatmentEvent[]; observationRevisions?: [string, ObservationRevision][]; loads: LocalStore["loads"] };
    return { guides: new Map(saved.guides), verifications: saved.verifications, treatments: new Map(saved.treatments), treatmentEvents: saved.treatmentEvents ?? [], observationRevisions: new Map(saved.observationRevisions ?? []), loads: saved.loads };
  } catch {
    return { guides: new Map(), verifications: [], treatments: new Map(), treatmentEvents: [], observationRevisions: new Map(), loads: [] };
  }
}

export const store = globalStore.vitalisStore ?? loadLocal();

globalStore.vitalisStore = store;

function persistLocal() {
  if (process.env.VITALIS_STORE_FILE === "memory" || supabase()) return;
  try {
  writeFileSync(resolve(process.cwd(), "data/.local-store.json"), JSON.stringify({ guides: [...store.guides.entries()], verifications: store.verifications, treatments: [...store.treatments.entries()], treatmentEvents: store.treatmentEvents, observationRevisions: [...store.observationRevisions.entries()], loads: store.loads }, null, 2), "utf8");
  } catch {
    // The local fallback is best effort; production must use Supabase.
  }
}

export function resetStore() {
  store.guides.clear();
  store.verifications.length = 0;
  store.treatments.clear();
  store.treatmentEvents.length = 0;
  store.observationRevisions.clear();
  store.loads.length = 0;
}

export type SaveLoadResult = { loadId: string; jaExistia: boolean };

export async function saveLoad(fileName: string, fileHash: string, guides: Guia[], results: Resultado[]): Promise<SaveLoadResult> {
  const database = supabase();
  if (database) {
    const result = await database.rpc("registrar_carga", { p_nome: fileName, p_hash: fileHash, p_guias: guides, p_verificacoes: results });
    if (result.error || !result.data) throw new Error("BANCO_INDISPONIVEL");
    await persistObservationRevisions(database, results);
    return { loadId: result.data.carga_id as string, jaExistia: result.data.ja_existia as boolean };
  }
  const previousLoad = store.loads.find((load) => load.fileHash === fileHash);
  if (previousLoad) return { loadId: previousLoad.id, jaExistia: true };
  const loadId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  guides.forEach((guide) => store.guides.set(guide.id_guia, guide));
    results.forEach((result) => {
      store.verifications.push({ ...result, createdAt, loadId });
      const treatment = treatmentAfterVerification(store.treatments.get(result.id_guia), result.status);
      const previousStatus = store.treatments.get(result.id_guia)?.status;
      if (treatment) store.treatments.set(result.id_guia, treatment);
      store.treatmentEvents.push({ id_guia: result.id_guia, loadId, technicalStatus: result.status, previousStatus, newStatus: result.status === "OK" ? "RESOLVIDA" : treatment?.status ?? "ABERTA", event: result.status === "OK" ? "VERIFICACAO_OK" : "PENDENCIA_IDENTIFICADA", by: "sistema", createdAt });
      saveObservationRevision(result, createdAt);
  });
  store.loads.push({ id: loadId, fileName, fileHash, count: guides.length, createdAt });
  persistLocal();
  return { loadId, jaExistia: false };
}

export async function latestResults(): Promise<VerificationRecord[]> {
  const database = supabase();
  if (database) {
    const history = await readPages((from, to) => database.from("verificacoes").select("id_guia,carga_id,status,resultado,valor,criada_em").order("criada_em").range(from, to));
    const guides = await readPages((from, to) => database.from("guias").select("id_guia,dados").range(from, to));
    const treatments = await readPages((from, to) => database.from("tratamentos").select("id_guia,situacao,marcado_por,marcada_em").range(from, to));
    const loads = await database.from("cargas").select("id,nome_arquivo,quantidade_guias,criada_em").order("criada_em").range(0, 999);
    if (loads.error) throw new Error("BANCO_INDISPONIVEL");
    store.guides.clear();
    for (const row of guides) store.guides.set(row.id_guia, row.dados as Guia);
    store.treatments.clear();
    for (const row of treatments) store.treatments.set(row.id_guia, { id_guia: row.id_guia, status: row.situacao, markedBy: row.marcado_por, markedAt: row.marcada_em });
    const revisions = await readPages((from, to) => database.from("observacao_revisoes").select("id_guia,chave,status,origem,classe,sinais,motivo,criada_em,resolvida_em,resolvida_por,comentario").order("criada_em").range(from, to));
    store.observationRevisions.clear();
    for (const row of revisions) store.observationRevisions.set(`${row.id_guia}:${row.chave}`, revisionFromRow(row));
    const events = await readPages((from, to) => database.from("tratamento_eventos").select("id_guia,carga_id,status_tecnico,status_anterior,status_novo,evento,por_quem,comentario,criado_em").order("criado_em").range(from, to));
    store.treatmentEvents.length = 0;
    for (const row of events) store.treatmentEvents.push({ id_guia: row.id_guia, loadId: row.carga_id, technicalStatus: row.status_tecnico, previousStatus: row.status_anterior, newStatus: row.status_novo, event: row.evento, by: row.por_quem, comment: row.comentario ?? undefined, createdAt: row.criado_em });
    store.verifications.length = 0;
    for (const row of history) store.verifications.push({ ...(row.resultado as Resultado), createdAt: row.criada_em, loadId: row.carga_id });
    store.loads.length = 0;
    for (const row of loads.data ?? []) store.loads.push({ id: row.id, fileName: row.nome_arquivo, count: row.quantidade_guias, createdAt: row.criada_em });
    const latest = new Map<string, VerificationRecord>();
    for (const row of history) {
      const candidate = { ...(row.resultado as Resultado), status: row.status as Resultado["status"], createdAt: row.criada_em, loadId: row.carga_id };
      const current = latest.get(row.id_guia);
      if (!current || current.createdAt < candidate.createdAt || (current.createdAt === candidate.createdAt && current.loadId < candidate.loadId)) latest.set(row.id_guia, candidate);
    }
    return [...latest.values()];
  }
  const latest = new Map<string, VerificationRecord>();
  for (const result of store.verifications) latest.set(result.id_guia, result);
  return [...latest.values()];
}

async function readPages<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const values: T[] = [];
  for (let from = 0; ; from += 1000) {
    const page = await read(from, from + 999);
    if (page.error || !page.data) throw new Error("BANCO_INDISPONIVEL");
    values.push(...page.data);
    if (page.data.length < 1000) return values;
  }
}

export function treatmentAfterVerification(treatment: Treatment | undefined, status: Resultado["status"]): Treatment | undefined {
  if (!treatment) return undefined;
  if (status === "OK") return { ...treatment, status: "RESOLVIDA" };
  if (treatment.status === "AGUARDANDO_REVERIFICACAO") return { ...treatment, status: "EM_TRATAMENTO" };
  if (treatment.status === "RESOLVIDA") return { ...treatment, status: "ABERTA" };
  return treatment;
}

export function markTreatment(id_guia: string, markedBy = "Equipe"): Treatment | undefined {
  const previous = store.treatments.get(id_guia);
  const current: Treatment = { id_guia, status: "AGUARDANDO_REVERIFICACAO", markedAt: new Date().toISOString(), markedBy };
  if (!store.guides.has(id_guia)) return undefined;
  store.treatments.set(id_guia, current);
  store.treatmentEvents.push({ id_guia, previousStatus: previous?.status, newStatus: current.status, event: "CORRECAO_MARCADA", by: markedBy, createdAt: current.markedAt });
  persistLocal();
  return current;
}

function saveObservationRevision(result: Resultado, createdAt: string) {
  const observation = result.observacao;
  if (!observation || observation.origem === "desligada" || !observation.chave || observation.classe === "rotina") return;
  const key = `${result.id_guia}:${observation.chave}`;
  const previous = store.observationRevisions.get(key);
  if (previous?.status === "RESOLVIDA") return;
  const classe = observation.origem === "nao_lida" || observation.classe === "desligada" ? "nao_lida" : observation.classe;
  store.observationRevisions.set(key, { id_guia: result.id_guia, chave: observation.chave, status: "ABERTA", origem: observation.origem, classe, sinais: observation.sinais, ...(observation.motivo ? { motivo: observation.motivo } : {}), createdAt, ...(previous?.comment ? { comment: previous.comment } : {}) });
}

function revisionFromRow(row: { id_guia: string; chave: string; status: ObservationRevision["status"]; origem: ObservationRevision["origem"]; classe: ObservationRevision["classe"]; sinais: unknown; motivo?: string | null; criada_em: string; resolvida_em?: string | null; resolvida_por?: string | null; comentario?: string | null }): ObservationRevision {
  return { id_guia: row.id_guia, chave: row.chave, status: row.status, origem: row.origem, classe: row.classe, sinais: Array.isArray(row.sinais) ? row.sinais as string[] : [], ...(row.motivo ? { motivo: row.motivo } : {}), createdAt: row.criada_em, ...(row.resolvida_em ? { resolvedAt: row.resolvida_em } : {}), ...(row.resolvida_por ? { resolvedBy: row.resolvida_por } : {}), ...(row.comentario ? { comment: row.comentario } : {}) };
}

async function persistObservationRevisions(database: NonNullable<ReturnType<typeof supabase>>, results: Resultado[]) {
  const candidates = results.filter((result) => result.observacao?.origem === "groq" || result.observacao?.origem === "nao_lida").filter((result) => result.observacao?.classe !== "rotina").filter((result) => result.observacao?.chave).map((result) => ({ id_guia: result.id_guia, chave: result.observacao!.chave!, status: "ABERTA", origem: result.observacao!.origem === "groq" ? "groq" : "nao_lida", classe: result.observacao!.classe === "revisar" || result.observacao!.classe === "sinal" ? result.observacao!.classe : "nao_lida", sinais: result.observacao!.sinais, motivo: result.observacao!.motivo ?? null }));
  if (!candidates.length) return;
  const existing = await database.from("observacao_revisoes").select("id_guia,chave,status").in("id_guia", candidates.map((candidate) => candidate.id_guia));
  if (existing.error) throw new Error("BANCO_INDISPONIVEL");
  const resolved = new Set((existing.data ?? []).filter((row) => row.status === "RESOLVIDA").map((row) => `${row.id_guia}:${row.chave}`));
  const pending = candidates.filter((candidate) => !resolved.has(`${candidate.id_guia}:${candidate.chave}`));
  if (!pending.length) return;
  const saved = await database.from("observacao_revisoes").upsert(pending, { onConflict: "id_guia,chave" });
  if (saved.error) throw new Error("BANCO_INDISPONIVEL");
}

export function listObservationRevisions(): ObservationRevision[] {
  return [...store.observationRevisions.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listObservationRevisionsAsync(): Promise<ObservationRevision[]> {
  const database = supabase();
  if (!database) return listObservationRevisions();
  const rows = await readPages((from, to) => database.from("observacao_revisoes").select("id_guia,chave,status,origem,classe,sinais,motivo,criada_em,resolvida_em,resolvida_por,comentario").order("criada_em").range(from, to));
  store.observationRevisions.clear();
  for (const row of rows) store.observationRevisions.set(`${row.id_guia}:${row.chave}`, revisionFromRow(row));
  return listObservationRevisions();
}

export function resolveObservationRevision(id_guia: string, chave: string, resolvedBy = "Equipe", comment?: string): ObservationRevision | undefined {
  const key = `${id_guia}:${chave}`;
  const current = store.observationRevisions.get(key);
  if (!current) return undefined;
  const resolved = { ...current, status: "RESOLVIDA" as const, resolvedAt: new Date().toISOString(), resolvedBy, ...(comment?.trim() ? { comment: comment.trim().slice(0, 240) } : {}) };
  store.observationRevisions.set(key, resolved);
  persistLocal();
  return resolved;
}

export async function resolveObservationRevisionAsync(id_guia: string, chave: string, resolvedBy = "Equipe", comment?: string): Promise<ObservationRevision | undefined> {
  const database = supabase();
  if (!database) return resolveObservationRevision(id_guia, chave, resolvedBy, comment);
  const current = await database.from("observacao_revisoes").select("id_guia,chave,status,origem,classe,sinais,motivo,criada_em,resolvida_em,resolvida_por,comentario").eq("id_guia", id_guia).eq("chave", chave).maybeSingle();
  if (current.error || !current.data) return undefined;
  const resolvedAt = new Date().toISOString();
  const saved = await database.from("observacao_revisoes").update({ status: "RESOLVIDA", resolvida_em: resolvedAt, resolvida_por: resolvedBy, ...(comment?.trim() ? { comentario: comment.trim().slice(0, 240) } : {}) }).eq("id_guia", id_guia).eq("chave", chave).select("id_guia,chave,status,origem,classe,sinais,motivo,criada_em,resolvida_em,resolvida_por,comentario").single();
  if (saved.error || !saved.data) throw new Error("BANCO_INDISPONIVEL");
  const revision = revisionFromRow(saved.data);
  store.observationRevisions.set(`${id_guia}:${chave}`, revision);
  return revision;
}

export async function markTreatmentAsync(id_guia: string, markedBy = "Equipe"): Promise<Treatment | undefined> {
  const database = supabase();
  if (!database) return markTreatment(id_guia, markedBy);
  const latest = await database.from("ultima_verificacao").select("status").eq("id_guia", id_guia).maybeSingle();
  if (latest.error) throw new Error("BANCO_INDISPONIVEL");
  if (!latest.data || latest.data.status === "OK") return undefined;
  const row = { id_guia, situacao: "AGUARDANDO_REVERIFICACAO", marcado_por: markedBy, marcada_em: new Date().toISOString() };
  const saved = await database.from("tratamentos").upsert(row).select("id_guia,situacao,marcado_por,marcada_em").single();
  if (saved.error || !saved.data) throw new Error("BANCO_INDISPONIVEL");
  const event = await database.from("tratamento_eventos").insert({ id_guia, status_tecnico: latest.data.status, status_anterior: store.treatments.get(id_guia)?.status ?? "ABERTA", status_novo: "AGUARDANDO_REVERIFICACAO", evento: "CORRECAO_MARCADA", por_quem: markedBy, criada_em: row.marcada_em });
  if (event.error) throw new Error("BANCO_INDISPONIVEL");
  return { id_guia: saved.data.id_guia, status: saved.data.situacao, markedBy: saved.data.marcado_por, markedAt: saved.data.marcada_em };
}

export function publicReason(reason: Motivo) {
  const detail = reason.detalhe ? Object.fromEntries(Object.entries(reason.detalhe).filter(([key]) => ["observacao_convenio", "limite_efetivo", "dias", "relacionadas"].includes(key))) : undefined;
  return { codigo: reason.codigo, tipo: reason.tipo, responsavel: reason.responsavel, campo: reason.campo, acao: reason.acao, ...(detail && Object.keys(detail).length ? { detalhe: detail } : {}) };
}
