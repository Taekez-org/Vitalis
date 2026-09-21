import { latestResults, store } from "../../../../infra/store";
import { productionDatabaseUnavailable } from "../../../../infra/supabase";

function safeCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export async function GET(request: Request) {
  if (productionDatabaseUnavailable()) return Response.json({ erro: "BANCO_NAO_CONFIGURADO", mensagem: "O banco de dados não está configurado para este ambiente." }, { status: 503 });
  const url = new URL(request.url);
  const params = url.searchParams;
  const results = (await latestResults()).filter((result) => result.status === "PENDENTE").map((result) => ({ result, guia: store.guides.get(result.id_guia), tratamento: store.treatments.get(result.id_guia) ?? { status: "ABERTA" } })).filter((item) => !params.get("busca") || item.result.id_guia.toLowerCase().includes(params.get("busca")!.toLowerCase())).filter((item) => !params.get("unidade") || item.guia?.unidade === params.get("unidade")).filter((item) => !params.get("convenio") || item.guia?.convenio === params.get("convenio")).filter((item) => !params.get("codigo") || item.result.motivos.some((reason) => reason.codigo === params.get("codigo"))).filter((item) => !params.get("responsavel") || item.result.motivos.some((reason) => reason.responsavel === params.get("responsavel"))).filter((item) => !params.get("situacao") || item.tratamento.status === params.get("situacao"));
  const rows = results.map(({ result, guia, tratamento }) => {
    return [result.id_guia, guia?.unidade ?? "", guia?.convenio ?? "", result.motivos.map((item) => item.codigo).join("|"), result.motivos.map((item) => item.responsavel).join("|"), tratamento.status, String(result.valor ?? "")].map(safeCell).join(";");
  });
  const csv = ["id_guia;unidade;convenio;codigos;responsaveis;situacao;valor", ...rows].join("\r\n");
  return new Response(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="pendencias-${url.searchParams.get("data") ?? "atual"}.csv"` } });
}
