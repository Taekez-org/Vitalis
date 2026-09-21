"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { rotuloMotivo } from "@/servico/rotulos";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Result = { id_guia: string; status: string; motivos: { codigo: string }[]; valor: number | null };

export default function GuidesPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [message, setMessage] = useState("");

  async function upload(file: File, ref?: string) {
    setMessage("Verificando lote...");
    const response = await fetch(`/api/lote${ref ? `?ref=${ref}` : ""}`, { method: "POST", body: await file.text(), headers: { "Content-Type": "text/csv", "x-file-name": file.name } });
    const data = await response.json() as { resultados?: Result[]; erro?: string; ja_carregado?: boolean; resumo?: { verificadas: number; ok: number; pendentes: number; valor_em_risco: number; data_referencia?: string; origem_data_referencia?: string } };
    if (!response.ok || !data.resultados || !data.resumo) { setMessage(`Erro: ${data.erro ?? "CSV inválido"}`); return; }
    setResults(data.resultados);
    setMessage(data.ja_carregado ? "Este arquivo já foi carregado. Nada mudou." : `${data.resumo.verificadas} verificadas, ${data.resumo.ok} OK, ${data.resumo.pendentes} pendentes, R$ ${data.resumo.valor_em_risco.toFixed(2).replace(".", ",")}`);
  }

  async function demo() {
    const response = await fetch("/api/demo");
    const blob = await response.blob();
    await upload(new File([blob], "guias-agosto.csv", { type: "text/csv" }), "2026-08-31");
  }

  return <section className="space-y-6">
    <div><p className="mb-3 text-sm font-medium text-primary">Conferência antes do faturamento</p><h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Menos glosa.<br /><span className="text-primary">Mais controle.</span></h1><p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">Carregue as guias exportadas do sistema de gestão e descubra o que precisa ser corrigido antes de enviar ao convênio.</p></div>
    <Card className="overflow-hidden border-primary/15 shadow-sm"><CardHeader className="bg-primary/[0.04] pb-4"><CardTitle className="text-lg">Nova carga de guias</CardTitle><p className="text-sm text-muted-foreground">CSV com as colunas do sistema de gestão. A correção acontece na origem.</p></CardHeader><CardContent className="flex flex-wrap items-end gap-4 pt-6"><div className="grid min-w-72 gap-2"><Label htmlFor="csv">Arquivo CSV</Label><Input id="csv" className="bg-background" type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></div><Button variant="outline" onClick={() => void demo()}>Carregar demonstração</Button></CardContent></Card>
    <p className="min-h-6 text-sm" role="status">{message}</p>
    {results.length > 0 && <Card><CardHeader><CardTitle>Resultado do lote</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Guia</TableHead><TableHead>Status</TableHead><TableHead>Motivos</TableHead><TableHead>Valor</TableHead></TableRow></TableHeader><TableBody>{results.map((result) => <TableRow key={result.id_guia}><TableCell className="font-medium">{result.id_guia}</TableCell><TableCell><Badge variant={result.status === "OK" ? "outline" : "destructive"}>{result.status}</Badge></TableCell><TableCell>{result.motivos.map((reason) => rotuloMotivo(reason.codigo)).join(", ") || "Nenhum problema"}</TableCell><TableCell>R$ {(result.valor ?? 0).toFixed(2).replace(".", ",")}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>}
  </section>;
}
