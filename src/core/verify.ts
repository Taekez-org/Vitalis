import { addDays, differenceInDays, parseDate } from "./dates";
import { normalizeAgreement, procedureByCode, rules } from "./rules";
import type { Contexto, Guia, Motivo, Resultado } from "./types";

const actions: Record<string, { tipo: Motivo["tipo"]; responsavel: Motivo["responsavel"]; acao: string }> = {
  DADO_ILEGIVEL: { tipo: "corrigir_dado", responsavel: "recepcao", acao: "Corrigir o campo indicado." },
  CONVENIO_DESCONHECIDO: { tipo: "alguem_decide", responsavel: "financeiro", acao: "Conferir o convenio lancado ou cadastrar a regra." },
  PROCEDIMENTO_DESCONHECIDO: { tipo: "alguem_decide", responsavel: "financeiro", acao: "Conferir o codigo do procedimento ou cadastrar na tabela." },
  CAMPO_OBRIGATORIO_VAZIO: { tipo: "corrigir_dado", responsavel: "recepcao", acao: "Preencher o(s) campo(s) exigido(s) pelo convenio." },
  AUT_VENCIDA: { tipo: "alguem_decide", responsavel: "recepcao", acao: "Nao atender nem faturar pelo convenio com autorizacao vencida. Informar o paciente, obter nova autorizacao valida ou registrar o aceite da cobranca particular." },
  VALIDADE_ACIMA_DO_MAXIMO: { tipo: "corrigir_dado", responsavel: "recepcao", acao: "Corrigir a validade conforme o limite do convenio; nao enviar como convenio enquanto estiver irregular." },
  SESSAO_ACIMA_DO_LIMITE: { tipo: "corrigir_dado", responsavel: "recepcao", acao: "Solicitar nova autorizacao." },
  LIMITE_DIVERGENTE: { tipo: "alguem_decide", responsavel: "financeiro", acao: "Conferir com o convenio o limite de sessoes informado." },
  PROCEDIMENTO_NAO_COBERTO: { tipo: "alguem_decide", responsavel: "gestao", acao: "Decidir: cobrar como particular ou outra solucao; nao enviar ao convenio como esta." },
  VALOR_DIVERGENTE: { tipo: "alguem_decide", responsavel: "financeiro", acao: "Conferir o valor com a tabela de procedimentos." },
  DESCRICAO_DIVERGENTE: { tipo: "corrigir_dado", responsavel: "recepcao", acao: "Conferir codigo e descricao do procedimento." },
  DATA_ATENDIMENTO_FUTURA: { tipo: "corrigir_dado", responsavel: "recepcao", acao: "Corrigir a data do atendimento." },
  LANCAMENTO_ANTES_DO_ATENDIMENTO: { tipo: "corrigir_dado", responsavel: "recepcao", acao: "Corrigir a data do lancamento ou do atendimento." },
  PRAZO_ENVIO_VENCIDO: { tipo: "alguem_decide", responsavel: "financeiro", acao: "Decidir com o convenio: prazo de envio expirado." },
  DUPLICADA: { tipo: "alguem_decide", responsavel: "financeiro", acao: "Manter uma das guias e cancelar a outra." },
  CONFLITO_AUTORIZACAO: { tipo: "alguem_decide", responsavel: "financeiro", acao: "Decidir qual autorizacao vale para a sessao." },
  TXT_AUTORIZACAO_NOVA_NAO_LANCADA: { tipo: "corrigir_dado", responsavel: "recepcao", acao: "Lancar numero e validade da autorizacao nova e reenviar para verificacao." },
  TXT_AUTORIZACAO_VERBAL: { tipo: "corrigir_dado", responsavel: "recepcao", acao: "Conseguir o numero da autorizacao e lanca-lo antes do envio." },
  TXT_SESSAO_REMARCADA: { tipo: "alguem_decide", responsavel: "financeiro", acao: "Conferir com o convenio a autorizacao da data original." },
  TXT_FATURAR_PARTICULAR: { tipo: "alguem_decide", responsavel: "gestao", acao: "Retirar do faturamento do convenio e faturar como particular." },
  TXT_PROCEDIMENTO_DIFERENTE: { tipo: "alguem_decide", responsavel: "gestao", acao: "Definir o codigo correto do procedimento realizado." },
};

function reason(codigo: string, campo?: string, detalhe?: Record<string, unknown>): Motivo {
  const action = actions[codigo];
  if (!action) throw new Error(`Codigo sem acao: ${codigo}`);
  return { codigo, campo, ...action, origem: codigo.startsWith("TXT_") ? "texto" : "regra", detalhe };
}

function parseMoney(value: string): number | undefined {
  const input = value.trim().replace(/^R\$\s*/, "");
  const normalized = input.includes(",") ? input.replace(/\./g, "").replace(",", ".") : input;
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function textSignals(value: string): string[] {
  const text = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const signals: string[] = [];
  if (text.includes("autorizacao nova")) signals.push("TXT_AUTORIZACAO_NOVA_NAO_LANCADA");
  if (text.includes("protocolo") && (text.includes("telefone") || text.includes("verbal") || text.includes("aguardando numero"))) signals.push("TXT_AUTORIZACAO_VERBAL");
  if (text.includes("remarcad")) signals.push("TXT_SESSAO_REMARCADA");
  if (text.includes("como particular")) signals.push("TXT_FATURAR_PARTICULAR");
  if (/procedimento realizado (foi|era)/.test(text)) signals.push("TXT_PROCEDIMENTO_DIFERENTE");
  return signals;
}

export function verify(guia: Guia, contexto: Contexto): Resultado {
  const motivos: Motivo[] = [];
  const avisos: string[] = [];
  const trimmed = Object.fromEntries(Object.entries(guia).map(([key, value]) => [key, typeof value === "string" ? value.replace(/\u00a0/g, " ").trim() : ""])) as Guia;
  const agreement = normalizeAgreement(trimmed.convenio);
  const procedure = procedureByCode(trimmed.procedimento_codigo);
  const attendance = parseDate(trimmed.data_atendimento);
  const validity = parseDate(trimmed.autorizacao_validade);
  const launch = parseDate(trimmed.data_lancamento || contexto.data_referencia);
  const money = parseMoney(trimmed.valor);
  const session = /^\d+$/.test(trimmed.sessao_numero_na_autorizacao) && Number(trimmed.sessao_numero_na_autorizacao) >= 1 ? Number(trimmed.sessao_numero_na_autorizacao) : undefined;
  const guideLimit = /^\d+$/.test(trimmed.autorizacao_sessoes_limite) && Number(trimmed.autorizacao_sessoes_limite) >= 1 ? Number(trimmed.autorizacao_sessoes_limite) : undefined;

  for (const field of ["data_atendimento", "autorizacao_validade", "data_lancamento"]) {
    const value = trimmed[field];
    const parsed = parseDate(value || (field === "data_lancamento" && contexto.modo === "lancamento" ? contexto.data_referencia : ""));
    if (field === "data_atendimento" && !parsed.date) motivos.push(reason("DADO_ILEGIVEL", field));
    if (field === "autorizacao_validade" && agreement && !value) motivos.push(reason("CAMPO_OBRIGATORIO_VAZIO", field));
    if (field === "data_lancamento" && contexto.modo === "lote" && !parsed.date) motivos.push(reason("DADO_ILEGIVEL", field));
    if (parsed.formatted) avisos.push("AVISO_DATA_FORMATO");
    if (value && parsed.invalid) motivos.push(reason("DADO_ILEGIVEL", field));
  }
  if (!money) motivos.push(reason("DADO_ILEGIVEL", "valor"));
  else if (trimmed.valor.includes(",") || trimmed.valor.includes("R$") || /\d\.\d{3},/.test(trimmed.valor)) avisos.push("AVISO_VALOR_FORMATO");
  if (!session) motivos.push(reason("DADO_ILEGIVEL", "sessao_numero_na_autorizacao"));
  if (!guideLimit) motivos.push(reason("DADO_ILEGIVEL", "autorizacao_sessoes_limite"));

  if (!agreement) motivos.push(reason("CONVENIO_DESCONHECIDO", "convenio"));
  if (!procedure) motivos.push(reason("PROCEDIMENTO_DESCONHECIDO", "procedimento_codigo"));
  if (agreement) {
    for (const field of agreement.campos_obrigatorios) if (!trimmed[field]) motivos.push(reason("CAMPO_OBRIGATORIO_VAZIO", field));
    if (procedure && !agreement.procedimentos_cobertos.includes(procedure.codigo)) motivos.push(reason("PROCEDIMENTO_NAO_COBERTO", "procedimento_codigo", { observacao_convenio: agreement.observacao }));
    if (procedure && money !== undefined && Math.abs(money - procedure.valor_referencia) > 0.005) motivos.push(reason("VALOR_DIVERGENTE", "valor"));
    if (procedure && trimmed.procedimento_descricao.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ") !== procedure.descricao.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ")) motivos.push(reason("DESCRICAO_DIVERGENTE", "procedimento_descricao"));
    if (session && guideLimit && guideLimit !== agreement.limite_sessoes_por_autorizacao) motivos.push(reason("LIMITE_DIVERGENTE", "autorizacao_sessoes_limite"));
    if (session && guideLimit && session > Math.min(guideLimit, agreement.limite_sessoes_por_autorizacao)) motivos.push(reason("SESSAO_ACIMA_DO_LIMITE", "sessao_numero_na_autorizacao", { limite_efetivo: Math.min(guideLimit, agreement.limite_sessoes_por_autorizacao) }));
    if (attendance.date && validity.date) {
      const days = differenceInDays(validity.date, attendance.date);
      if (days < 0) motivos.push(reason("AUT_VENCIDA", "autorizacao_validade", { dias: Math.abs(days) }));
      if (days > agreement.validade_maxima_autorizacao_dias) motivos.push(reason("VALIDADE_ACIMA_DO_MAXIMO", "autorizacao_validade"));
    }
    if (attendance.date && contexto.modo !== "antes_da_sessao" && attendance.date > contexto.data_referencia) motivos.push(reason("DATA_ATENDIMENTO_FUTURA", "data_atendimento"));
    if (attendance.date && launch.date && launch.date < attendance.date && contexto.modo !== "antes_da_sessao") motivos.push(reason("LANCAMENTO_ANTES_DO_ATENDIMENTO", "data_lancamento"));
    if (attendance.date && contexto.modo !== "antes_da_sessao" && addDays(attendance.date, agreement.prazo_envio_dias) < contexto.data_referencia) motivos.push(reason("PRAZO_ENVIO_VENCIDO", "data_atendimento"));
  }
  for (const signal of textSignals(trimmed.observacao_recepcao)) motivos.push(reason(signal));
  return { id_guia: trimmed.id_guia, status: motivos.length ? "PENDENTE" : "OK", modo: contexto.modo, data_referencia: contexto.data_referencia, motivos, avisos: [...new Set(avisos)], valor: money ?? null };
}

export { rules };
