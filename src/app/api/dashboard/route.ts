import { latestResults, store } from "../../../infra/store";
import { calcularFrescor } from "../../../servico/frescor";
import { calcularRelatorioPeriodo, periodoFromParams } from "../../../servico/relatorio";
import { hojeEmSaoPaulo } from "../../../infra/relogio";
import { productionDatabaseUnavailable } from "../../../infra/supabase";

export async function GET(request: Request) {
  if (productionDatabaseUnavailable()) return Response.json({ erro: "BANCO_NAO_CONFIGURADO", mensagem: "O banco de dados não está configurado para este ambiente." }, { status: 503 });
  const results = await latestResults();
  const params = new URL(request.url).searchParams;
  let periodo;
  try { periodo = periodoFromParams(params.get("inicio"), params.get("fim")); } catch { return Response.json({ erro: "PERIODO_INVALIDO", mensagem: "Informe datas no formato AAAA-MM-DD e um intervalo válido." }, { status: 400 }); }
  const report = calcularRelatorioPeriodo(store.verifications, store.guides, periodo);
  const ultimaCarga = store.loads.at(-1) ?? null;
  return Response.json({
    ...report,
    aguardando_reverificacao: [...store.treatments.values()].filter((item) => item.status === "AGUARDANDO_REVERIFICACAO").length,
    ultima_carga: ultimaCarga,
    frescor: calcularFrescor(ultimaCarga?.createdAt, hojeEmSaoPaulo()),
  });
}
