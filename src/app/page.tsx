"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, FileUp, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { rotuloMotivo } from "@/servico/rotulos";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Result = { id_guia: string; status: string; motivos: { codigo: string }[]; valor: number | null };
type Summary = { verificadas: number; ok: number; pendentes: number; valor_em_risco: number };

export default function GuidesPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState("");

  async function upload(file: File, ref?: string) {
    setMessage("Verificando lote...");
    const response = await fetch(`/api/lote${ref ? `?ref=${ref}` : ""}`, { method: "POST", body: await file.text(), headers: { "Content-Type": "text/csv", "x-file-name": file.name } });
    const data = await response.json() as { resultados?: Result[]; erro?: string; ja_carregado?: boolean; resumo?: { verificadas: number; ok: number; pendentes: number; valor_em_risco: number; data_referencia?: string; origem_data_referencia?: string } };
    if (!response.ok || !data.resultados || !data.resumo) { setMessage(`Erro: ${data.erro ?? "CSV inválido"}`); return; }
    setResults(data.resultados);
    setSummary(data.resumo);
    setMessage(data.ja_carregado ? "Este arquivo já foi carregado. Nada mudou." : `${data.resumo.verificadas} verificadas, ${data.resumo.ok} OK, ${data.resumo.pendentes} pendentes, R$ ${data.resumo.valor_em_risco.toFixed(2).replace(".", ",")}`);
  }

  async function demo() {
    const response = await fetch("/api/demo");
    const blob = await response.blob();
    await upload(new File([blob], "guias-agosto.csv", { type: "text/csv" }), "2026-08-31");
  }

  return <section className="space-y-7">
    <PageHeader eyebrow="Entrada operacional" title="Guias" description="Carregue o lote exportado do sistema de gestão e descubra o que precisa ser corrigido antes do faturamento." />
    <Card className="overflow-hidden border-primary/20 shadow-card"><CardHeader className="bg-primary/[0.04] pb-4"><div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><FileUp className="size-5" /></div><div><CardTitle className="text-lg">Nova carga de guias</CardTitle><p className="mt-1 text-sm leading-6 text-muted-foreground">Use o CSV exportado pela gestão. A ferramenta confere o lote e a equipe corrige os dados na origem.</p></div></div></CardHeader><CardContent className="grid gap-4 p-6 sm:grid-cols-[1fr_auto] sm:items-end"><div className="grid gap-2"><Label htmlFor="csv">Arquivo CSV</Label><Input id="csv" className="h-11 bg-background" type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /><p className="text-xs text-muted-foreground">A mesma carga não é processada duas vezes.</p></div><Button variant="outline" className="h-11" onClick={() => void demo()}>Carregar demonstração <ArrowRight /></Button></CardContent></Card>
    <p className={`min-h-5 text-sm ${message.startsWith("Erro") ? "text-risk" : "text-muted-foreground"}`} role="status">{message}</p>
    {summary && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SummaryCard icon={<FileUp />} label="Verificadas" value={String(summary.verificadas)} /><SummaryCard icon={<CheckCircle2 />} label="Podem seguir" value={String(summary.ok)} tone="success" /><SummaryCard icon={<ShieldAlert />} label="Precisam de ação" value={String(summary.pendentes)} tone="risk" /><SummaryCard label="Valor em risco" value={`R$ ${summary.valor_em_risco.toFixed(2).replace(".", ",")}`} tone="warning" /></div>}
    {results.length > 0 && <Card className="shadow-card"><CardHeader><CardTitle>Resultado desta carga</CardTitle><p className="text-sm text-muted-foreground">Abra Pendências para orientar a correção e acompanhar a fila.</p></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Guia</TableHead><TableHead>Status</TableHead><TableHead>Motivos</TableHead><TableHead>Valor</TableHead></TableRow></TableHeader><TableBody>{results.map((result) => <TableRow key={result.id_guia}><TableCell className="font-medium">{result.id_guia}</TableCell><TableCell><Badge variant={result.status === "OK" ? "outline" : "destructive"}>{result.status === "OK" ? "Pode seguir" : "Precisa de ação"}</Badge></TableCell><TableCell className="max-w-xl">{result.motivos.map((reason) => rotuloMotivo(reason.codigo)).join(", ") || "Nenhum problema"}</TableCell><TableCell>R$ {(result.valor ?? 0).toFixed(2).replace(".", ",")}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>}
    <Card className="border-border/70 bg-surface-subtle shadow-none"><CardContent className="grid gap-5 p-6 sm:grid-cols-3"><Step number="01" title="Exporte" text="Tire o CSV do sistema de gestão." /><Step number="02" title="Carregue" text="A conferência aplica as regras dos convênios." /><Step number="03" title="Corrija" text="A equipe ajusta a origem e reenvia o lote." /></CardContent></Card>
  </section>;
}

function SummaryCard({ icon, label, value, tone = "neutral" }: { icon?: React.ReactNode; label: string; value: string; tone?: "neutral" | "success" | "risk" | "warning" }) { const styles = { neutral: "bg-surface-subtle text-foreground", success: "bg-success/10 text-success", risk: "bg-risk/10 text-risk", warning: "bg-warning/15 text-warning-foreground" }; return <Card className="shadow-card"><CardContent className="p-5"><div className={`mb-4 flex size-9 items-center justify-center rounded-xl ${styles[tone]}`}>{icon ?? <span className="text-xs font-bold">R$</span>}</div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p></CardContent></Card>; }
function Step({ number, title, text }: { number: string; title: string; text: string }) { return <div><p className="text-xs font-semibold tracking-[0.16em] text-primary">{number}</p><p className="mt-2 text-sm font-semibold">{title}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{text}</p></div>; }
