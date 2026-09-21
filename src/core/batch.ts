import Papa from "papaparse";
import { parseDate } from "./dates";
import { verify } from "./verify";
import type { Contexto, Guia, Resultado } from "./types";

export const GUIDE_COLUMNS = [
  "id_guia", "unidade", "data_atendimento", "paciente", "convenio", "carteirinha", "cid",
  "procedimento_codigo", "procedimento_descricao", "numero_autorizacao", "autorizacao_validade",
  "autorizacao_sessoes_limite", "sessao_numero_na_autorizacao", "profissional", "profissional_registro",
  "valor", "observacao_recepcao", "data_lancamento",
] as const;

export function parseGuides(csv: string): Guia[] {
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true, transformHeader: (header) => header.replace(/^\uFEFF/, "").trim() });
  if (parsed.errors.length) throw new Error("CSV_INVALIDO");
  const headers = parsed.meta.fields ?? [];
  const missing = GUIDE_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length) throw new Error(`COLUNAS_AUSENTES:${missing.join(",")}`);
  return parsed.data.map((row) => Object.fromEntries(GUIDE_COLUMNS.map((column) => [column, row[column] ?? ""])) as Guia);
}

export function duplicateKey(guia: Guia): string {
  return [guia.paciente.trim(), parseDate(guia.data_atendimento).date ?? guia.data_atendimento.trim(), guia.procedimento_codigo.trim()].join("|");
}

export function verifyBatch(guides: Guia[], contexto: Contexto): Resultado[] {
  const results = guides.map((guide) => verify(guide, contexto));
  const groups = new Map<string, number[]>();
  guides.forEach((guide, index) => {
    if (!guide.data_atendimento.trim()) return;
    const key = duplicateKey(guide);
    const group = groups.get(key) ?? [];
    group.push(index);
    groups.set(key, group);
  });
  for (const indexes of groups.values()) {
    if (indexes.length < 2) continue;
    const authorizations = new Set(indexes.map((index) => guides[index]?.numero_autorizacao.trim() ?? ""));
    const code = authorizations.size === 1 && !authorizations.has("") ? "DUPLICADA" : "CONFLITO_AUTORIZACAO";
    for (const index of indexes) {
      const result = results[index];
      if (!result) continue;
      result.motivos.push({
        codigo: code,
        tipo: "alguem_decide",
        responsavel: "financeiro",
        origem: "regra",
        acao: code === "DUPLICADA" ? "Manter uma das guias e cancelar a outra." : "Decidir qual autorizacao vale para a sessao.",
        detalhe: { relacionadas: indexes.filter((other) => other !== index).map((other) => guides[other]?.id_guia).filter(Boolean) },
      });
      result.status = "PENDENTE";
    }
  }
  return results;
}
