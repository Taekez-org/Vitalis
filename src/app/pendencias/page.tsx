"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { rotuloMotivo } from "@/servico/rotulos";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Reason = { codigo: string; acao: string; responsavel: string; campo?: string };
type Pending = { id_guia: string; motivos: Reason[]; guia?: { unidade: string; convenio: string; valor: string }; tratamento: { status: string } };

const responsibleLabel: Record<string, string> = { recepcao: "Recepção", financeiro: "Financeiro", gestao: "Gestão", tecnico: "Técnico" };

export default function PendingPage() {
  const [items, setItems] = useState<Pending[]>([]);
  const [search, setSearch] = useState("");
  const [unidade, setUnidade] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [situacao, setSituacao] = useState("ABERTA");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [frescor, setFrescor] = useState<{ dia_ultima_carga: string | null; dias_uteis_desde_ultima_carga: number | null; defasado: boolean | null } | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("busca", search);
    if (unidade) params.set("unidade", unidade);
    if (responsavel) params.set("responsavel", responsavel);
    if (situacao !== "TODAS") params.set("situacao", situacao);
    const response = await fetch(`/api/pendencias?${params}`);
    const data = await response.json() as { pendencias: Pending[]; frescor?: { dia_ultima_carga: string | null; dias_uteis_desde_ultima_carga: number | null; defasado: boolean | null } };
    setItems(data.pendencias);
    setFrescor(data.frescor ?? null);
  }, [search, unidade, responsavel, situacao]);

  useEffect(() => { void load(); }, [load]);

  async function mark(id: string) {
    await fetch(`/api/pendencias/${encodeURIComponent(id)}`, { method: "POST" });
    await load();
  }

  const exportParams = new URLSearchParams();
  if (search) exportParams.set("busca", search);
  if (unidade) exportParams.set("unidade", unidade);
  if (responsavel) exportParams.set("responsavel", responsavel);
  if (situacao !== "TODAS") exportParams.set("situacao", situacao);

  return <section className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="mb-2 text-sm font-medium text-primary">Trabalho da recepção</p><h1 className="text-3xl font-semibold tracking-tight">Pendências</h1><p className="mt-2 text-muted-foreground">Corrija na origem. Depois carregue um novo CSV para confirmar.</p></div>
      <Button variant="outline" onClick={() => void download(`/api/pendencias/csv?${exportParams.toString()}`, "pendencias-vitalis.csv")}>Baixar lista</Button>
    </div>
     {frescor?.dia_ultima_carga && <p className={frescor.defasado ? "rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm" : "text-sm text-muted-foreground"}>{frescor.defasado ? `Atenção: os dados são de ${frescor.dia_ultima_carga.split("-").reverse().join("/")}; faz ${frescor.dias_uteis_desde_ultima_carga} dias úteis sem carga.` : `Dados de ${frescor.dia_ultima_carga.split("-").reverse().join("/")}.`}</p>}
     <Card><CardContent className="flex flex-wrap items-end gap-4 pt-6"><div className="grid min-w-52 gap-2"><Label htmlFor="busca">Encontrar guia</Label><Input id="busca" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: G-2608-0030" /></div><div className="grid gap-2"><Label htmlFor="unidade">Unidade</Label><select id="unidade" className="h-10 rounded-md border bg-background px-3 text-sm" value={unidade} onChange={(event) => setUnidade(event.target.value)}><option value="">Todas</option><option>Centro</option><option>Norte</option><option>Sul</option></select></div><div className="grid gap-2"><Label htmlFor="responsavel">Responsável</Label><select id="responsavel" className="h-10 rounded-md border bg-background px-3 text-sm" value={responsavel} onChange={(event) => setResponsavel(event.target.value)}><option value="">Todos</option><option value="recepcao">Recepção</option><option value="financeiro">Financeiro</option><option value="gestao">Gestão</option></select></div><div className="grid gap-2"><Label htmlFor="situacao">Mostrar</Label><select id="situacao" className="h-10 rounded-md border bg-background px-3 text-sm" value={situacao} onChange={(event) => setSituacao(event.target.value)}><option value="ABERTA">A fazer</option><option value="AGUARDANDO_REVERIFICACAO">Aguardando reverificação</option><option value="TODAS">Todas</option></select></div><Button variant="ghost" onClick={() => { setSearch(""); setUnidade(""); setResponsavel(""); setSituacao("ABERTA"); }}>Limpar filtros</Button></CardContent></Card>
    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle>{items.length} {items.length === 1 ? "guia precisa de ação" : "guias precisam de ação"}</CardTitle><span className="text-sm text-muted-foreground">Clique em uma linha para ver detalhes</span></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Guia</TableHead><TableHead>O que fazer</TableHead><TableHead>Quem resolve</TableHead><TableHead>Situação</TableHead><TableHead className="w-28">Ação</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => <PendingRow key={item.id_guia} item={item} isOpen={expanded === item.id_guia} onToggle={() => setExpanded(expanded === item.id_guia ? null : item.id_guia)} onMark={() => void mark(item.id_guia)} />)}</TableBody></Table></div></CardContent></Card>
  </section>;
}

async function download(url: string, filename: string) { const response = await fetch(url); if (!response.ok) return; const blob = await response.blob(); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }

function PendingRow({ item, isOpen, onToggle, onMark }: { item: Pending; isOpen: boolean; onToggle: () => void; onMark: () => void }) {
  const first = item.motivos[0];
  const people = [...new Set(item.motivos.map((reason) => responsibleLabel[reason.responsavel] ?? reason.responsavel))].join(", ");
  return <>
    <TableRow className="cursor-pointer" onClick={onToggle}>
      <TableCell><strong>{item.id_guia}</strong><span className="mt-1 block text-xs text-muted-foreground">{item.guia?.unidade} · {item.guia?.convenio}</span></TableCell>
      <TableCell><span className="block max-w-md text-sm">{first?.acao}</span>{item.motivos.length > 1 && <span className="mt-1 block text-xs text-muted-foreground">+ {item.motivos.length - 1} outro problema</span>}</TableCell>
      <TableCell className="text-sm">{people}</TableCell>
      <TableCell><Badge variant={item.tratamento.status === "AGUARDANDO_REVERIFICACAO" ? "outline" : "destructive"}>{item.tratamento.status === "AGUARDANDO_REVERIFICACAO" ? "Aguardando reverificação" : "A fazer"}</Badge></TableCell>
      <TableCell><Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); onMark(); }}>Corrigi</Button></TableCell>
    </TableRow>
    {isOpen && <TableRow><TableCell colSpan={5} className="bg-muted/40"><div className="grid gap-3 py-2">{item.motivos.map((reason) => <div className="rounded-lg border bg-background p-3" key={reason.codigo}><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{rotuloMotivo(reason.codigo)}</Badge>{reason.campo && <span className="text-sm text-muted-foreground">Campo: <strong>{reason.campo}</strong></span>}</div><p className="mt-2 text-sm">{reason.acao}</p><p className="mt-1 text-xs text-muted-foreground">Resolve: {responsibleLabel[reason.responsavel] ?? reason.responsavel}</p></div>)}<p className="text-xs text-muted-foreground">O botão “Corrigi” apenas registra que a correção foi feita na origem. A guia só sai da fila depois de uma nova verificação OK.</p></div></TableCell></TableRow>}
  </>;
}
