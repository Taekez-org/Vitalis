import { beforeEach, describe, expect, it } from "vitest";
import { consultarPendencias } from "../src/mcp/ferramentas";
import { carregarDemo } from "./helpers/demo";

describe("MCP de pendências", () => {
  beforeEach(async () => { await carregarDemo(); });
  it("lista a fila da recepção sem dados pessoais", async () => {
    const result = await consultarPendencias({ limite: 20 });
    expect(result.modo).toBe("lista");
    expect(result.texto).toContain("26 guias com ajuste");
    expect(result.texto).toContain("G-2608-0031");
    expect(result.texto).toContain("Mais 13 guias dependem do financeiro ou da gestão.");
    expect(JSON.stringify(result)).not.toContain("P-1017");
    expect(JSON.stringify(result)).not.toContain("598125208");
    expect(JSON.stringify(result)).not.toContain("M79.7");
  });

  it("mostra detalhe ou informa que a guia não está na fila", async () => {
    const detail = await consultarPendencias({ id_guia: "G-2608-0030" });
    expect(detail.modo).toBe("detalhe");
    expect(detail.texto).toContain("Como resolver:");
    expect(detail.texto).toContain("Quem resolve:");
    const missing = await consultarPendencias({ id_guia: "G-NAO-EXISTE" });
    expect(missing.texto).toContain("não está na lista de ajustes");
  });

  it("aceita todos os responsáveis e limita a lista", async () => {
    const result = await consultarPendencias({ responsavel: "todos", limite: 1 });
    expect(result.dados).toMatchObject({ total: 39, mostrando: 1, outros_responsaveis: 0 });
    expect(result.texto).toContain("Mostrando 1 de 39");
  });

  it("mantém a ordenação global do gabarito quando todos são solicitados", async () => {
    const result = await consultarPendencias({ responsavel: "todos", limite: 1 });
    expect(result.texto).toContain("G-2608-0035");
  });
});
