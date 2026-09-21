import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { RelatorioPeriodo } from "./relatorio";

export async function gerarRelatorioPdf(report: RelatorioPeriodo, geradoEm: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595, 842]);
  const { height } = page.getSize();
  let y = height - 52;
  const money = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;
  const text = (value: string, size = 10, isBold = false, color = rgb(0.12, 0.15, 0.18)) => {
    page.drawText(value, { x: 42, y, size, font: isBold ? bold : font, color });
    y -= size + 8;
  };
  const line = () => { page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, thickness: 1, color: rgb(0.85, 0.87, 0.9) }); y -= 18; };
  const section = (title: string, values: Record<string, number>) => {
    text(title, 12, true);
    const entries = Object.entries(values).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (!entries.length) text("Nenhum registro", 9, false, rgb(0.4, 0.43, 0.46));
    for (const [label, value] of entries) text(`${label}: ${value}`, 9);
    y -= 6;
  };

  // Keep the PDF aligned with the front-end palette: cream background, deep green primary and warm neutral details.
  page.drawRectangle({ x: 0, y: height - 105, width: 595, height: 105, color: rgb(0.08, 0.33, 0.18) });
  page.drawText("Verificador Vitalis", { x: 42, y: height - 48, size: 21, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Relatorio de acompanhamento", { x: 42, y: height - 72, size: 11, font, color: rgb(0.92, 0.96, 0.9) });
  y = height - 135;
  text(`Periodo: ${formatDate(report.inicio)} a ${formatDate(report.fim)}`, 11, true);
  text(`Gerado em: ${formatDateTime(geradoEm)}`, 9, false, rgb(0.4, 0.43, 0.46));
  line();
  text("Resumo", 14, true);
  text(`Guias verificadas: ${report.verificadas}`, 10);
  text(`Guias OK: ${report.ok}`, 10);
  text(`Pendencias no fechamento: ${report.pendentes}`, 10);
  text(`Em risco: ${money(report.valor_em_risco)}`, 10, true, rgb(0.65, 0.2, 0.12));
  text(`Glosa evitada: ${money(report.glosa_evitada)}`, 10, true, rgb(0.08, 0.33, 0.18));
  y -= 8;
  line();
  section("Pendencias por motivo", report.por_codigo);
  section("Pendencias por convenio", report.por_convenio);
  section("Pendencias por unidade", report.por_unidade);
  y -= 8;
  text("Observacao: glosa evitada considera somente a transicao de PENDENTE para OK em nova verificacao. Alertas Groq resolvidos nao entram nesse valor.", 8, false, rgb(0.35, 0.38, 0.4));
  return pdf.save();
}

function formatDate(value: string) { return value.split("-").reverse().join("/"); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
