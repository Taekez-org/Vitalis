import rawRules from "../../data/regras_convenio.json";

export type ProcedureRule = {
  codigo: string;
  descricao: string;
  valor_referencia: number;
};

export type AgreementRule = {
  nome: string;
  campos_obrigatorios: string[];
  validade_maxima_autorizacao_dias: number;
  limite_sessoes_por_autorizacao: number;
  procedimentos_cobertos: string[];
  prazo_envio_dias: number;
  observacao: string;
};

export const rules = rawRules as {
  versao: string;
  procedimentos: ProcedureRule[];
  convenios: AgreementRule[];
};

export function normalizeAgreement(value: string): AgreementRule | undefined {
  const key = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
  return rules.convenios.find((agreement) => agreement.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === key);
}

export function procedureByCode(code: string): ProcedureRule | undefined {
  return rules.procedimentos.find((procedure) => procedure.codigo === code.trim());
}
