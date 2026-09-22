import { describe, expect, it, vi } from "vitest";
import { FakeObservationReader, GroqObservationReader, readObservation } from "../src/observacao/leitor";
import type { ObservationContext } from "../src/observacao/contrato";

const context: ObservationContext = { convenio: "Vitalcard", procedimento_codigo: "50000470", procedimento_descricao: "Fisioterapia", data_atendimento: "2026-09-01", autorizacao_validade: "2026-09-30", autorizacao_sessoes_limite: "10", sessao_numero_na_autorizacao: "1", resultado_deterministico: "OK", motivos_deterministicos: [], regra: "Autorizacao valida" };

describe("leitor de observacao", () => {
  it("nao chama leitor quando a IA esta desligada", async () => {
    const reader = { read: vi.fn() };
    const result = await readObservation("texto", context, reader);
    expect(result.source).toBe("desligada");
    expect(reader.read).not.toHaveBeenCalled();
  });

  it("usa leitor falso somente quando a IA esta ligada", async () => {
    const old = process.env.LEITOR_IA;
    process.env.LEITOR_IA = "on";
    const reader = new FakeObservationReader({ classe: "revisar", sinais: [], motivo: "Precisa de conferencia." });
    const result = await readObservation("Paciente faltou", context, reader);
    expect(result.source).toBe("groq");
    expect(result.reading?.classe).toBe("revisar");
    process.env.LEITOR_IA = old;
  });

  it("converte resposta HTTP, JSON ou schema invalido em nao lida", async () => {
    const old = process.env.LEITOR_IA;
    const oldKey = process.env.GROQ_API_KEY;
    const oldModel = process.env.GROQ_MODEL;
    process.env.LEITOR_IA = "on";
    process.env.GROQ_API_KEY = "test-only-key";
    process.env.GROQ_MODEL = "test-only-model";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }));
    const result = await readObservation("texto", context, new GroqObservationReader());
    expect(result.source).toBe("nao_lida");
    expect(fetchMock).toHaveBeenCalledOnce();
    fetchMock.mockRestore();
    process.env.LEITOR_IA = old;
    process.env.GROQ_API_KEY = oldKey;
    process.env.GROQ_MODEL = oldModel;
  });

  it("repete falhas transitorias do leitor antes de marcar como nao lida", async () => {
    const old = process.env.LEITOR_IA;
    process.env.LEITOR_IA = "on";
    let attempts = 0;
    const reader = { read: vi.fn(async () => { attempts += 1; if (attempts < 3) throw new Error("GROQ_HTTP_503"); return { classe: "rotina" as const, sinais: [], motivo: "" }; }) };
    const result = await readObservation("texto", context, reader);
    expect(result.source).toBe("groq");
    expect(reader.read).toHaveBeenCalledTimes(3);
    process.env.LEITOR_IA = old;
  }, 5000);
});
