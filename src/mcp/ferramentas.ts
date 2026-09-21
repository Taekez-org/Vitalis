import { z } from "zod";
import { verify } from "../core/verify";
import { normalizeAgreement, procedureByCode } from "../core/rules";
import type { Guia } from "../core/types";
import { formatarDetalhe, formatarLista } from "./formatar";
import { listarPendencias } from "../servico/pendencias";
import { hojeEmSaoPaulo } from "../infra/relogio";
import { productionDatabaseUnavailable } from "../infra/supabase";

export const pendenciasInput = z.object({
  responsavel: z.enum(["recepcao", "financeiro", "gestao", "tecnico", "todos"]).default("recepcao"),
  unidade: z.string().optional(),
  convenio: z.string().optional(),
  limite: z.number().int().min(1).max(50).default(20),
  id_guia: z.string().optional(),
});

export async function consultarPendencias(input: unknown) {
  if (productionDatabaseUnavailable()) throw new Error("BANCO_NAO_CONFIGURADO");
  const args = pendenciasInput.parse(input);
  if (args.id_guia) {
    const result = await listarPendencias({ responsavel: "todos", id_guia: args.id_guia, limite: 50 });
    const item = result.itens.find((entry) => entry.id_guia.toLowerCase() === args.id_guia!.trim().toLowerCase());
    return { modo: "detalhe" as const, texto: formatarDetalhe(item, args.id_guia), dados: item ? publicItem(item) : { id_guia: args.id_guia, encontrado: false } };
  }
  const result = await listarPendencias(args);
  return { modo: "lista" as const, texto: formatarLista(result, args), dados: { total: result.total, total_do_responsavel: result.total_do_responsavel, mostrando: result.itens.length, outros_responsaveis: result.total - result.total_do_responsavel, data_ultima_carga: result.data_ultima_carga, dia_ultima_carga: result.frescor.dia_ultima_carga, dias_uteis_desde_ultima_carga: result.frescor.dias_uteis_desde_ultima_carga, defasado: result.defasado, itens: result.itens.map(publicItem) } };
}

export const guideInput = z.object({
  id_guia: z.string(), unidade: z.string().default(""), data_atendimento: z.string().default(""), paciente: z.string().default(""), convenio: z.string().default(""), carteirinha: z.string().default(""), cid: z.string().default(""), procedimento_codigo: z.string().default(""), procedimento_descricao: z.string().default(""), numero_autorizacao: z.string().default(""), autorizacao_validade: z.string().default(""), autorizacao_sessoes_limite: z.string().default(""), sessao_numero_na_autorizacao: z.string().default(""), profissional: z.string().default(""), profissional_registro: z.string().default(""), valor: z.string().default(""), observacao_recepcao: z.string().default(""), data_lancamento: z.string().default(""), data_referencia: z.string().default(hojeEmSaoPaulo()), modo: z.enum(["lancamento", "lote", "antes_da_sessao"]).default("lote"),
});

export function verificarGuia(input: unknown) {
  const args = guideInput.parse(input);
  const guide = { ...args } as Guia;
  return verify(guide, { modo: args.modo, data_referencia: args.data_referencia });
}

export function consultarRegra(input: unknown) {
  const args = z.object({ convenio: z.string(), procedimento_codigo: z.string() }).parse(input);
  const agreement = normalizeAgreement(args.convenio);
  const procedure = procedureByCode(args.procedimento_codigo);
  return { convenio: agreement ? { nome: agreement.nome, campos_obrigatorios: agreement.campos_obrigatorios, validade_maxima_autorizacao_dias: agreement.validade_maxima_autorizacao_dias, limite_sessoes_por_autorizacao: agreement.limite_sessoes_por_autorizacao, prazo_envio_dias: agreement.prazo_envio_dias, observacao: agreement.observacao } : null, procedimento: procedure ?? null };
}

function publicItem(item: Awaited<ReturnType<typeof listarPendencias>>["itens"][number]) {
  return { id_guia: item.id_guia, convenio: item.convenio, unidade: item.unidade, valor: item.valor, prazo_limite: item.prazo_limite, dias_para_prazo: item.dias_para_prazo, erros: item.erros.map(({ codigo, resumo, responsavel }) => ({ codigo, resumo, responsavel })) };
}
