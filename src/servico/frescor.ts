import { diasUteis } from "../core/dates";
import { diaEmSaoPaulo } from "../infra/relogio";

export function calcularFrescor(ultimaCargaISO: string | undefined, hoje: string) {
  if (!ultimaCargaISO) return { ultima_carga: null, dia_ultima_carga: null, dias_uteis_desde_ultima_carga: null, defasado: null };
  const dia = diaEmSaoPaulo(ultimaCargaISO);
  const dias = diasUteis(dia, hoje);
  return { ultima_carga: ultimaCargaISO, dia_ultima_carga: dia, dias_uteis_desde_ultima_carga: dias, defasado: dias >= 2 };
}
