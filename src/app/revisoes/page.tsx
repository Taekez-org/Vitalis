"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Revision = { id_guia: string; chave: string; status: "ABERTA" | "RESOLVIDA"; origem: "groq" | "nao_lida"; classe: string; sinais: string[]; motivo?: string; criada_em: string; resolvida_em?: string };

export default function RevisionsPage() {
  const [items, setItems] = useState<Revision[]>([]);
  const [message, setMessage] = useState("");
  async function load() { const response = await fetch("/api/revisoes", { cache: "no-store" }); if (!response.ok) { setMessage("Não foi possível carregar as revisões."); return; } const data = await response.json() as { revisoes: Revision[] }; setItems(data.revisoes); }
  useEffect(() => { void load(); }, []);
  async function resolve(item: Revision) { const response = await fetch(`/api/revisoes/${encodeURIComponent(item.id_guia)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chave: item.chave }) }); setMessage(response.ok ? "Revisão resolvida." : "Não foi possível resolver a revisão."); await load(); }
  const open = items.filter((item) => item.status === "ABERTA");
  return <section className="space-y-6"><div><p className="mb-2 text-sm font-medium text-primary">Leitura assistida</p><h1 className="text-3xl font-semibold tracking-tight">Revisões</h1><p className="mt-2 max-w-2xl text-muted-foreground">Alertas sobre observações que merecem leitura humana. Resolver uma revisão não altera o resultado determinístico da guia.</p></div><p className="min-h-6 text-sm" role="status">{message}</p><Card><CardHeader><CardTitle>{open.length} {open.length === 1 ? "revisão aberta" : "revisões abertas"}</CardTitle></CardHeader><CardContent className="space-y-3">{open.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma revisão aberta.</p> : open.map((item) => <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between" key={`${item.id_guia}:${item.chave}`}><div><div className="flex flex-wrap items-center gap-2"><strong>{item.id_guia}</strong><Badge variant="outline">{item.origem === "nao_lida" ? "Não lida" : "Groq"}</Badge><Badge variant="secondary">{item.classe}</Badge></div><p className="mt-2 text-sm">{item.motivo ?? "Leia a observação no sistema de gestão."}</p><p className="mt-1 text-xs text-muted-foreground">Criada em {new Date(item.criada_em).toLocaleString("pt-BR")}</p></div><Button variant="outline" onClick={() => void resolve(item)}>Resolver revisão</Button></div>)}</CardContent></Card></section>;
}
