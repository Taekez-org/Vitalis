export type Status = "OK" | "PENDENTE";
export type Responsible = "recepcao" | "financeiro" | "gestao" | "tecnico";
export type ReasonType = "corrigir_dado" | "alguem_decide";

export type Guia = Record<string, string> & {
  id_guia: string;
  unidade: string;
  data_atendimento: string;
  paciente: string;
  convenio: string;
  carteirinha: string;
  cid: string;
  procedimento_codigo: string;
  procedimento_descricao: string;
  numero_autorizacao: string;
  autorizacao_validade: string;
  autorizacao_sessoes_limite: string;
  sessao_numero_na_autorizacao: string;
  profissional: string;
  profissional_registro: string;
  valor: string;
  observacao_recepcao: string;
  data_lancamento: string;
};

export type Contexto = {
  modo: "lancamento" | "lote" | "antes_da_sessao";
  data_referencia: string;
};

export type Motivo = {
  codigo: string;
  tipo: ReasonType;
  responsavel: Responsible;
  campo?: string;
  acao: string;
  origem: "regra" | "texto" | "sistema";
  detalhe?: Record<string, unknown>;
};

export type Resultado = {
  id_guia: string;
  status: Status;
  modo: Contexto["modo"];
  data_referencia: string;
  motivos: Motivo[];
  avisos: string[];
  valor: number | null;
  observacao?: {
    origem: "groq" | "nao_lida" | "desligada";
    classe: "rotina" | "sinal" | "revisar" | "nao_lida" | "desligada";
    sinais: string[];
    motivo?: string;
    chave?: string;
    prompt_versao: string;
    modelo?: string;
  };
};
