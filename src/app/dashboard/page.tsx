"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Download, FileCheck2, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { rotuloMotivo } from "@/servico/rotulos";

type Freshness = { dia_ultima_carga: string | null; dias_uteis_desde_ultima_carga: number | null; defasado: boolean | null };
type Dashboard = { inicio: string; fim: string; verificadas: number; ok: number; pendentes: number; valor_em_risco: number; glosa_evitada: number; aguardando_reverificacao: number; por_codigo: Record<string, number>; por_unidade: Record<string, number>; frescor: Freshness; ultima_carga?: { createdAt: string } };

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [inicio, setInicio] = useState(today());
  const [fim, setFim] = useState(today());
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/dashboard?inicio=${inicio}&fim=${fim}`, { cache: "no-store" });
        const body = await response.json() as Dashboard & { mensagem?: string };
        if (!response.ok) throw new Error(body.mensagem ?? "Não foi possível carregar o Dashboard.");
        setData(body);
        setError("");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar o Dashboard.");
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [inicio, fim]);

  if (error) return <section className="space-y-4"><PageIntro /><div className="rounded-2xl border border-risk/20 bg-risk/5 p-5 text-sm text-risk"><strong>Dashboard indisponível.</strong><p className="mt-1">{error}</p></div></section>;
  if (!data) return <section className="space-y-6"><PageIntro /><div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground shadow-card">Carregando os números da operação...</div></section>;

  const topReasons = Object.entries(data.por_codigo).sort(([, a], [, b]) => b - a).slice(0, 3);
  const percentualOk = data.verificadas ? Math.round((data.ok / data.verificadas) * 100) : 0;

  return <section className="space-y-7">
    <PageIntro />
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-card sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Período da leitura</p><div className="mt-2 flex flex-wrap items-center gap-2"><input aria-label="Data inicial" className="h-10 rounded-lg border bg-background px-3 text-sm" type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} /><span className="text-sm text-muted-foreground">até</span><input aria-label="Data final" className="h-10 rounded-lg border bg-background px-3 text-sm" type="date" value={fim} onChange={(event) => setFim(event.target.value)} /></div></div>
      <Button variant="outline" onClick={() => void download(`/api/relatorio/pdf?inicio=${inicio}&fim=${fim}`, `relatorio-vitalis-${inicio}-${fim}.pdf`)}><Download />Baixar relatório</Button>
    </div>
    <Freshness data={data.frescor} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard icon={<FileCheck2 />} label="Guias verificadas" value={String(data.verificadas)} caption={`${percentualOk}% liberadas`} tone="neutral" />
      <MetricCard icon={<CheckCircle2 />} label="Podem seguir" value={String(data.ok)} caption="Sem pendência encontrada" tone="success" />
      <MetricCard icon={<ShieldAlert />} label="Precisam de ação" value={String(data.pendentes)} caption="Ainda não enviar ao convênio" tone="risk" />
    </div>
    <div className="grid gap-4 lg:grid-cols-2"><FinancialCard label="Valor em risco" value={money(data.valor_em_risco)} caption="Estimativa das guias que ainda podem virar glosa" tone="risk" /><FinancialCard label="Valor de glosa evitada" value={money(data.glosa_evitada)} caption="Guias que voltaram para OK após correção" tone="success" /></div>
    <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
      <Card className="shadow-card"><CardHeader><CardTitle>O que precisa de atenção</CardTitle><CardDescription>Os motivos que mais aparecem nas guias pendentes.</CardDescription></CardHeader><CardContent className="space-y-4">{topReasons.length ? topReasons.map(([label, value]) => <div className="flex items-center gap-3" key={label}><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-risk/10 text-risk"><AlertTriangle className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{rotuloMotivo(label)}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-subtle"><div className="h-full rounded-full bg-risk" style={{ width: `${Math.max((value / Math.max(...Object.values(data.por_codigo))) * 100, 8)}%` }} /></div></div><strong className="text-sm text-muted-foreground">{value}</strong></div>) : <p className="text-sm text-muted-foreground">Nenhuma pendência no período.</p>}<Button variant="link" className="px-0" asChild><Link href="/pendencias">Abrir fila de pendências <ArrowRight /></Link></Button></CardContent></Card>
      <Card className="border-primary/15 bg-primary/[0.04] shadow-card"><CardHeader><CardTitle>Leitura rápida</CardTitle><CardDescription>O número que importa para a reunião.</CardDescription></CardHeader><CardContent><p className="text-4xl font-semibold tracking-tight text-primary">{percentualOk}%</p><p className="mt-2 text-sm leading-6 text-muted-foreground">das guias do período passaram na conferência e podem seguir para o faturamento.</p><div className="mt-6 flex items-center gap-2 border-t border-primary/10 pt-4 text-sm text-muted-foreground"><Clock3 className="size-4" />Atualização automática a cada 5 segundos</div></CardContent></Card>
    </div>
    <div className="space-y-6"><Chart title="Pendências por motivo" values={data.por_codigo} labeler={rotuloMotivo} /><Chart title="Pendências por unidade" values={data.por_unidade} /></div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-sm text-muted-foreground"><span>Última carga: {data.ultima_carga ? new Date(data.ultima_carga.createdAt).toLocaleString("pt-BR") : "nenhuma"}</span><span>Também aguardando reverificação: <strong className="text-foreground">{data.aguardando_reverificacao}</strong></span></div>
  </section>;
}

function PageIntro() { return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Visão executiva</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Dashboard</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Uma leitura simples do que foi conferido, do que pode seguir e do dinheiro que ainda está exposto.</p></div><Button variant="ghost" size="sm" onClick={() => window.location.reload()}><RefreshCw />Atualizar</Button></div>; }
function MetricCard({ icon, label, value, caption, tone }: { icon: React.ReactNode; label: string; value: string; caption: string; tone: "neutral" | "success" | "risk" | "warning" }) { const styles = { neutral: "bg-surface-subtle text-foreground", success: "bg-success/10 text-success", risk: "bg-risk/10 text-risk", warning: "bg-warning/15 text-warning-foreground" }; return <Card className="shadow-card"><CardContent className="p-5"><div className={`mb-5 flex size-9 items-center justify-center rounded-xl ${styles[tone]}`}>{icon}</div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-xs text-muted-foreground">{caption}</p></CardContent></Card>; }
function FinancialCard({ label, value, caption, tone }: { label: string; value: string; caption: string; tone: "risk" | "success" }) { const styles = tone === "risk" ? "border-risk/20 bg-risk/[0.04] text-risk" : "border-success/20 bg-success/[0.04] text-success"; return <Card className={`shadow-card ${styles}`}><CardContent className="p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-2 max-w-sm text-sm text-muted-foreground">{caption}</p></div><span className="rounded-full bg-background/70 px-3 py-1 text-xs font-semibold">Financeiro</span></div></CardContent></Card>; }
function Freshness({ data }: { data: Freshness }) { if (!data.dia_ultima_carga) return null; const day = data.dia_ultima_carga.split("-").reverse().join("/"); return <div className={data.defasado ? "flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning-foreground" : "flex items-center gap-2 rounded-xl border border-success/15 bg-success/5 p-4 text-sm text-muted-foreground"}><Clock3 className="mt-0.5 size-4 shrink-0" />{data.defasado ? `Atenção: os dados são de ${day}; faz ${data.dias_uteis_desde_ultima_carga} dias úteis sem carga.` : `Dados atualizados em ${day}.`}</div>; }
function Chart({ title, values, labeler = (value) => value }: { title: string; values: Record<string, number>; labeler?: (value: string) => string }) { const max = Math.max(...Object.values(values), 1); return <Card className="shadow-card"><CardHeader><CardTitle>{title}</CardTitle><CardDescription>Quantidade de guias afetadas</CardDescription></CardHeader><CardContent className="space-y-4">{Object.entries(values).sort(([, a], [, b]) => b - a).map(([label, value]) => <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(6rem,2fr)_30px] items-center gap-3 text-sm" key={label}><span className="break-words leading-5">{labeler(label)}</span><div className="h-2.5 overflow-hidden rounded-full bg-surface-subtle"><i className="block h-full rounded-full bg-primary" style={{ width: `${(value / max) * 100}%` }} /></div><b className="text-right">{value}</b></div>)}{!Object.keys(values).length && <p className="text-sm text-muted-foreground">Nenhum registro no período.</p>}</CardContent></Card>; }
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function money(value: number) { return `R$ ${value.toFixed(2).replace(".", ",")}`; }
async function download(url: string, filename: string) { const response = await fetch(url); if (!response.ok) return; const blob = await response.blob(); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }
