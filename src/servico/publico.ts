import { publicReason } from "../infra/store";
import type { Guia, Resultado } from "../core/types";
import type { Treatment } from "../infra/store";

export function pendenciaPublica(result: Resultado & { createdAt?: string }, guia: Guia | undefined, tratamento: Pick<Treatment, "status">) {
  return {
    id_guia: result.id_guia,
    guia: guia ? { unidade: guia.unidade, convenio: guia.convenio, procedimento_codigo: guia.procedimento_codigo, valor: guia.valor } : undefined,
    valor: result.valor,
    motivos: result.motivos.map(publicReason),
    tratamento: { status: tratamento.status },
    verificada_em: result.createdAt,
  };
}
