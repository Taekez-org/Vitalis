import React from "react";
import { Document, Page, Path, renderToBuffer, Svg, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { RelatorioPeriodo } from "./relatorio";
import { rotuloMotivo } from "./rotulos";

const palette = {
  background: "#FAF9F3",
  card: "#FFFFFC",
  ink: "#15211B",
  muted: "#59665E",
  border: "#D6E0D8",
  primary: "#155A31",
  primarySoft: "#E0EEE4",
  warning: "#F0A91C",
  warningSoft: "#FFF1C9",
  risk: "#A83B2D",
  riskSoft: "#FBE6DF",
};

const styles = StyleSheet.create({
  page: { backgroundColor: palette.background, color: palette.ink, fontFamily: "Helvetica", paddingBottom: 46 },
  header: { height: 116, backgroundColor: palette.primary, padding: 36, color: "#FFFFFF", flexDirection: "row", justifyContent: "space-between" },
  eyebrow: { color: palette.primarySoft, fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1.4, marginBottom: 17 },
  title: { color: "#FFFFFF", fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 7 },
  subtitle: { color: palette.primarySoft, fontSize: 9 },
  period: { width: 170, height: 42, backgroundColor: "#2B7047", padding: 10, marginTop: 1 },
  periodLabel: { color: palette.primarySoft, fontSize: 7, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  periodValue: { color: "#FFFFFF", fontSize: 9, fontFamily: "Helvetica-Bold" },
  body: { paddingHorizontal: 36, paddingTop: 17 },
  generated: { color: palette.muted, fontSize: 8, marginBottom: 19 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  metric: { width: "48.8%", height: 72, backgroundColor: palette.card, borderColor: palette.border, borderWidth: 1, padding: 14, marginBottom: 13 },
  metricTop: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  metricLabel: { color: palette.muted, fontSize: 9, marginLeft: 9 },
  metricValue: { color: palette.ink, fontSize: 19, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  metricCaption: { color: palette.muted, fontSize: 7.5 },
  section: { marginTop: 10 },
  sectionTitle: { color: palette.ink, fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  sectionSubtitle: { color: palette.muted, fontSize: 8.5, marginBottom: 17 },
  callout: { minHeight: 55, borderWidth: 1, padding: 14, borderLeftWidth: 4, justifyContent: "center" },
  calloutTitle: { color: palette.ink, fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  calloutText: { color: palette.muted, fontSize: 8 },
  columns: { flexDirection: "row", justifyContent: "space-between" },
  distribution: { width: "31.5%", minHeight: 155, backgroundColor: palette.card, borderColor: palette.border, borderWidth: 1, padding: 12 },
  distributionTitle: { color: palette.ink, fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 15 },
  row: { marginBottom: 9 },
  rowHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  rowLabel: { color: palette.muted, fontSize: 7.5, maxWidth: 112 },
  rowValue: { color: palette.ink, fontSize: 8, fontFamily: "Helvetica-Bold" },
  track: { height: 5, backgroundColor: palette.primarySoft },
  bar: { height: 5, backgroundColor: palette.primary },
  bottomGrid: { flexDirection: "row", justifyContent: "space-between", marginTop: 25 },
  bottomCard: { width: "48.8%", height: 72, backgroundColor: palette.card, borderColor: palette.border, borderWidth: 1, padding: 14 },
  footer: { position: "absolute", left: 36, right: 36, bottom: 20, borderTopColor: palette.border, borderTopWidth: 1, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footerText: { color: palette.muted, fontSize: 7 },
});

type IconName = "check" | "alert" | "money" | "shield";
const icons: Record<IconName, string> = {
  check: "M9 12l2 2 4-4 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  alert: "M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01",
  money: "M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H7",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
};

export async function gerarRelatorioPdf(report: RelatorioPeriodo, geradoEm: string): Promise<Buffer> {
  return renderToBuffer(<ReportDocument report={report} geradoEm={geradoEm} />);
}

function ReportDocument({ report, geradoEm }: { report: RelatorioPeriodo; geradoEm: string }) {
  return <Document title="Relatorio Vitalis" author="Verificador Vitalis"><ReportPage report={report} geradoEm={geradoEm} page={1}><View style={styles.metricGrid}><Metric label="Guias verificadas" value={String(report.verificadas)} caption="Conferidas no periodo" color={palette.primary} icon="check" /><Metric label="Podem seguir" value={String(report.ok)} caption={report.verificadas ? `${Math.round((report.ok / report.verificadas) * 100)}% liberadas` : "Sem registros"} color={palette.primary} icon="check" /><Metric label="Precisam de acao" value={String(report.pendentes)} caption="Pendencias no fechamento" color={palette.risk} icon="alert" /><Metric label="Valor em risco" value={money(report.valor_em_risco)} caption="Estimativa de glosa" color={palette.warning} icon="money" /></View><View style={styles.section}><Text style={styles.sectionTitle}>Leitura executiva</Text><Text style={styles.sectionSubtitle}>O que merece atencao na reuniao de terca</Text><View style={[styles.callout, { backgroundColor: report.pendentes ? palette.riskSoft : palette.primarySoft, borderColor: report.pendentes ? "#DDA194" : "#B6D4BE", borderLeftColor: report.pendentes ? palette.risk : palette.primary }]}><Text style={styles.calloutTitle}>{report.pendentes ? `Ha ${report.pendentes} guia(s) que nao devem seguir para o convenio.` : "Nenhuma pendencia no fechamento deste periodo."}</Text><Text style={styles.calloutText}>{report.pendentes ? "Priorize a correcao antes do envio." : "A operacao esta liberada para o periodo."}</Text></View></View></ReportPage><ReportPage report={report} geradoEm={geradoEm} page={2}><View style={styles.section}><Text style={styles.sectionTitle}>Onde esta o risco</Text><Text style={styles.sectionSubtitle}>Distribuicao das guias pendentes</Text><View style={styles.columns}><Distribution title="Por motivo" values={report.por_codigo} labeler={rotuloMotivo} /><Distribution title="Por convenio" values={report.por_convenio} labeler={(value) => value} /><Distribution title="Por unidade" values={report.por_unidade} labeler={(value) => value} /></View><View style={styles.bottomGrid}><Metric label="Glosa evitada" value={money(report.glosa_evitada)} caption="Pendente que voltou a OK" color={palette.primary} icon="shield" compact /><View style={[styles.bottomCard, { backgroundColor: palette.warningSoft, borderColor: "#F3D486", borderLeftWidth: 4, borderLeftColor: palette.warning, justifyContent: "center" }]}><Text style={styles.calloutTitle}>Proxima conversa</Text><Text style={styles.calloutText}>Corrigir na origem e reenviar o CSV.</Text></View></View></View></ReportPage></Document>;
}

function ReportPage({ report, geradoEm, page, children }: { report: RelatorioPeriodo; geradoEm: string; page: number; children: React.ReactNode }) {
  return <Page size="A4" style={styles.page}><View style={styles.header}><View><Text style={styles.eyebrow}>VERIFICADOR VITALIS</Text><Text style={styles.title}>Relatorio de acompanhamento</Text><Text style={styles.subtitle}>Conferencia preventiva de guias de convenio</Text></View><View style={styles.period}><Text style={styles.periodLabel}>PERIODO</Text><Text style={styles.periodValue}>{formatDate(report.inicio)} a {formatDate(report.fim)}</Text></View></View><View style={styles.body}><Text style={styles.generated}>Gerado em {formatDateTime(geradoEm)}</Text>{children}</View><View style={styles.footer} fixed><Text style={styles.footerText}>Vitalis | Relatorio de acompanhamento</Text><Text style={styles.footerText}>Pagina {page} | {formatDate(report.inicio)} - {formatDate(report.fim)}</Text></View></Page>;
}

function Metric({ label, value, caption, color, icon, compact = false }: { label: string; value: string; caption: string; color: string; icon: IconName; compact?: boolean }) {
  return <View style={compact ? styles.bottomCard : styles.metric}><View style={styles.metricTop}><Icon name={icon} color={color} /><Text style={styles.metricLabel}>{label}</Text></View><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricCaption}>{caption}</Text></View>;
}

function Icon({ name, color }: { name: IconName; color: string }) {
  return <View style={{ width: 21, height: 21, borderRadius: 11, backgroundColor: `${color}22`, alignItems: "center", justifyContent: "center" }}><Svg width={12} height={12} viewBox="0 0 24 24"><Path d={icons[name]} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg></View>;
}

function Distribution({ title, values, labeler }: { title: string; values: Record<string, number>; labeler: (value: string) => string }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
  const max = Math.max(...entries.map(([, value]) => value), 1);
  return <View style={styles.distribution}><Text style={styles.distributionTitle}>{title}</Text>{entries.length ? entries.map(([label, value]) => <View style={styles.row} key={label}><View style={styles.rowHead}><Text style={styles.rowLabel}>{truncate(labeler(label), 28)}</Text><Text style={styles.rowValue}>{value}</Text></View><View style={styles.track}><View style={[styles.bar, { width: `${Math.max(7, value / max * 100)}%` }]} /></View></View>) : <Text style={styles.rowLabel}>Nenhum registro</Text>}</View>;
}

function money(value: number) { return `R$ ${value.toFixed(2).replace(".", ",")}`; }
function truncate(value: string, length: number) { return value.length > length ? `${value.slice(0, length - 1)}...` : value; }
function formatDate(value: string) { return value.split("-").reverse().join("/"); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
