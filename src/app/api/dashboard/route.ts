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
   const convenio = params.get("convenio")?.trim() || "";
   const guides = convenio ? new Map([...store.guides.entries()].filter(([, guide]) => guide.convenio === convenio)) : store.guides;
   const records = convenio ? store.verifications.filter((record) => guides.has(record.id_guia)) : store.verifications;
   const treatments = convenio ? new Map([...store.treatments.entries()].filter(([id]) => guides.has(id))) : store.treatments;
   const events = convenio ? store.treatmentEvents.filter((event) => guides.has(event.id_guia)) : store.treatmentEvents;
   const report = calcularRelatorioPeriodo(records, guides, periodo, treatments, events);
  const ultimaCarga = store.loads.at(-1) ?? null;
  return Response.json({
     ...report,
     convenio: convenio || "todos",
     convenios: [...new Set([...store.guides.values()].map((guide) => guide.convenio))].sort(),
    ultima_carga: ultimaCarga,
    frescor: calcularFrescor(ultimaCarga?.createdAt, hojeEmSaoPaulo()),
  });
}
