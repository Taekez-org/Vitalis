import { describe, expect, it } from "vitest";
import { calcularRelatorioPeriodo } from "../src/servico/relatorio";
import { gerarRelatorioPdf } from "../src/servico/pdf";
import type { Guia } from "../src/core/types";
import type { VerificationRecord } from "../src/infra/store";

function guide(id_guia: string, valor: string): Guia {
  return { id_guia, unidade: "Centro", data_atendimento: "2026-09-01", paciente: id_guia, convenio: "Vitalcard", carteirinha: "", cid: "", procedimento_codigo: "50000470", procedimento_descricao: "Fisioterapia", numero_autorizacao: id_guia, autorizacao_validade: "2026-09-30", autorizacao_sessoes_limite: "10", sessao_numero_na_autorizacao: "1", profissional: "", profissional_registro: "", valor, observacao_recepcao: "", data_lancamento: "2026-09-01" };
}

function record(id_guia: string, status: "OK" | "PENDENTE", createdAt: string, valor: number): VerificationRecord {
  return { id_guia, status, modo: "lote", data_referencia: "2026-09-01", motivos: status === "PENDENTE" ? [{ codigo: "AUT_VENCIDA", tipo: "corrigir_dado", responsavel: "recepcao", origem: "regra", acao: "Corrigir" }] : [], avisos: [], valor, createdAt, loadId: `${id_guia}-${createdAt}` };
}

describe("relatorio historico", () => {
  it("conta risco no fechamento e glosa evitada na segunda verificacao", () => {
    const records = [
      record("G-1", "PENDENTE", "2026-09-01T15:00:00.000Z", 100),
      record("G-1", "OK", "2026-09-03T15:00:00.000Z", 100),
      record("G-2", "PENDENTE", "2026-09-02T15:00:00.000Z", 50),
      record("G-3", "OK", "2026-09-02T15:00:00.000Z", 200),
    ];
    const guides = new Map([["G-1", guide("G-1", "100")], ["G-2", guide("G-2", "50")], ["G-3", guide("G-3", "200")]]);
    const report = calcularRelatorioPeriodo(records, guides, { inicio: "2026-09-03", fim: "2026-09-03" });
    expect(report.verificadas).toBe(1);
    expect(report.pendentes).toBe(1);
    expect(report.valor_em_risco).toBe(50);
    expect(report.glosa_nao_recuperavel).toBe(50);
    expect(report.glosa_evitada).toBe(100);
  });

  it("gera um PDF real com o periodo e os cards financeiros", async () => {
     const report = { inicio: "2026-09-03", fim: "2026-09-03", verificadas: 1, ok: 1, pendentes: 0, valor_em_risco: 0, glosa_nao_recuperavel: 0, glosa_evitada: 100, aguardando_reverificacao: 0, por_codigo: {}, por_unidade: {}, por_convenio: {} };
    const pdf = await gerarRelatorioPdf(report, "2026-09-03T15:00:00.000Z");
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(500);
  });

  it("usa a maior exposicao do grupo e deduplica a glosa evitada", () => {
    const records = [
      record("G-1", "PENDENTE", "2026-09-01T15:00:00.000Z", 100),
      record("G-2", "PENDENTE", "2026-09-01T15:01:00.000Z", 130),
      record("G-1", "OK", "2026-09-03T15:00:00.000Z", 100),
      record("G-2", "OK", "2026-09-03T15:01:00.000Z", 130),
    ];
    const guides = new Map([guide("G-1", "100"), guide("G-2", "130")].map((item) => [item.id_guia, { ...item, paciente: "MESMO", data_atendimento: "2026-09-01" }]));
    const report = calcularRelatorioPeriodo(records, guides, { inicio: "2026-09-03", fim: "2026-09-03" });
    expect(report.valor_em_risco).toBe(0);
    expect(report.glosa_evitada).toBe(130);
  });

  it("nao contabiliza glosa evitada enquanto o grupo ainda tem pendencia", () => {
    const records = [
      record("G-1", "PENDENTE", "2026-09-01T15:00:00.000Z", 100),
      record("G-2", "PENDENTE", "2026-09-01T15:01:00.000Z", 130),
      record("G-1", "OK", "2026-09-03T15:00:00.000Z", 100),
    ];
    const guides = new Map([guide("G-1", "100"), guide("G-2", "130")].map((item) => [item.id_guia, { ...item, paciente: "MESMO", data_atendimento: "2026-09-01" }]));
    const report = calcularRelatorioPeriodo(records, guides, { inicio: "2026-09-03", fim: "2026-09-03" });
    expect(report.glosa_evitada).toBe(0);
  });

  it("usa a data do tratamento quando a marcacao antiga nao tem evento", () => {
    const treatments = new Map([["G-1", { id_guia: "G-1", status: "AGUARDANDO_REVERIFICACAO" as const, markedAt: "2026-09-02T15:00:00.000Z", markedBy: "Equipe" }]]);
    const report = calcularRelatorioPeriodo([record("G-1", "PENDENTE", "2026-09-01T15:00:00.000Z", 100)], new Map([["G-1", guide("G-1", "100")]]), { inicio: "2026-09-02", fim: "2026-09-02" }, treatments);
    expect(report.aguardando_reverificacao).toBe(1);
  });
});
