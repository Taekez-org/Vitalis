import { latestResults, markTreatmentAsync } from "../../../../infra/store";
import { productionDatabaseUnavailable } from "../../../../infra/supabase";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (productionDatabaseUnavailable()) return Response.json({ erro: "BANCO_NAO_CONFIGURADO", mensagem: "O banco de dados não está configurado para este ambiente." }, { status: 503 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { por_quem?: string };
  const porQuem = typeof body.por_quem === "string" && body.por_quem.trim().length <= 60 ? body.por_quem.trim() || "Equipe" : "Equipe";
  const current = (await latestResults()).find((result) => result.id_guia === id);
  if (current?.status === "OK") return Response.json({ erro: "GUIA_NAO_PENDENTE", mensagem: "A guia já está OK e não precisa de tratamento." }, { status: 409 });
  const treatment = await markTreatmentAsync(id, porQuem);
  if (!treatment) return Response.json({ erro: "GUIA_NAO_ENCONTRADA" }, { status: 404 });
  return Response.json(treatment);
}
