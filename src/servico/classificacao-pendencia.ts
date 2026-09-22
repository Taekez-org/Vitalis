const NON_RECOVERABLE_CODES = new Set([
  "AUT_VENCIDA",
  "SESSAO_ACIMA_DO_LIMITE",
  "PROCEDIMENTO_NAO_COBERTO",
  "TXT_PROCEDIMENTO_DIFERENTE",
]);

const PRE_SUBMISSION_DECISION_CODES = new Set([
  "DUPLICADA",
  "CONFLITO_AUTORIZACAO",
  "TXT_FATURAR_PARTICULAR",
]);

export type PendenciaClassificacao = "nao_recuperavel" | "recuperavel" | "decisao_pre_envio";

export function classificarPendencia(codes: string[]): PendenciaClassificacao {
  if (codes.some((code) => NON_RECOVERABLE_CODES.has(code))) return "nao_recuperavel";
  if (codes.some((code) => PRE_SUBMISSION_DECISION_CODES.has(code))) return "decisao_pre_envio";
  return "recuperavel";
}

export function eGlosaNaoRecuperavel(code: string): boolean {
  return NON_RECOVERABLE_CODES.has(code);
}
