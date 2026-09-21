import { latestResults, store } from "../../../infra/store";
import { calcularFrescor } from "../../../servico/frescor";
import { hojeEmSaoPaulo } from "../../../infra/relogio";
import { calcularRelatorioPeriodo, periodoFromParams } from "../../../servico/relatorio";
import { productionDatabaseUnavailable } from "../../../infra/supabase";

export async function GET(request: Request) {
  if (productionDatabaseUnavailable()) return Response.json({ erro: "BANCO_NAO_CONFIGURADO", mensagem: "O banco de dados não está configurado para este ambiente." }, { status: 503 });
  const results = await latestResults();
  const params = new URL(request.url).searchParams;
  let periodo;
  try { periodo = periodoFromParams(params.get("inicio"), params.get("fim")); } catch { return Response.json({ erro: "PERIODO_INVALIDO", mensagem: "Informe datas no formato AAAA-MM-DD e um intervalo válido." }, { status: 400 }); }
  const report = { ...calcularRelatorioPeriodo(store.verifications, store.guides, periodo), aguardando_reverificacao: [...store.treatments.values()].filter((item) => item.status === "AGUARDANDO_REVERIFICACAO").length, ultima_carga: store.loads.at(-1) ?? null, frescor: calcularFrescor(store.loads.at(-1)?.createdAt, hojeEmSaoPaulo()) };
  if (new URL(request.url).searchParams.get("formato") === "texto") {
    return new Response(formatText(report), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return Response.json(report);
}

function formatText(report: Record<string, unknown>) {
  const codes = Object.entries(report.por_codigo as Record<string, number>).map(([code, count]) => `${code}: ${count}`).join("; ");
  return [
    `Relatorio Vitalis - periodo ${report.inicio} a ${report.fim}`,
    `Guias verificadas: ${report.verificadas}`,
    `OK: ${report.ok}`,
    `Com problema: ${report.pendentes}`,
    `Valor em risco: R$ ${Number(report.valor_em_risco).toFixed(2).replace(".", ",")}`,
    `Glosa evitada: R$ ${Number(report.glosa_evitada).toFixed(2).replace(".", ",")}`,
    `Aguardando reverificacao: ${report.aguardando_reverificacao}`,
    `Por codigo: ${codes || "nenhum"}`,
  ].join("\n");
}
