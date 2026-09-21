import type { ListaPendencias, PendenciaItem } from "../servico/pendencias";

function date(value?: string): string {
  return value ? value.split("-").reverse().join("/") : "";
}

function plural(value: number, singular: string, pluralValue: string): string {
  return `${value} ${value === 1 ? singular : pluralValue}`;
}

export function formatarLista(result: ListaPendencias, filtro: { responsavel?: string; limite?: number }): string {
  if (!result.data_ultima_carga && result.total === 0) return "Nenhuma guia foi verificada ainda. Carregue o lote em Lote.";
  if (result.total === 0) return `Nenhuma guia precisa de ajuste. Dados de ${date(result.frescor.dia_ultima_carga ?? "")}.`;
  const lines = ["O que precisamos ajustar?", `${plural(result.total_do_responsavel, "guia com ajuste", "guias com ajuste")} · dados de ${date(result.frescor.dia_ultima_carga ?? "")}`];
  if (result.frescor.defasado) lines.push(`Atenção: os dados são de ${date(result.frescor.dia_ultima_carga ?? "")}; faz ${result.frescor.dias_uteis_desde_ultima_carga} dias úteis sem carga. Carregue o lote do dia em Lote.`);
  for (const item of result.itens) lines.push(`- ${item.id_guia} — ${[...new Set(item.erros.map((error) => error.resumo))].join("; ")}`);
  const responsavel = filtro.responsavel && filtro.responsavel !== "todos" ? filtro.responsavel : undefined;
  if (responsavel) {
    const others = (result.contagens.todas ?? 0) - (result.contagens[responsavel] ?? 0);
    if (others > 0) lines.push(`Mais ${plural(others, "guia depende", "guias dependem")} do financeiro ou da gestão.`);
  }
  if (result.itens.length < result.total) lines.push(`Mostrando ${result.itens.length} de ${result.total}. Peça por unidade ou convênio para ver as demais.`);
  lines.push("Para saber como resolver, diga o número da guia.");
  return lines.join("\n");
}

export function formatarDetalhe(item: PendenciaItem | undefined, id: string): string {
  if (!item) return `${id} não está na lista de ajustes.`;
  const lines = [`${item.id_guia} — ${item.convenio} · ${item.unidade}`, `Prazo de envio: ${item.prazo_limite ? date(item.prazo_limite) : "sem prazo calculado"}`];
  item.erros.forEach((error, index) => {
    lines.push(`${index + 1}. ${error.resumo}`);
    lines.push(`   Como resolver: ${error.acao}`);
    lines.push(`   Quem resolve: ${error.responsavel}`);
    if (typeof error.detalhe?.observacao_convenio === "string") lines.push(`   Regra do convênio: ${error.detalhe.observacao_convenio}`);
  });
  lines.push("Depois de corrigir no sistema de gestão, a guia continua na lista até o lote ser carregado de novo.");
  return lines.join("\n");
}
