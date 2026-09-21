import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>{actions && <div className="shrink-0">{actions}</div>}</div>;
}

export function FreshnessNotice({ data }: { data: { dia_ultima_carga: string | null; dias_uteis_desde_ultima_carga: number | null; defasado: boolean | null } | null }) {
  if (!data?.dia_ultima_carga) return null;
  const day = data.dia_ultima_carga.split("-").reverse().join("/");
  return <div className={data.defasado ? "rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning-foreground" : "rounded-xl border border-success/15 bg-success/5 p-4 text-sm text-muted-foreground"}>{data.defasado ? `Atenção: os dados são de ${day}; faz ${data.dias_uteis_desde_ultima_carga} dias úteis sem carga.` : `Dados atualizados em ${day}.`}</div>;
}
