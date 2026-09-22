import { latestResults, store } from "../../../../infra/store";
import { productionDatabaseUnavailable } from "../../../../infra/supabase";
import { gerarRelatorioPdf } from "../../../../servico/pdf";
import { calcularRelatorioPeriodo, periodoFromParams } from "../../../../servico/relatorio";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (productionDatabaseUnavailable()) return Response.json({ erro: "BANCO_NAO_CONFIGURADO", mensagem: "O banco de dados não está configurado para este ambiente." }, { status: 503 });
  const params = new URL(request.url).searchParams;
  let periodo;
  try { periodo = periodoFromParams(params.get("inicio"), params.get("fim")); } catch { return Response.json({ erro: "PERIODO_INVALIDO", mensagem: "Informe datas no formato AAAA-MM-DD e um intervalo válido." }, { status: 400 }); }
  await latestResults();
   const report = calcularRelatorioPeriodo(store.verifications, store.guides, periodo, store.treatments, store.treatmentEvents);
  const pdf = await gerarRelatorioPdf(report, new Date().toISOString());
  return new Response(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="relatorio-vitalis-${periodo.inicio}-${periodo.fim}.pdf"`, "Cache-Control": "no-store" } });
}
