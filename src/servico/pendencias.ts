import { addDays, differenceInDays, parseDate } from "../core/dates";
import { normalizeAgreement } from "../core/rules";
import { latestResults, store } from "../infra/store";
import { rotuloMotivo } from "./rotulos";
import { hojeEmSaoPaulo } from "../infra/relogio";
import { calcularFrescor } from "./frescor";

export type PendenciaFiltro = {
  responsavel?: "recepcao" | "financeiro" | "gestao" | "tecnico" | "todos";
  unidade?: string;
  convenio?: string;
  limite?: number;
  id_guia?: string;
};

export type PendenciaItem = {
  id_guia: string;
  convenio: string;
  unidade: string;
  valor: number | null;
  prazo_limite?: string;
  dias_para_prazo?: number;
  erros: { codigo: string; resumo: string; responsavel: string; acao: string; detalhe?: Record<string, unknown> }[];
};

export type ListaPendencias = {
  itens: PendenciaItem[];
  total: number;
  total_do_responsavel: number;
  contagens: Record<string, number>;
  data_ultima_carga?: string;
  defasado: boolean;
  frescor: ReturnType<typeof calcularFrescor>;
};

export async function listarPendencias(filtro: PendenciaFiltro = {}, hoje = hojeEmSaoPaulo()): Promise<ListaPendencias> {
  const results = await latestResults();
  const all = results.filter((result) => result.status === "PENDENTE").flatMap((result) => {
    const guide = store.guides.get(result.id_guia);
    if (!guide) return [];
    const itens = result.motivos.map((reason) => ({ codigo: reason.codigo, resumo: rotuloMotivo(reason.codigo), responsavel: reason.responsavel, acao: reason.acao, detalhe: reason.detalhe }));
    const prazo = normalizeAgreement(guide.convenio);
    const attendance = parseDate(guide.data_atendimento).date;
    const prazoLimite = prazo && attendance ? addDays(attendance, prazo.prazo_envio_dias) : undefined;
    return [{ id_guia: result.id_guia, convenio: guide.convenio, unidade: guide.unidade, valor: result.valor, prazo_limite: prazoLimite, dias_para_prazo: prazoLimite ? differenceInDays(prazoLimite, hoje) : undefined, erros: itens }];
  });
  const scoped = all.filter((item) => !filtro.unidade || item.unidade === filtro.unidade).filter((item) => !filtro.convenio || item.convenio === filtro.convenio).sort((a, b) => (a.dias_para_prazo ?? Number.MAX_SAFE_INTEGER) - (b.dias_para_prazo ?? Number.MAX_SAFE_INTEGER) || (b.valor ?? 0) - (a.valor ?? 0) || a.id_guia.localeCompare(b.id_guia));
  const counts = scoped.reduce((map, item) => { const people = new Set(item.erros.map((error) => error.responsavel)); for (const person of people) map.set(person, (map.get(person) ?? 0) + 1); return map; }, new Map<string, number>());
  counts.set("todas", scoped.length);
  const responsavel = filtro.responsavel && filtro.responsavel !== "todos" ? filtro.responsavel : "todas";
  const limit = Math.min(Math.max(filtro.limite ?? 20, 1), 50);
  const filtered = responsavel === "todas" ? scoped : scoped.filter((item) => item.erros.some((error) => error.responsavel === responsavel));
  const requestedId = filtro.id_guia?.trim().toLowerCase();
  const selected = requestedId ? scoped.filter((item) => item.id_guia.toLowerCase() === requestedId) : filtered.slice(0, limit);
  const lastLoad = store.loads.at(-1)?.createdAt;
  const frescor = calcularFrescor(lastLoad, hoje);
  return { itens: selected, total: filtered.length, total_do_responsavel: counts.get(responsavel) ?? 0, contagens: Object.fromEntries(counts), data_ultima_carga: lastLoad, defasado: frescor.defasado === true, frescor };
}
