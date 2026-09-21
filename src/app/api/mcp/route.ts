import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { consultarPendencias, consultarRegra, verificarGuia, guideInput, pendenciasInput } from "../../../mcp/ferramentas";

const handler = createMcpHandler((server) => {
  server.registerTool("consultar_regra", { title: "Consultar regra", description: "Consulta a cobertura e os limites de um convenio para um procedimento.", inputSchema: z.object({ convenio: z.string(), procedimento_codigo: z.string() }) }, async (input) => safeTool(() => JSON.stringify(consultarRegra(input))));
  server.registerTool("verificar_guia", { title: "Verificar guia", description: "Verifica uma guia e devolve OK ou PENDENTE com motivos e acoes.", inputSchema: guideInput }, async (input) => safeTool(() => JSON.stringify(verificarGuia(input))));
  server.registerTool("consultar_pendencias", { title: "Consultar pendencias", description: "Lista as guias que precisam de ajuste ou mostra o detalhe de uma guia, sem dados pessoais.", inputSchema: pendenciasInput }, async (input) => { try { const result = await consultarPendencias(input); return { content: [{ type: "text", text: result.texto }], structuredContent: result.dados }; } catch (error) { return toolError(error); } });
}, { serverInfo: { name: "verificador-guias-vitalis", version: "4.0.0" }, capabilities: { tools: {} } });

export const GET = handler;
export const POST = handler;

function safeTool(run: () => string) {
  try { return { content: [{ type: "text" as const, text: run() }] }; } catch (error) { return toolError(error); }
}

function toolError(error: unknown) {
  const message = error instanceof z.ZodError ? "Entrada inválida. Confira os campos e tente novamente." : "Não foi possível consultar o verificador agora.";
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}
