"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { rotuloMotivo } from "@/servico/rotulos";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FreshnessNotice, PageHeader } from "@/components/ui/page-header";
import { classificarPendencia, type PendenciaClassificacao } from "@/servico/classificacao-pendencia";

type Reason = { codigo: string; acao: string; responsavel: string; campo?: string; detalhe?: Record<string, unknown> };
type Pending = { id_guia: string; status_verificacao: "PENDENTE"; motivos: Reason[]; guia?: { unidade: string; convenio: string; valor: string }; tratamento: { status: string } };

const responsibleLabel: Record<string, string> = { recepcao: "Recepção", financeiro: "Financeiro", gestao: "Gestão", tecnico: "Técnico" };

export default function PendingPage() {
  const [items, setItems] = useState<Pending[]>([]);
  const [search, setSearch] = useState("");
  const [unidade, setUnidade] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [situacao, setSituacao] = useState("TODAS");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [frescor, setFrescor] = useState<{ dia_ultima_carga: string | null; dias_uteis_desde_ultima_carga: number | null; defasado: boolean | null } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("busca", search);
    if (unidade) params.set("unidade", unidade);
    if (responsavel) params.set("responsavel", responsavel);
    if (situacao !== "TODAS") params.set("situacao", situacao);
    params.set("ts", String(Date.now()));
    try {
      const response = await fetch(`/api/pendencias?${params}`, { cache: "no-store" });
      const data = await response.json() as { pendencias?: Pending[]; frescor?: { dia_ultima_carga: string | null; dias_uteis_desde_ultima_carga: number | null; defasado: boolean | null } };
      if (!response.ok || !data.pendencias) return;
      setItems(data.pendencias);
      setFrescor(data.frescor ?? null);
    } finally {
      setLoading(false);
    }
  }, [search, unidade, responsavel, situacao]);

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 15000); return () => window.clearInterval(timer); }, [load]);

  async function mark(id: string) {
    const response = await fetch(`/api/pendencias/${encodeURIComponent(id)}`, { method: "POST" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { mensagem?: string };
      window.alert(data.mensagem ?? "Não foi possível registrar a correção.");
      return;
    }
    await load();
  }

  const exportParams = new URLSearchParams();
  if (search) exportParams.set("busca", search);
  if (unidade) exportParams.set("unidade", unidade);
  if (responsavel) exportParams.set("responsavel", responsavel);
  if (situacao !== "TODAS") exportParams.set("situacao", situacao);

   return <section className="space-y-7">
     <PageHeader eyebrow="Trabalho da recepção" title="Pendências" description="Corrija na origem. Depois carregue um novo CSV para confirmar." actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}>{loading ? "Atualizando..." : "Atualizar"}</Button><Button variant="outline" onClick={() => void download(`/api/pendencias/csv?${exportParams.toString()}`, "pendencias-vitalis.csv")}>Baixar lista</Button></div>} />
     <FreshnessNotice data={frescor} />
      <Card className="shadow-card"><CardHeader><CardTitle className="text-base">Encontre o que precisa de ação</CardTitle><p className="text-sm text-muted-foreground">A fila mostra toda guia tecnicamente pendente. O tratamento indica o próximo passo.</p></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap items-end gap-4"><div className="grid min-w-52 gap-2"><Label htmlFor="busca">Número da guia</Label><Input id="busca" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: G-2608-0030" /></div><div className="grid gap-2"><Label htmlFor="unidade">Unidade</Label><select id="unidade" className="h-10 rounded-lg border bg-background px-3 text-sm" value={unidade} onChange={(event) => setUnidade(event.target.value)}><option value="">Todas</option><option>Centro</option><option>Norte</option><option>Sul</option></select></div><div className="grid gap-2"><Label htmlFor="responsavel">Responsável</Label><select id="responsavel" className="h-10 rounded-lg border bg-background px-3 text-sm" value={responsavel} onChange={(event) => setResponsavel(event.target.value)}><option value="">Todos</option><option value="recepcao">Recepção</option><option value="financeiro">Financeiro</option><option value="gestao">Gestão</option><option value="tecnico">Técnico</option></select></div><div className="grid gap-2"><Label htmlFor="situacao">Situação</Label><select id="situacao" className="h-10 rounded-lg border bg-background px-3 text-sm" value={situacao} onChange={(event) => setSituacao(event.target.value)}><option value="TODAS">Todas as pendências técnicas</option><option value="ABERTA">A fazer</option><option value="EM_TRATAMENTO">Em tratamento</option><option value="AGUARDANDO_REVERIFICACAO">Aguardando reverificação</option></select></div><Button variant="ghost" onClick={() => { setSearch(""); setUnidade(""); setResponsavel(""); setSituacao("TODAS"); }}>Limpar filtros</Button></div><div className="flex flex-wrap gap-2 border-t pt-4 text-xs text-muted-foreground"><ClassificationBadge classification="nao_recuperavel" /><span>bloqueio técnico ou de cobertura</span><ClassificationBadge classification="recuperavel" /><span>corrigir e reenviar</span><ClassificationBadge classification="decisao_pre_envio" /><span>decidir antes do envio; não é glosa automática</span></div></CardContent></Card>
     <Card className="shadow-card"><CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><CardTitle>{items.length} {items.length === 1 ? "guia precisa de ação" : "guias precisam de ação"}</CardTitle><p className="mt-1 text-sm text-muted-foreground">Clique em uma linha para ver detalhes e orientar a correção.</p></div><span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fila operacional</span></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Guia</TableHead><TableHead>O que fazer</TableHead><TableHead>Quem resolve</TableHead><TableHead>Situação</TableHead><TableHead className="w-28">Ação</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => <PendingRow key={item.id_guia} item={item} isOpen={expanded === item.id_guia} onToggle={() => setExpanded(expanded === item.id_guia ? null : item.id_guia)} onMark={() => void mark(item.id_guia)} />)}</TableBody></Table></div></CardContent></Card>
  </section>;
}

async function download(url: string, filename: string) { const response = await fetch(url); if (!response.ok) return; const blob = await response.blob(); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }

function PendingRow({ item, isOpen, onToggle, onMark }: { item: Pending; isOpen: boolean; onToggle: () => void; onMark: () => void }) {
  const first = item.motivos[0];
  const people = [...new Set(item.motivos.map((reason) => responsibleLabel[reason.responsavel] ?? reason.responsavel))].join(", ");
  const classification = classificarPendencia(item.motivos.map((reason) => reason.codigo));
  return <>
    <TableRow className="cursor-pointer" onClick={onToggle}>
      <TableCell><strong>{item.id_guia}</strong><span className="mt-1 block text-xs text-muted-foreground">{item.guia?.unidade} · {item.guia?.convenio}</span></TableCell>
      <TableCell><div className="flex max-w-md flex-wrap items-center gap-2"><ClassificationBadge classification={classification} /><span className="text-sm">{first?.acao}</span></div>{item.motivos.length > 1 && <span className="mt-1 block text-xs text-muted-foreground">+ {item.motivos.length - 1} outro problema</span>}</TableCell>
      <TableCell className="text-sm">{people}</TableCell>
       <TableCell><Badge variant={item.tratamento.status === "AGUARDANDO_REVERIFICACAO" ? "outline" : "destructive"}>{treatmentLabel(item.tratamento.status)}</Badge><span className="mt-1 block text-xs text-muted-foreground">Verificação: Pendente</span></TableCell>
      <TableCell><Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); onMark(); }}>Corrigi</Button></TableCell>
    </TableRow>
      {isOpen && <TableRow><TableCell colSpan={5} className="bg-surface-subtle"><div className="grid gap-3 py-2"><div><ClassificationBadge classification={classification} /><p className="mt-2 text-xs text-muted-foreground">{classificationDescription(classification)}</p></div>{item.motivos.map((reason) => <div className="rounded-xl border bg-card p-4 shadow-sm" key={reason.codigo}><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{rotuloMotivo(reason.codigo)}</Badge>{reason.campo && <span className="text-sm text-muted-foreground">Campo: <strong>{reason.campo}</strong></span>}</div><p className="mt-2 text-sm">{reason.acao}</p><p className="mt-1 text-xs text-muted-foreground">Resolve: {responsibleLabel[reason.responsavel] ?? reason.responsavel}</p></div>)}<p className="text-xs text-muted-foreground">O botão “Corrigi” apenas registra que a correção foi feita na origem. A guia só sai da fila depois de uma nova verificação OK.</p></div></TableCell></TableRow>}
  </>;
}

function ClassificationBadge({ classification }: { classification: PendenciaClassificacao }) {
  const labels: Record<PendenciaClassificacao, string> = { nao_recuperavel: "Risco: glosa não recuperável", recuperavel: "Risco potencialmente recuperável", decisao_pre_envio: "Decisão antes do envio" };
  const classes: Record<PendenciaClassificacao, string> = { nao_recuperavel: "border-risk/30 bg-risk/10 text-risk", recuperavel: "border-warning/40 bg-warning/15 text-warning-foreground", decisao_pre_envio: "border-border bg-surface-subtle text-muted-foreground" };
  return <Badge variant="outline" className={classes[classification]}>{labels[classification]}</Badge>;
}

function classificationDescription(classification: PendenciaClassificacao) {
  return { nao_recuperavel: "Este bloqueio não é liberado apenas alterando o CSV; exige autorização/cobertura válida ou decisão formal.", recuperavel: "Há uma correção de dado ou cadastro que pode permitir nova verificação, sem aprovação automática.", decisao_pre_envio: "É uma decisão operacional antes do envio e não entra automaticamente como glosa não recuperável." }[classification];
}

function treatmentLabel(status: string) {
  return { ABERTA: "A fazer", EM_TRATAMENTO: "Em tratamento", AGUARDANDO_REVERIFICACAO: "Aguardando reverificação" }[status] ?? status;
}
