import { latestResults, store } from "../../../infra/store";
import { pendenciaPublica } from "../../../servico/publico";
import { calcularFrescor } from "../../../servico/frescor";
import { hojeEmSaoPaulo } from "../../../infra/relogio";
import { productionDatabaseUnavailable } from "../../../infra/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (productionDatabaseUnavailable()) return Response.json({ erro: "BANCO_NAO_CONFIGURADO", mensagem: "O banco de dados não está configurado para este ambiente." }, { status: 503 });
  const results = await latestResults();
  const params = new URL(request.url).searchParams;
  const responsavel = params.get("responsavel");
  const pending = results.filter((result) => result.status === "PENDENTE").map((result) => ({ ...pendenciaPublica(result, store.guides.get(result.id_guia), store.treatments.get(result.id_guia) ?? { status: "ABERTA" }), result })).filter((item) => !params.get("busca") || item.id_guia.toLowerCase().includes(params.get("busca")!.toLowerCase())).filter((item) => !params.get("unidade") || item.guia?.unidade === params.get("unidade")).filter((item) => !params.get("convenio") || item.guia?.convenio === params.get("convenio")).filter((item) => !params.get("codigo") || item.motivos.some((reason) => reason.codigo === params.get("codigo"))).filter((item) => !responsavel || responsavel === "todos" || item.motivos.some((reason) => reason.responsavel === responsavel)).filter((item) => !params.get("situacao") || item.tratamento.status === params.get("situacao"));
  const output = pending.map(({ result: _result, ...item }) => item);
  const ultimaCarga = store.loads.at(-1) ?? null;
  return Response.json({ pendencias: output, ultima_carga: ultimaCarga, frescor: calcularFrescor(ultimaCarga?.createdAt, hojeEmSaoPaulo()) });
}
