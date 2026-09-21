import { PDFDocument, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { RelatorioPeriodo } from "./relatorio";
import { rotuloMotivo } from "./rotulos";

const colors = {
  background: rgb(0.98, 0.97, 0.93),
  card: rgb(1, 1, 0.99),
  ink: rgb(0.08, 0.13, 0.11),
  muted: rgb(0.35, 0.4, 0.37),
  border: rgb(0.84, 0.88, 0.84),
  primary: rgb(0.08, 0.33, 0.18),
  primarySoft: rgb(0.88, 0.94, 0.89),
  warning: rgb(0.94, 0.66, 0.14),
  warningSoft: rgb(1, 0.95, 0.82),
  risk: rgb(0.65, 0.2, 0.12),
  riskSoft: rgb(0.98, 0.9, 0.86),
};

type Fonts = { regular: Awaited<ReturnType<PDFDocument["embedFont"]>>; bold: Awaited<ReturnType<PDFDocument["embedFont"]>> };
type Layout = { page: PDFPage; y: number; pageNumber: number };

export async function gerarRelatorioPdf(report: RelatorioPeriodo, geradoEm: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fonts: Fonts = { regular: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  let layout = createPage(pdf, fonts, report, geradoEm, 1);
  layout.y = 322;

  const money = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;
  drawMetricCard(layout.page, fonts, 36, layout.y, 251, 70, "Guias verificadas", String(report.verificadas), "Conferidas no periodo", colors.primary, "check");
  drawMetricCard(layout.page, fonts, 308, layout.y, 251, 70, "Podem seguir", String(report.ok), report.verificadas ? `${Math.round((report.ok / report.verificadas) * 100)}% liberadas` : "Sem registros", colors.primary, "check");
  layout.y -= 84;
  drawMetricCard(layout.page, fonts, 36, layout.y, 251, 70, "Precisam de acao", String(report.pendentes), "Pendencias no fechamento", colors.risk, "alert");
  drawMetricCard(layout.page, fonts, 308, layout.y, 251, 70, "Valor em risco", money(report.valor_em_risco), "Estimativa de glosa", colors.warning, "money");
  layout.y -= 94;

  drawSectionHeading(layout.page, fonts, layout.y, "Leitura executiva", "O que merece atencao na reuniao de terca");
  layout.y -= 34;
  drawCallout(layout.page, fonts, 36, layout.y, 523, 54, report.pendentes ? colors.riskSoft : colors.primarySoft, report.pendentes ? colors.risk : colors.primary, report.pendentes ? `Ha ${report.pendentes} guia(s) que nao devem seguir para o convenio.` : "Nenhuma pendencia no fechamento deste periodo.", report.pendentes ? "Priorize a correcao antes do envio." : "A operacao esta liberada para o periodo.");
  layout.y -= 72;

  layout.y = ensureSpace(layout, pdf, fonts, report, geradoEm, 210);
  drawSectionHeading(layout.page, fonts, layout.y, "Onde esta o risco", "Distribuicao das guias pendentes");
  layout.y -= 30;
  const columns = [
    { title: "Por motivo", values: report.por_codigo, labeler: rotuloMotivo },
    { title: "Por convenio", values: report.por_convenio, labeler: (value: string) => value },
    { title: "Por unidade", values: report.por_unidade, labeler: (value: string) => value },
  ];
  for (const [index, column] of columns.entries()) {
    const x = index === 0 ? 36 : index === 1 ? 211 : 386;
    drawBarList(layout.page, fonts, x, layout.y, 165, 148, column.title, column.values, column.labeler);
  }
  layout.y -= 176;
  layout.y = ensureSpace(layout, pdf, fonts, report, geradoEm, 92);
  drawMetricCard(layout.page, fonts, 36, layout.y, 251, 70, "Glosa evitada", money(report.glosa_evitada), "Pendente que voltou a OK", colors.primary, "shield");
  drawCallout(layout.page, fonts, 308, layout.y, 251, 70, colors.warningSoft, colors.warning, "Proxima conversa", "Corrigir na origem e reenviar o CSV.");
  layout.y -= 94;
  drawFooter(layout.page, fonts, report, geradoEm, layout.pageNumber);
  return pdf.save();
}

function createPage(pdf: PDFDocument, fonts: Fonts, report: RelatorioPeriodo, geradoEm: string, pageNumber: number): Layout {
  const page = pdf.addPage([595, 842]);
  page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: colors.background });
  page.drawRectangle({ x: 0, y: 726, width: 595, height: 116, color: colors.primary });
  page.drawText("VERIFICADOR VITALIS", { x: 36, y: 792, size: 9, font: fonts.bold, color: colors.primarySoft });
  page.drawText("Relatorio de acompanhamento", { x: 36, y: 758, size: 22, font: fonts.bold, color: rgb(1, 1, 1) });
  page.drawText("Conferencia preventiva de guias de convenio", { x: 36, y: 739, size: 9, font: fonts.regular, color: colors.primarySoft });
  page.drawRectangle({ x: 390, y: 756, width: 169, height: 42, color: rgb(0.16, 0.42, 0.26) });
  page.drawText("PERIODO", { x: 404, y: 783, size: 7, font: fonts.bold, color: colors.primarySoft });
  page.drawText(`${formatDate(report.inicio)} a ${formatDate(report.fim)}`, { x: 404, y: 768, size: 10, font: fonts.bold, color: rgb(1, 1, 1) });
  page.drawText(`Gerado em ${formatDateTime(geradoEm)}`, { x: 36, y: 704, size: 8, font: fonts.regular, color: colors.muted });
  return { page, y: 680, pageNumber };
}

function drawMetricCard(page: PDFPage, fonts: Fonts, x: number, y: number, width: number, height: number, label: string, value: string, caption: string, color: ReturnType<typeof rgb>, icon: "check" | "alert" | "money" | "shield") {
  page.drawRectangle({ x, y, width, height, color: colors.card, borderColor: colors.border, borderWidth: 0.8 });
  page.drawCircle({ x: x + 25, y: y + height - 24, size: 13, color: blend(color, 0.14) });
  drawIcon(page, fonts, x + 25, y + height - 24, color, icon);
  page.drawText(label, { x: x + 47, y: y + height - 22, size: 9, font: fonts.regular, color: colors.muted });
  page.drawText(value, { x: x + 16, y: y + 22, size: value.length > 15 ? 15 : 20, font: fonts.bold, color: colors.ink });
  page.drawText(caption, { x: x + 16, y: y + 9, size: 7.5, font: fonts.regular, color: colors.muted });
}

function drawSectionHeading(page: PDFPage, fonts: Fonts, y: number, title: string, subtitle: string) {
  page.drawText(title, { x: 36, y, size: 14, font: fonts.bold, color: colors.ink });
  page.drawText(subtitle, { x: 36, y: y - 16, size: 8.5, font: fonts.regular, color: colors.muted });
}

function drawCallout(page: PDFPage, fonts: Fonts, x: number, y: number, width: number, height: number, fill: ReturnType<typeof rgb>, accent: ReturnType<typeof rgb>, title: string, detail: string) {
  page.drawRectangle({ x, y, width, height, color: fill, borderColor: blend(accent, 0.45), borderWidth: 0.8 });
  page.drawRectangle({ x, y, width: 4, height, color: accent });
  page.drawText(title, { x: x + 16, y: y + height - 22, size: 10, font: fonts.bold, color: colors.ink, maxWidth: width - 28 });
  page.drawText(detail, { x: x + 16, y: y + 13, size: 8, font: fonts.regular, color: colors.muted, maxWidth: width - 28 });
}

function drawBarList(page: PDFPage, fonts: Fonts, x: number, y: number, width: number, height: number, title: string, values: Record<string, number>, labeler: (value: string) => string) {
  page.drawRectangle({ x, y, width, height, color: colors.card, borderColor: colors.border, borderWidth: 0.8 });
  page.drawText(title, { x: x + 12, y: y + height - 21, size: 10, font: fonts.bold, color: colors.ink });
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
  const max = Math.max(...entries.map(([, value]) => value), 1);
  let rowY = y + height - 42;
  if (!entries.length) page.drawText("Nenhum registro", { x: x + 12, y: rowY, size: 8, font: fonts.regular, color: colors.muted });
  for (const [label, value] of entries) {
    page.drawText(truncate(labeler(label), 23), { x: x + 12, y: rowY, size: 7.5, font: fonts.regular, color: colors.muted });
    page.drawText(String(value), { x: x + width - 22, y: rowY, size: 8, font: fonts.bold, color: colors.ink });
    page.drawRectangle({ x: x + 12, y: rowY - 9, width: width - 32, height: 5, color: colors.primarySoft });
    page.drawRectangle({ x: x + 12, y: rowY - 9, width: Math.max(7, (width - 32) * value / max), height: 5, color: colors.primary });
    rowY -= 22;
  }
}

function drawIcon(page: PDFPage, fonts: Fonts, x: number, y: number, color: ReturnType<typeof rgb>, icon: "check" | "alert" | "money" | "shield") {
  void fonts;
  const paths = {
    check: "M9 12l2 2 4-4 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
    alert: "M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01",
    money: "M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H7",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
  };
  page.drawSvgPath(paths[icon], { x: x - 7, y: y - 7, scale: 0.58, borderColor: color, borderWidth: 1.8, color });
/*
  if (icon === "check") page.drawLine({ start: { x: x - 5, y }, end: { x: x - 1, y: y - 4 }, thickness: 1.7, color });
  if (icon === "check") page.drawLine({ start: { x: x - 1, y: y - 4 }, end: { x: x + 6, y: y + 5 }, thickness: 1.7, color });
  if (icon === "alert") { page.drawLine({ start: { x: x, y: y + 6 }, end: { x: x, y: y - 2 }, thickness: 1.7, color }); page.drawCircle({ x, y: y - 5, size: 1.2, color }); }
  if (icon === "money") { page.drawCircle({ x, y, size: 6, borderColor: color, borderWidth: 1.2 }); page.drawText("$", { x: x - 2.5, y: y - 3.5, size: 7, color, font: fonts.bold }); }
  if (icon === "shield") { page.drawLine({ start: { x: x - 5, y: y + 4 }, end: { x, y: y + 7 }, thickness: 1.3, color }); page.drawLine({ start: { x, y: y + 7 }, end: { x: x + 5, y: y + 4 }, thickness: 1.3, color }); page.drawLine({ start: { x: x - 5, y: y + 4 }, end: { x: x - 3, y: y - 4 }, thickness: 1.3, color }); page.drawLine({ start: { x: x + 5, y: y + 4 }, end: { x: x + 3, y: y - 4 }, thickness: 1.3, color }); }
*/
}

function drawFooter(page: PDFPage, fonts: Fonts, report: RelatorioPeriodo, geradoEm: string, pageNumber: number) {
  page.drawLine({ start: { x: 36, y: 34 }, end: { x: 559, y: 34 }, thickness: 0.7, color: colors.border });
  page.drawText("Vitalis | Relatorio de acompanhamento", { x: 36, y: 21, size: 7, font: fonts.regular, color: colors.muted });
  page.drawText(`Pagina ${pageNumber} | ${formatDate(report.inicio)} - ${formatDate(report.fim)}`, { x: 438, y: 21, size: 7, font: fonts.regular, color: colors.muted });
  void geradoEm;
}

function ensureSpace(layout: Layout, pdf: PDFDocument, fonts: Fonts, report: RelatorioPeriodo, geradoEm: string, required: number): number {
  if (layout.y - required >= 52) return layout.y;
  drawFooter(layout.page, fonts, report, geradoEm, layout.pageNumber);
  const next = createPage(pdf, fonts, report, geradoEm, layout.pageNumber + 1);
  layout.page = next.page;
  // Keep the first content block below the repeated header on continuation pages.
  layout.y = next.y - 90;
  layout.pageNumber = next.pageNumber;
  return layout.y;
}

function blend(color: ReturnType<typeof rgb>, amount: number) { return rgb(color.red + (1 - color.red) * amount, color.green + (1 - color.green) * amount, color.blue + (1 - color.blue) * amount); }
function truncate(value: string, length: number) { return value.length > length ? `${value.slice(0, length - 1)}...` : value; }
function formatDate(value: string) { return value.split("-").reverse().join("/"); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
