import { listObservationRevisionsAsync } from "../../../infra/store";
import { productionDatabaseUnavailable } from "../../../infra/supabase";

export async function GET() {
  if (productionDatabaseUnavailable()) return Response.json({ erro: "BANCO_NAO_CONFIGURADO", mensagem: "O banco de dados não está configurado para este ambiente." }, { status: 503 });
  const revisoes = await listObservationRevisionsAsync();
  return Response.json({ revisoes: revisoes.map(publicRevision), total: revisoes.filter((revision) => revision.status === "ABERTA").length });
}

function publicRevision(revision: Awaited<ReturnType<typeof listObservationRevisionsAsync>>[number]) {
  const motivo = revision.motivo ?? (revision.origem === "nao_lida" ? "A leitura automática falhou. Fazer leitura humana da observação e confirmar os dados antes do faturamento." : "O sinal foi identificado, mas não há explicação registrada. Fazer leitura humana antes do faturamento.");
  return { id_guia: revision.id_guia, chave: revision.chave, status: revision.status, origem: revision.origem, classe: revision.classe, sinais: revision.sinais, motivo, criada_em: revision.createdAt, resolvida_em: revision.resolvedAt, resolvida_por: revision.resolvedBy };
}
