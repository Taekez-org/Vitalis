import { latestResults, store } from "../../../infra/store";
import { productionDatabaseUnavailable } from "../../../infra/supabase";

export async function GET(request: Request) {
  if (productionDatabaseUnavailable()) return Response.json({ erro: "BANCO_NAO_CONFIGURADO" }, { status: 503 });
  await latestResults();
  const params = new URL(request.url).searchParams;
  const inicio = params.get("inicio");
  const fim = params.get("fim");
  const eventos = store.treatmentEvents.filter((item) =>
    (!inicio || item.createdAt.slice(0, 10) >= inicio) &&
    (!fim || item.createdAt.slice(0, 10) <= fim) &&
    (!params.get("id_guia") || item.id_guia.toLowerCase().includes(params.get("id_guia")!.toLowerCase())) &&
    (!params.get("evento") || item.event === params.get("evento")) &&
    (!params.get("por_quem") || item.by.toLowerCase().includes(params.get("por_quem")!.toLowerCase())) &&
    (!params.get("status") || item.newStatus === params.get("status"))
  );
  return Response.json({ total: eventos.length, eventos: eventos.map((item) => ({ id_guia: item.id_guia, carga_id: item.loadId, status_tecnico: item.technicalStatus, status_anterior: item.previousStatus, status_novo: item.newStatus, evento: item.event, por_quem: item.by, comentario: item.comment, criado_em: item.createdAt })) });
}
