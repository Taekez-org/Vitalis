import { describe, expect, it } from "vitest";
import { verify } from "../src/core/verify";
import { processarObservacoes } from "../src/observacao/lote";
import type { Guia } from "../src/core/types";
import { FakeObservationReader } from "../src/observacao/leitor";
import type { ObservationContext } from "../src/observacao/contrato";

const guide = (id: string, observation: string): Guia => ({ id_guia: id, unidade: "Centro", data_atendimento: "2026-09-01", paciente: id, convenio: "Vitalcard", carteirinha: "", cid: "", procedimento_codigo: "50000470", procedimento_descricao: "Fisioterapia", numero_autorizacao: "A", autorizacao_validade: "2026-09-30", autorizacao_sessoes_limite: "10", sessao_numero_na_autorizacao: "1", profissional: "", profissional_registro: "", valor: "100", observacao_recepcao: observation, data_lancamento: "2026-09-01" });
const context: ObservationContext = { convenio: "Vitalcard", procedimento_codigo: "50000470", procedimento_descricao: "Fisioterapia", data_atendimento: "2026-09-01", autorizacao_validade: "2026-09-30", autorizacao_sessoes_limite: "10", sessao_numero_na_autorizacao: "1", resultado_deterministico: "OK", motivos_deterministicos: [], regra: "Autorizacao valida" };

describe("processamento de observacoes no lote", () => {
  it("nao chama o Groq quando desligado e preserva guias sem observacao", async () => {
    const result = verify(guide("G-1", ""), { modo: "lote", data_referencia: "2026-09-01" });
    const readings = await processarObservacoes([{ guide: guide("G-1", ""), result, context }]);
    expect(readings.get("G-1")).toBeUndefined();
  });

  it("processa observacoes sem alterar o status deterministico", async () => {
    const old = process.env.LEITOR_IA;
    process.env.LEITOR_IA = "on";
    const guideA = guide("G-1", "Paciente faltou");
    const result = verify(guideA, { modo: "lote", data_referencia: "2026-09-01" });
    const readings = await processarObservacoes([{ guide: guideA, result, context }], new FakeObservationReader({ classe: "revisar", sinais: [], motivo: "Atendimento pode nao ter acontecido." }));
    expect(result.status).toBe("PENDENTE");
    expect(readings.get("G-1")?.classe).toBe("revisar");
    process.env.LEITOR_IA = old;
  });
});
