import { z } from "zod";
import type { Guia, Resultado } from "../core/types";

export const observationSignals = [
  "TXT_AUTORIZACAO_NOVA_NAO_LANCADA",
  "TXT_AUTORIZACAO_VERBAL",
  "TXT_SESSAO_REMARCADA",
  "TXT_FATURAR_PARTICULAR",
  "TXT_PROCEDIMENTO_DIFERENTE",
] as const;

const signalSchema = z.enum(observationSignals);

export const observationSchema = z.object({
  classe: z.enum(["rotina", "sinal", "revisar"]),
  sinais: z.array(signalSchema).max(5),
  motivo: z.string().transform((value) => value.trim().slice(0, 140)),
}).strict().superRefine((value, context) => {
  if (value.classe === "sinal" && value.sinais.length === 0) context.addIssue({ code: "custom", path: ["sinais"], message: "sinal exige ao menos um codigo" });
  if (value.classe !== "sinal" && value.sinais.length > 0) context.addIssue({ code: "custom", path: ["sinais"], message: "sinais so podem existir na classe sinal" });
  if (value.classe === "revisar" && !value.motivo) context.addIssue({ code: "custom", path: ["motivo"], message: "revisar exige motivo" });
  if (value.classe !== "revisar" && value.motivo) context.addIssue({ code: "custom", path: ["motivo"], message: "motivo so pode existir na classe revisar" });
});

export type ObservationReading = z.infer<typeof observationSchema>;
export type ObservationSource = "groq" | "nao_lida" | "desligada";
export type ObservationReview = {
  id_guia: string;
  chave: string;
  status: "ABERTA" | "RESOLVIDA";
  origem: "groq" | "nao_lida";
  classe: "sinal" | "revisar" | "nao_lida";
  motivo: string;
  criada_em: string;
  resolvida_em?: string;
  resolvida_por?: string;
};

export type ObservationContext = {
  convenio: string;
  procedimento_codigo: string;
  procedimento_descricao: string;
  data_atendimento: string;
  autorizacao_validade: string;
  autorizacao_sessoes_limite: string;
  sessao_numero_na_autorizacao: string;
  resultado_deterministico: Resultado["status"];
  motivos_deterministicos: string[];
  regra: string;
};

export function contextFromGuide(guide: Guia, result: Resultado, regra: string): ObservationContext {
  return {
    convenio: guide.convenio.trim(),
    procedimento_codigo: guide.procedimento_codigo.trim(),
    procedimento_descricao: guide.procedimento_descricao.trim(),
    data_atendimento: guide.data_atendimento.trim(),
    autorizacao_validade: guide.autorizacao_validade.trim(),
    autorizacao_sessoes_limite: guide.autorizacao_sessoes_limite.trim(),
    sessao_numero_na_autorizacao: guide.sessao_numero_na_autorizacao.trim(),
    resultado_deterministico: result.status,
    motivos_deterministicos: result.motivos.map((motivo) => motivo.codigo),
    regra,
  };
}

export function parseObservationReading(input: unknown): ObservationReading {
  return observationSchema.parse(input);
}
