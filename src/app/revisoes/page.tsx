"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

type Revision = { id_guia: string; chave: string; status: "ABERTA" | "RESOLVIDA"; origem: "groq" | "nao_lida"; classe: string; sinais: string[]; motivo?: string; criada_em: string; resolvida_em?: string };

export default function RevisionsPage() {
  const [items, setItems] = useState<Revision[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function load() { setLoading(true); const response = await fetch(`/api/revisoes?ts=${Date.now()}`, { cache: "no-store" }); if (!response.ok) { setMessage("Não foi possível carregar as revisões."); setLoading(false); return; } const data = await response.json() as { revisoes: Revision[] }; setItems(data.revisoes); setLoading(false); }
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 15000); return () => window.clearInterval(timer); }, []);
  async function resolve(item: Revision) { const response = await fetch(`/api/revisoes/${encodeURIComponent(item.id_guia)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chave: item.chave }) }); setMessage(response.ok ? "Revisão resolvida." : "Não foi possível resolver a revisão."); await load(); }
  const open = items.filter((item) => item.status === "ABERTA");
  return <section className="space-y-7"><PageHeader eyebrow="Leitura assistida" title="Revisões" description="Alertas sobre observações que merecem leitura humana. Cada alerta explica o ponto encontrado; resolver não altera o resultado determinístico da guia." actions={<Button variant="outline" onClick={() => void load()} disabled={loading}>{loading ? "Atualizando..." : "Atualizar"}</Button>} /><p className="min-h-6 text-sm" role="status">{message}</p><Card className="shadow-card"><CardHeader><CardTitle>{open.length} {open.length === 1 ? "revisão aberta" : "revisões abertas"}</CardTitle><p className="text-sm text-muted-foreground">A IA aponta o problema e a equipe decide o tratamento. Atualização automática a cada 15 segundos.</p></CardHeader><CardContent className="space-y-3">{open.length === 0 ? <div className="rounded-xl border border-success/15 bg-success/5 p-5 text-sm text-muted-foreground">Nenhuma revisão aberta.</div> : open.map((item) => <div className="flex flex-col gap-4 rounded-xl border bg-surface-subtle p-4 sm:flex-row sm:items-center sm:justify-between" key={`${item.id_guia}:${item.chave}`}><div><div className="flex flex-wrap items-center gap-2"><strong>{item.id_guia}</strong><Badge variant="outline">{item.origem === "nao_lida" ? "Não lida" : "IA"}</Badge><Badge variant="secondary">{item.classe}</Badge></div><p className="mt-2 text-sm font-medium leading-6">{item.motivo}</p><p className="mt-1 text-xs text-muted-foreground">Ação: conferir a observação na origem e decidir antes do faturamento. Criada em {new Date(item.criada_em).toLocaleString("pt-BR")}</p></div><Button variant="outline" onClick={() => void resolve(item)}>Resolver revisão</Button></div>)}</CardContent></Card></section>;
}
