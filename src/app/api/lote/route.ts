import { parseGuides, verifyBatch } from "../../../core/batch";
import { saveLoad } from "../../../infra/store";
import { createHash } from "node:crypto";
import { riskValue } from "../../../core/metrics";
import { hojeEmSaoPaulo } from "../../../infra/relogio";
import { parseDate } from "../../../core/dates";
import { productionDatabaseUnavailable } from "../../../infra/supabase";
import { normalizeAgreement, procedureByCode } from "../../../core/rules";
import { contextFromGuide } from "../../../observacao/contrato";
import { processarObservacoes } from "../../../observacao/lote";
import { leitorIaLigado } from "../../../observacao/config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (productionDatabaseUnavailable()) return Response.json({ erro: "BANCO_NAO_CONFIGURADO", mensagem: "O banco de dados não está configurado para este ambiente." }, { status: 503 });
    const ref = new URL(request.url).searchParams.get("ref");
    const dataReferencia = ref ? parseDate(ref).date : hojeEmSaoPaulo();
    if (!dataReferencia) return Response.json({ erro: "PARAMETRO_INVALIDO", mensagem: "A data de referência deve estar no formato AAAA-MM-DD." }, { status: 400 });
    const body = await request.text();
    if (body.length > 1024 * 1024) return Response.json({ erro: "ARQUIVO_GRANDE" }, { status: 413 });
    const parsedGuides = parseGuides(body);
    const results = verifyBatch(parsedGuides, { modo: "lote", data_referencia: dataReferencia });
    const observationResults = await processarObservacoes(parsedGuides.map((guide, index) => ({ guide, result: results[index]!, context: contextFromGuide(guide, results[index]!, observationRule(guide)) })));
    const enrichedResults = leitorIaLigado() ? results.map((result) => ({ ...result, ...(observationResults.get(result.id_guia) ? { observacao: observationResults.get(result.id_guia) } : {}) })) : results;
    const saved = await saveLoad(request.headers.get("x-file-name") ?? "upload.csv", createHash("sha256").update(body).digest("hex"), parsedGuides, enrichedResults);
    const guidesById = new Map(guidesForRisk(parsedGuides));
    return Response.json({ loadId: saved.loadId, ja_carregado: saved.jaExistia, resultados: enrichedResults, resumo: { verificadas: enrichedResults.length, ok: enrichedResults.filter((item) => item.status === "OK").length, pendentes: enrichedResults.filter((item) => item.status === "PENDENTE").length, valor_em_risco: riskValue(enrichedResults, guidesById), data_referencia: dataReferencia, origem_data_referencia: ref ? "informada" : "padrao_hoje" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV_INVALIDO";
    if (message === "BANCO_INDISPONIVEL") return Response.json({ erro: "BANCO_INDISPONIVEL", mensagem: "Não foi possível salvar a carga no banco de dados." }, { status: 503 });
    return Response.json({ erro: message.startsWith("COLUNAS_AUSENTES") ? message : "CSV_INVALIDO" }, { status: 400 });
  }
}

function guidesForRisk(guides: ReturnType<typeof parseGuides>) {
  return guides.map((guide) => [guide.id_guia, guide] as const);
}

function observationRule(guide: ReturnType<typeof parseGuides>[number]): string {
  const agreement = normalizeAgreement(guide.convenio);
  const procedure = procedureByCode(guide.procedimento_codigo);
  return [agreement?.observacao, procedure ? `Procedimento esperado: ${procedure.descricao}.` : "Procedimento nao encontrado nas regras."] .filter(Boolean).join(" ") || "Regra aplicavel nao encontrada.";
}
