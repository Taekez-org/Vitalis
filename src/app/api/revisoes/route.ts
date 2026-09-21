import { listObservationRevisions } from "../../../infra/store";
import { productionDatabaseUnavailable } from "../../../infra/supabase";

export async function GET() {
  if (productionDatabaseUnavailable()) return Response.json({ erro: "BANCO_NAO_CONFIGURADO", mensagem: "O banco de dados não está configurado para este ambiente." }, { status: 503 });
  const revisoes = listObservationRevisions();
  return Response.json({ revisoes: revisoes.map(publicRevision), total: revisoes.filter((revision) => revision.status === "ABERTA").length });
}

function publicRevision(revision: ReturnType<typeof listObservationRevisions>[number]) {
  return { id_guia: revision.id_guia, chave: revision.chave, status: revision.status, origem: revision.origem, classe: revision.classe, sinais: revision.sinais, motivo: revision.motivo, criada_em: revision.createdAt, resolvida_em: revision.resolvedAt, resolvida_por: revision.resolvedBy };
}
