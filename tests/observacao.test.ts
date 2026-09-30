import { describe, expect, it } from "vitest";
import { parseObservationReading } from "../src/observacao/contrato";
import { chaveLeitura, hashObservacao, mascararObservacao } from "../src/observacao/seguranca";
import { groqConfig, leitorIaLigado } from "../src/observacao/config";

describe("contrato seguro da observacao", () => {
  it("mascara CPF, telefone e e-mail sem alterar texto comum", () => {
    const value = mascararObservacao("Ligar para (11) 99876-5432 ou teste@example.com; CPF 123.456.789-09. Confirmado.");
    expect(value).toContain("[TELEFONE]");
    expect(value).toContain("[EMAIL]");
    expect(value).toContain("[CPF]");
    expect(value).toContain("Confirmado.");
  });

  it("aceita apenas classes coerentes e limita o motivo", () => {
    expect(parseObservationReading({ classe: "rotina", sinais: [], motivo: "" })).toEqual({ classe: "rotina", sinais: [], motivo: "" });
    expect(parseObservationReading({ classe: "sinal", sinais: ["TXT_FATURAR_PARTICULAR"], motivo: "A observacao indica faturamento particular." }).sinais).toHaveLength(1);
    expect(parseObservationReading({ classe: "revisar", sinais: [], motivo: "x".repeat(200) }).motivo).toHaveLength(140);
    expect(() => parseObservationReading({ classe: "rotina", sinais: ["TXT_FATURAR_PARTICULAR"], motivo: "" })).toThrow();
    expect(() => parseObservationReading({ classe: "sinal", sinais: [], motivo: "" })).toThrow();
    expect(() => parseObservationReading({ classe: "sinal", sinais: ["TXT_FATURAR_PARTICULAR"], motivo: "" })).toThrow();
  });

  it("gera chave diferente para contexto ou versao diferentes", () => {
    expect(hashObservacao("  texto\n comum ")).toBe(hashObservacao("texto comum"));
    expect(chaveLeitura("texto", { regra: "A" }, "obs-v1", "modelo-a")).not.toBe(chaveLeitura("texto", { regra: "B" }, "obs-v1", "modelo-a"));
  });

  it("fica desligado por padrao e nao exige chave", () => {
    const oldFlag = process.env.LEITOR_IA;
    const oldKey = process.env.GROQ_API_KEY;
    const oldModel = process.env.GROQ_MODEL;
    delete process.env.LEITOR_IA;
    delete process.env.GROQ_API_KEY;
    delete process.env.GROQ_MODEL;
    expect(leitorIaLigado()).toBe(false);
    expect(groqConfig()).toBeNull();
    process.env.LEITOR_IA = oldFlag;
    process.env.GROQ_API_KEY = oldKey;
    process.env.GROQ_MODEL = oldModel;
  });

  it("nao lanca erro quando a chave ou o modelo do Groq faltam com a IA ligada", () => {
    const saved = { flag: process.env.LEITOR_IA, key: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL };
    process.env.LEITOR_IA = "on";
    delete process.env.GROQ_API_KEY;
    process.env.GROQ_MODEL = "modelo-teste";
    expect(groqConfig()).toBeNull();
    process.env.GROQ_API_KEY = "chave-teste";
    delete process.env.GROQ_MODEL;
    expect(groqConfig()).toBeNull();
    process.env.LEITOR_IA = saved.flag;
    process.env.GROQ_API_KEY = saved.key;
    process.env.GROQ_MODEL = saved.model;
  });

  it("lista as chaves do Groq em ordem, sem vazias nem repetidas", () => {
    const saved = ["GROQ_API_KEY", "GROQ_API_KEY2", "GROQ_API_KEY3"].map((name) => [name, process.env[name]] as const);
    process.env.LEITOR_IA = "on";
    process.env.GROQ_MODEL = "modelo-teste";
    process.env.GROQ_API_KEY = "a";
    process.env.GROQ_API_KEY2 = "  ";
    process.env.GROQ_API_KEY3 = "a";
    expect(groqConfig()?.apiKeys).toEqual(["a"]);
    process.env.GROQ_API_KEY2 = "b";
    process.env.GROQ_API_KEY3 = "c";
    expect(groqConfig()?.apiKeys).toEqual(["a", "b", "c"]);
    delete process.env.GROQ_API_KEY;
    expect(groqConfig()?.apiKeys).toEqual(["b", "c"]);
    for (const [name, value] of saved) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  });
});
