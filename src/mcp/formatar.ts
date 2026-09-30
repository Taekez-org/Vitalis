import type { Resultado } from "../core/types";
import type { ListaPendencias, PendenciaItem } from "../servico/pendencias";
import { rotuloMotivo } from "../servico/rotulos";
import type { consultarRegra } from "./ferramentas";

const RESPONSAVEIS: Record<string, string> = { recepcao: "recepção", financeiro: "financeiro", gestao: "gestão", tecnico: "técnico" };
const CAMPOS: Record<string, string> = { numero_autorizacao: "número da autorização", autorizacao_validade: "validade da autorização", profissional_registro: "registro do profissional", carteirinha: "carteirinha", cid: "CID" };
const AVISOS: Record<string, string> = { AVISO_DATA_FORMATO: "há data em formato DD/MM/AAAA; ela foi aceita", AVISO_VALOR_FORMATO: "o valor veio com vírgula ou R$; ele foi aceito" };

function responsavel(value: string): string {
  return RESPONSAVEIS[value] ?? value;
}

function reais(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

export function formatarRegra(result: ReturnType<typeof consultarRegra>): string {
  const { convenio, procedimento, cobertura } = result;
  const lines: string[] = [];
  if (!convenio) lines.push("Não encontrei o convênio informado nas regras cadastradas. Confira o nome, por exemplo: Vitalcard, Saúde Interior ou Plano Bem.");
  if (!procedimento) lines.push("Não encontrei o procedimento informado nas regras cadastradas. Confira o código.");
  if (procedimento) lines.push(`${convenio ? `${convenio.nome} · ` : ""}${procedimento.descricao} (${procedimento.codigo})`, `Valor de referência: ${reais(procedimento.valor_referencia)}`);
  if (convenio && procedimento) lines.push(cobertura ? "Cobertura: coberto pelo convênio." : `Cobertura: NÃO coberto pelo convênio. ${convenio.observacao}`.trim());
  if (convenio) {
    if (!procedimento) lines.push(convenio.nome);
    lines.push(
      "Regras do convênio:",
      `- Validade máxima da autorização: ${convenio.validade_maxima_autorizacao_dias} dias`,
      `- Limite de sessões por autorização: ${convenio.limite_sessoes_por_autorizacao}`,
      `- Prazo de envio: ${convenio.prazo_envio_dias} dias após o atendimento`,
      `- Campos obrigatórios: ${convenio.campos_obrigatorios.map((campo) => CAMPOS[campo] ?? campo).join(", ")}`,
    );
    if (convenio.observacao && cobertura !== false) lines.push(`- Observação: ${convenio.observacao}`);
  }
  return lines.join("\n");
}

export function formatarVerificacao(result: Resultado): string {
  const data = result.data_referencia.split("-").reverse().join("/");
  const lines: string[] = [];
  if (result.status === "OK") lines.push(`Guia ${result.id_guia}: pode seguir para o envio. Nenhuma pendência encontrada (dados de ${data}).`);
  else {
    lines.push(`Guia ${result.id_guia}: precisa de ação antes do envio (dados de ${data}).`);
    result.motivos.forEach((motivo, index) => {
      lines.push(`${index + 1}. ${rotuloMotivo(motivo.codigo)} (${motivo.codigo})`, `   Como resolver: ${motivo.acao}`, `   Quem resolve: ${responsavel(motivo.responsavel)}`);
    });
    lines.push("Depois de corrigir no sistema de gestão, a guia continua na lista até o lote ser carregado de novo.");
  }
  const avisos = result.avisos.map((aviso) => AVISOS[aviso] ?? aviso);
  if (avisos.length) lines.push(`Avisos: ${avisos.join("; ")}.`);
  return lines.join("\n");
}

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
    lines.push(`   Quem resolve: ${responsavel(error.responsavel)}`);
    if (typeof error.detalhe?.observacao_convenio === "string") lines.push(`   Regra do convênio: ${error.detalhe.observacao_convenio}`);
  });
  lines.push("Depois de corrigir no sistema de gestão, a guia continua na lista até o lote ser carregado de novo.");
  return lines.join("\n");
}
