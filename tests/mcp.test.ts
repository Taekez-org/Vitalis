import { beforeEach, describe, expect, it } from "vitest";
import { consultarPendencias, consultarRegra, verificarGuia, verificarGuiaTexto } from "../src/mcp/ferramentas";
import { formatarRegra, formatarVerificacao } from "../src/mcp/formatar";
import { POST as mcpPost } from "../src/app/api/mcp/route";
import { carregarDemo } from "./helpers/demo";

const guiaNaoCoberta = { id_guia: "G-TESTE-1", convenio: "Plano Bem", procedimento_codigo: "20103301", procedimento_descricao: "Consulta ortopédica", data_atendimento: "2026-08-20", data_lancamento: "2026-08-20", autorizacao_validade: "2026-08-30", autorizacao_sessoes_limite: "12", sessao_numero_na_autorizacao: "1", numero_autorizacao: "AUT-1", profissional_registro: "CRM-1", carteirinha: "CART-1", cid: "M54", valor: "90", data_referencia: "2026-08-31" };

async function chamarMcp(name: string, args: Record<string, unknown>): Promise<{ text: string; raw: Record<string, unknown> }> {
  const response = await mcpPost(new Request("http://localhost/api/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: "Bearer token-de-teste" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) }));
  const body = await response.text();
  const payload = body.startsWith("event:") || body.includes("\ndata:") ? body.split("\n").find((line) => line.startsWith("data:"))!.slice(5) : body;
  const message = JSON.parse(payload) as { result: { content: { text: string }[] } & Record<string, unknown> };
  return { text: message.result.content.map((item) => item.text).join("\n"), raw: message.result };
}

describe("MCP responde em texto amigável", () => {
  it("explica a regra do convênio sem JSON", () => {
    const text = formatarRegra(consultarRegra({ convenio: "Plano Bem", procedimento_codigo: "20103301" }));
    expect(text).toContain("Plano Bem");
    expect(text).toContain("Consulta ortopédica");
    expect(text).toContain("Cobertura: NÃO coberto");
    expect(text).toContain("faturada como particular");
    expect(text).toContain("R$ 90,00");
    expect(text).toContain("60 dias");
    expect(text).not.toMatch(/[{}"]/);
    expect(formatarRegra(consultarRegra({ convenio: "Vitalcard", procedimento_codigo: "50000470" }))).toContain("Cobertura: coberto");
  });

  it("avisa quando convênio ou procedimento não existem", () => {
    expect(formatarRegra(consultarRegra({ convenio: "Inexistente", procedimento_codigo: "50000470" }))).toContain("Não encontrei o convênio");
    expect(formatarRegra(consultarRegra({ convenio: "Vitalcard", procedimento_codigo: "99999999" }))).toContain("Não encontrei o procedimento");
  });

  it("explica a verificação da guia com motivo, correção e responsável", () => {
    const text = formatarVerificacao(verificarGuia(guiaNaoCoberta));
    expect(text).toContain("G-TESTE-1");
    expect(text).toContain("precisa de ação");
    expect(text).toContain("procedimento não coberto pelo convênio (PROCEDIMENTO_NAO_COBERTO)");
    expect(text).toContain("Como resolver:");
    expect(text).toContain("Quem resolve: gestão");
    expect(text).not.toMatch(/[{}]/);
  });

  it("informa que a guia pode seguir quando está OK", () => {
    const text = formatarVerificacao(verificarGuia({ ...guiaNaoCoberta, id_guia: "G-TESTE-2", convenio: "Saúde Interior", procedimento_codigo: "50000470", procedimento_descricao: "Sessão de fisioterapia musculoesquelética", valor: "62", autorizacao_validade: "2026-09-10", autorizacao_sessoes_limite: "20" }));
    expect(text).toContain("G-TESTE-2");
    expect(text).toContain("pode seguir");
  });

  it("orienta em vez de inventar erros quando recebe só o número da guia", async () => {
    const text = verificarGuiaTexto({ id_guia: "G-2608-0006" });
    expect(text).toContain("G-2608-0006");
    expect(text).toContain("consultar_pendencias");
    expect(text).not.toContain("DADO_ILEGIVEL");
    expect(text).not.toContain("CONVENIO_DESCONHECIDO");
    expect(verificarGuiaTexto(guiaNaoCoberta)).toContain("PROCEDIMENTO_NAO_COBERTO");
    expect(verificarGuiaTexto({ id_guia: "G-X", convenio: "Vitalcard" })).not.toContain("consultar_pendencias");
  });

  it("a rota MCP devolve somente texto, sem bloco estruturado nem JSON", async () => {
    const saved = process.env.MCP_AUTH_TOKEN;
    process.env.MCP_AUTH_TOKEN = "token-de-teste";
    try {
      const regra = await chamarMcp("consultar_regra", { convenio: "Plano Bem", procedimento_codigo: "20103301" });
      const guia = await chamarMcp("verificar_guia", guiaNaoCoberta);
      for (const item of [regra, guia]) {
        expect(item.text).not.toMatch(/^\s*[{[]/);
        expect(item.raw.structuredContent).toBeUndefined();
      }
      expect(regra.text).toContain("Cobertura: NÃO coberto");
      expect(guia.text).toContain("Como resolver:");
    } finally {
      process.env.MCP_AUTH_TOKEN = saved;
    }
  });
});

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

  it("a rota MCP entrega a lista em texto, sem bloco estruturado", async () => {
    const saved = process.env.MCP_AUTH_TOKEN;
    process.env.MCP_AUTH_TOKEN = "token-de-teste";
    try {
      const lista = await chamarMcp("consultar_pendencias", { limite: 5 });
      expect(lista.text).toContain("guias com ajuste");
      expect(lista.text).not.toMatch(/^\s*[{[]/);
      expect(lista.raw.structuredContent).toBeUndefined();
    } finally {
      process.env.MCP_AUTH_TOKEN = saved;
    }
  });

  it("mantém a ordenação global do gabarito quando todos são solicitados", async () => {
    const result = await consultarPendencias({ responsavel: "todos", limite: 1 });
    expect(result.texto).toContain("G-2608-0035");
  });
});
