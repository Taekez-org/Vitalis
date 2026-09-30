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

  it("troca para a proxima chave do Groq quando a anterior expirou", async () => {
    const saved = ["LEITOR_IA", "GROQ_API_KEY", "GROQ_API_KEY2", "GROQ_API_KEY3", "GROQ_MODEL"].map((name) => [name, process.env[name]] as const);
    process.env.LEITOR_IA = "on";
    process.env.GROQ_API_KEY = "chave-expirada";
    process.env.GROQ_API_KEY2 = "chave-boa";
    delete process.env.GROQ_API_KEY3;
    process.env.GROQ_MODEL = "test-only-model";
    const usadas: string[] = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const auth = String((init?.headers as Record<string, string>).Authorization);
      usadas.push(auth);
      if (auth.endsWith("chave-expirada")) return new Response("{}", { status: 401 });
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ classe: "rotina", sinais: [], motivo: "" }) } }] }), { status: 200 });
    });
    const reading = await new GroqObservationReader().read("texto", context);
    expect(reading.classe).toBe("rotina");
    expect(usadas).toEqual(["Bearer chave-expirada", "Bearer chave-boa"]);
    fetchMock.mockRestore();
    for (const [name, value] of saved) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  });

  it("percorre as tres chaves do Groq em ordem e usa a terceira quando as duas primeiras sao recusadas", async () => {
    const saved = ["LEITOR_IA", "GROQ_API_KEY", "GROQ_API_KEY2", "GROQ_API_KEY3", "GROQ_MODEL"].map((name) => [name, process.env[name]] as const);
    process.env.LEITOR_IA = "on";
    process.env.GROQ_API_KEY = "chave-1-expirada";
    process.env.GROQ_API_KEY2 = "chave-2-limite";
    process.env.GROQ_API_KEY3 = "chave-3-boa";
    process.env.GROQ_MODEL = "test-only-model";
    const usadas: string[] = [];
    const sinais: (AbortSignal | undefined)[] = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const auth = String((init?.headers as Record<string, string>).Authorization);
      usadas.push(auth);
      sinais.push(init?.signal ?? undefined);
      if (auth.endsWith("chave-1-expirada")) return new Response("{}", { status: 401 });
      if (auth.endsWith("chave-2-limite")) return new Response("{}", { status: 429 });
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ classe: "rotina", sinais: [], motivo: "" }) } }] }), { status: 200 });
    });
    const reading = await new GroqObservationReader().read("texto", context);
    expect(reading.classe).toBe("rotina");
    expect(usadas).toEqual(["Bearer chave-1-expirada", "Bearer chave-2-limite", "Bearer chave-3-boa"]);
    expect(new Set(sinais).size).toBe(3);
    fetchMock.mockRestore();
    for (const [name, value] of saved) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  });

  it("nao troca de chave quando o erro nao e da chave (modelo inexistente ou falha do servidor)", async () => {
    const saved = ["LEITOR_IA", "GROQ_API_KEY", "GROQ_API_KEY2", "GROQ_API_KEY3", "GROQ_MODEL"].map((name) => [name, process.env[name]] as const);
    process.env.LEITOR_IA = "on";
    process.env.GROQ_API_KEY = "a";
    process.env.GROQ_API_KEY2 = "b";
    process.env.GROQ_API_KEY3 = "c";
    process.env.GROQ_MODEL = "modelo-inexistente";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 404 }));
    await expect(new GroqObservationReader().read("texto", context)).rejects.toThrow("GROQ_HTTP_404");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
    for (const [name, value] of saved) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  });

  it("falha com o ultimo erro quando todas as chaves do Groq sao recusadas", async () => {
    const saved = ["LEITOR_IA", "GROQ_API_KEY", "GROQ_API_KEY2", "GROQ_API_KEY3", "GROQ_MODEL"].map((name) => [name, process.env[name]] as const);
    process.env.LEITOR_IA = "on";
    process.env.GROQ_API_KEY = "a";
    process.env.GROQ_API_KEY2 = "b";
    delete process.env.GROQ_API_KEY3;
    process.env.GROQ_MODEL = "test-only-model";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 401 }));
    await expect(new GroqObservationReader().read("texto", context)).rejects.toThrow("GROQ_HTTP_401");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
    for (const [name, value] of saved) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  });

  it("nao derruba os outros provedores quando o Groq esta sem chave", async () => {
    const saved = ["LEITOR_IA", "GROQ_API_KEY", "GROQ_API_KEY2", "GROQ_API_KEY3", "GROQ_MODEL", "GEMINI_API_KEY", "OPENROUTER_API_KEY"].map((name) => [name, process.env[name]] as const);
    process.env.LEITOR_IA = "on";
    delete process.env.GROQ_API_KEY; delete process.env.GROQ_API_KEY2; delete process.env.GROQ_API_KEY3; delete process.env.GROQ_MODEL;
    process.env.GEMINI_API_KEY = "gemini-teste";
    delete process.env.OPENROUTER_API_KEY;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ classe: "rotina", sinais: [], motivo: "" }) }] } }] }), { status: 200 }));
    const result = await readObservation("texto", context);
    expect(result.source).toBe("groq");
    expect(result.reading?.classe).toBe("rotina");
    fetchMock.mockRestore();
    for (const [name, value] of saved) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
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
