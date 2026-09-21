const labels: Record<string, string> = {
  DADO_ILEGIVEL: "dado ilegível",
  CONVENIO_DESCONHECIDO: "convênio não reconhecido",
  PROCEDIMENTO_DESCONHECIDO: "procedimento não reconhecido",
  CAMPO_OBRIGATORIO_VAZIO: "campo obrigatório vazio",
  AUT_VENCIDA: "autorização vencida",
  VALIDADE_ACIMA_DO_MAXIMO: "validade da autorização acima do máximo do convênio",
  SESSAO_ACIMA_DO_LIMITE: "sessão acima do limite da autorização",
  LIMITE_DIVERGENTE: "limite de sessões diferente do convênio",
  PROCEDIMENTO_NAO_COBERTO: "procedimento não coberto pelo convênio",
  VALOR_DIVERGENTE: "valor diferente da tabela",
  DESCRICAO_DIVERGENTE: "descrição diferente do procedimento",
  DATA_ATENDIMENTO_FUTURA: "data do atendimento no futuro",
  LANCAMENTO_ANTES_DO_ATENDIMENTO: "lançamento anterior ao atendimento",
  PRAZO_ENVIO_VENCIDO: "prazo de envio ao convênio vencido",
  DUPLICADA: "guia duplicada",
  CONFLITO_AUTORIZACAO: "duas autorizações diferentes para a mesma sessão",
  DUPLICIDADE_NAO_VERIFICADA: "duplicidade não conferida",
  TEXTO_NAO_LIDO: "observação não interpretada; ler manualmente",
  TXT_AUTORIZACAO_NOVA_NAO_LANCADA: "autorização nova ainda não lançada",
  TXT_AUTORIZACAO_VERBAL: "autorização verbal sem número",
  TXT_SESSAO_REMARCADA: "sessão remarcada; autorização da data original",
  TXT_FATURAR_PARTICULAR: "paciente pediu faturamento particular",
  TXT_PROCEDIMENTO_DIFERENTE: "procedimento realizado diferente do lançado",
};

export function rotuloMotivo(code: string): string {
  return labels[code] ?? code.toLowerCase().replaceAll("_", " ");
}

export function rotulosConhecidos(): string[] {
  return Object.keys(labels);
}
