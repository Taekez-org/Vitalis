import React from "react";
import { Document, Page, Path, renderToBuffer, Svg, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { RelatorioPeriodo } from "./relatorio";
import { rotuloMotivo } from "./rotulos";

const colors = { background: "#FAF9F3", card: "#FFFFFC", ink: "#15211B", muted: "#59665E", border: "#D6E0D8", primary: "#155A31", soft: "#E0EEE4", warning: "#F0A91C", risk: "#A83B2D", riskSoft: "#FBE6DF" };
const styles = StyleSheet.create({
  page: { backgroundColor: colors.background, color: colors.ink, fontFamily: "Helvetica", paddingBottom: 46 },
  header: { height: 116, backgroundColor: colors.primary, padding: 36, color: "#FFFFFF", flexDirection: "row", justifyContent: "space-between" },
  eyebrow: { color: colors.soft, fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1.4, marginBottom: 17 },
  title: { color: "#FFFFFF", fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 7 },
  subtitle: { color: colors.soft, fontSize: 9 },
  period: { width: 170, height: 42, backgroundColor: "#2B7047", padding: 10, marginTop: 1 },
  periodLabel: { color: colors.soft, fontSize: 7, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  periodValue: { color: "#FFFFFF", fontSize: 9, fontFamily: "Helvetica-Bold" },
  body: { paddingHorizontal: 36, paddingTop: 17 },
  generated: { color: colors.muted, fontSize: 8, marginBottom: 19 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  metric: { width: "48.8%", height: 72, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, padding: 14, marginBottom: 13 },
  metricTop: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  metricLabel: { color: colors.muted, fontSize: 9, marginLeft: 9 },
  metricValue: { color: colors.ink, fontSize: 19, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  metricCaption: { color: colors.muted, fontSize: 7.5 },
  section: { marginTop: 10 },
  sectionTitle: { color: colors.ink, fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  sectionSubtitle: { color: colors.muted, fontSize: 8.5, marginBottom: 17 },
  callout: { minHeight: 55, borderWidth: 1, padding: 14, borderLeftWidth: 4, justifyContent: "center" },
  calloutTitle: { color: colors.ink, fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  calloutText: { color: colors.muted, fontSize: 8, marginBottom: 3 },
  columns: { flexDirection: "row", justifyContent: "space-between" },
  distribution: { width: "31.5%", minHeight: 155, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, padding: 12 },
  distributionTitle: { color: colors.ink, fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 15 },
  row: { marginBottom: 9 },
  rowHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  rowLabel: { color: colors.muted, fontSize: 7.5, maxWidth: 112 },
  rowValue: { color: colors.ink, fontSize: 8, fontFamily: "Helvetica-Bold" },
  track: { height: 5, backgroundColor: colors.soft },
  bar: { height: 5, backgroundColor: colors.primary },
  bottomGrid: { flexDirection: "row", justifyContent: "space-between", marginTop: 25 },
  bottomCard: { width: "48.8%", height: 72, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, padding: 14 },
  footer: { position: "absolute", left: 36, right: 36, bottom: 20, borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footerText: { color: colors.muted, fontSize: 7 },
});

type IconName = "check" | "alert" | "money" | "shield";
const icons: Record<IconName, string> = { check: "M9 12l2 2 4-4 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z", alert: "M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01", money: "M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H7", shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4" };

export async function gerarRelatorioPdf(report: RelatorioPeriodo, geradoEm: string): Promise<Buffer> {
  return renderToBuffer(<ReportDocument report={report} geradoEm={geradoEm} />);
}

function ReportDocument({ report, geradoEm }: { report: RelatorioPeriodo; geradoEm: string }) {
  const hasRisk = report.pendentes > 0;
  return <Document title="Relatorio Vitalis" author="Verificador Vitalis">
    <ReportPage report={report} geradoEm={geradoEm} page={1}>
      <View style={styles.metricGrid}>
        <Metric label="Guias verificadas" value={String(report.verificadas)} caption="Conferidas no periodo" color={colors.primary} icon="check" />
        <Metric label="Podem seguir" value={String(report.ok)} caption={report.verificadas ? `${Math.round(report.ok / report.verificadas * 100)}% liberadas` : "Sem registros"} color={colors.primary} icon="check" />
        <Metric label="Precisam de acao" value={String(report.pendentes)} caption="Pendencias no fechamento" color={colors.risk} icon="alert" />
         <Metric label="Valor em risco" value={money(report.valor_em_risco)} caption="Exposicao deduplicada por grupo" color={colors.warning} icon="money" />
         <Metric label="Glosa nao recuperavel" value={money(report.glosa_nao_recuperavel)} caption="Parcela que nao deve ser liberada alterando o CSV" color={colors.risk} icon="alert" />
         <Metric label="Glosa evitada" value={money(report.glosa_evitada)} caption="Pendencias corrigidas e aprovadas" color={colors.primary} icon="shield" />
       </View>
       <View style={styles.section}><Text style={styles.sectionTitle}>Leitura executiva</Text><Text style={styles.sectionSubtitle}>Resumo geral do fechamento operacional, sem filtro por convenio.</Text><View style={[styles.callout, { backgroundColor: hasRisk ? colors.riskSoft : colors.soft, borderColor: hasRisk ? "#DDA194" : "#B6D4BE", borderLeftColor: hasRisk ? colors.risk : colors.primary }]}><Text style={styles.calloutTitle}>{hasRisk ? `Ha ${report.pendentes} guia(s) que nao devem seguir para o convenio.` : "Nenhuma pendencia no fechamento deste periodo."}</Text><Text style={styles.calloutText}>{hasRisk ? "Priorize a correcao antes do envio." : "A operacao esta liberada para o periodo."}</Text><Text style={styles.calloutText}>Aguardando reverificacao: {report.aguardando_reverificacao}.</Text><Text style={styles.calloutText}>Valor em risco inclui todas as pendencias; glosa nao recuperavel e apenas a parcela com bloqueio tecnico ou de cobertura.</Text></View></View>
    </ReportPage>
    <ReportPage report={report} geradoEm={geradoEm} page={2}>
       <View style={styles.section}><Text style={styles.sectionTitle}>Onde esta o risco</Text><Text style={styles.sectionSubtitle}>Uma exposicao por grupo de paciente, data e procedimento; duplicidades e conflitos de autorizacao nao somam novamente.</Text><View style={styles.columns}><Distribution title="Por motivo" values={report.por_codigo} labeler={rotuloMotivo} /><Distribution title="Por convenio" values={report.por_convenio} labeler={(value) => value} /><Distribution title="Por unidade" values={report.por_unidade} labeler={(value) => value} /></View></View>
       <View style={styles.section}><Text style={styles.sectionTitle}>Valor em risco por convenio</Text><Text style={styles.sectionSubtitle}>Visao financeira geral por convenio, sem aplicar o filtro selecionado no dashboard.</Text><View style={styles.columns}><Distribution title="Exposicao financeira" values={report.risco_por_convenio ?? {}} labeler={(value) => value} valueFormatter={money} /></View></View>
      <View style={styles.bottomGrid}><Metric compact label="Glosa evitada" value={money(report.glosa_evitada)} caption="Pendencias corrigidas e aprovadas" color={colors.primary} icon="shield" /><Metric compact label="Aguardando reverificacao" value={String(report.aguardando_reverificacao)} caption="Pendentes de nova carga" color={colors.warning} icon="alert" /></View>
    </ReportPage>
  </Document>;
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

function Distribution({ title, values, labeler, valueFormatter = (value) => String(value) }: { title: string; values: Record<string, number>; labeler: (value: string) => string; valueFormatter?: (value: number) => string }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
  const max = Math.max(...entries.map(([, value]) => value), 1);
  return <View style={styles.distribution}><Text style={styles.distributionTitle}>{title}</Text>{entries.length ? entries.map(([label, value]) => <View style={styles.row} key={label}><View style={styles.rowHead}><Text style={styles.rowLabel}>{truncate(labeler(label), 28)}</Text><Text style={styles.rowValue}>{valueFormatter(value)}</Text></View><View style={styles.track}><View style={[styles.bar, { width: `${Math.max(7, value / max * 100)}%` }]} /></View></View>) : <Text style={styles.rowLabel}>Nenhum registro</Text>}</View>;
}

function money(value: number) { return `R$ ${value.toFixed(2).replace(".", ",")}`; }
function truncate(value: string, length: number) { return value.length > length ? `${value.slice(0, length - 1)}...` : value; }
function formatDate(value: string) { return value.split("-").reverse().join("/"); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
