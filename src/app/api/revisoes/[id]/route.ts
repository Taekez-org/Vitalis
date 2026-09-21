import { resolveObservationRevision } from "../../../../infra/store";
import { productionDatabaseUnavailable } from "../../../../infra/supabase";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (productionDatabaseUnavailable()) return Response.json({ erro: "BANCO_NAO_CONFIGURADO", mensagem: "O banco de dados não está configurado para este ambiente." }, { status: 503 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { chave?: string; por_quem?: string; comentario?: string };
  if (!body.chave || body.chave.length > 128) return Response.json({ erro: "CHAVE_INVALIDA" }, { status: 400 });
  const resolved = resolveObservationRevision(id, body.chave, typeof body.por_quem === "string" && body.por_quem.trim() ? body.por_quem.trim().slice(0, 60) : "Equipe", typeof body.comentario === "string" ? body.comentario : undefined);
  if (!resolved) return Response.json({ erro: "REVISAO_NAO_ENCONTRADA" }, { status: 404 });
  return Response.json({ id_guia: resolved.id_guia, chave: resolved.chave, status: resolved.status, resolvida_em: resolved.resolvedAt, resolvida_por: resolved.resolvedBy });
}
