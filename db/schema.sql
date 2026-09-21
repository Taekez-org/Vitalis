create extension if not exists pgcrypto;

create table if not exists public.cargas (
  id uuid primary key default gen_random_uuid(),
  nome_arquivo text not null,
  hash_arquivo text not null unique,
  quantidade_guias integer not null,
  criada_em timestamptz not null default now()
);

create table if not exists public.guias (
  id_guia text primary key,
  dados jsonb not null,
  atualizada_em timestamptz not null default now()
);

create table if not exists public.verificacoes (
  id uuid primary key default gen_random_uuid(),
  id_guia text not null references public.guias(id_guia),
  carga_id uuid not null references public.cargas(id),
  status text not null check (status in ('OK', 'PENDENTE')),
  resultado jsonb not null,
  valor numeric(12,2),
  criada_em timestamptz not null default now()
);

create table if not exists public.tratamentos (
  id_guia text primary key references public.guias(id_guia),
  situacao text not null check (situacao in ('ABERTA', 'EM_TRATAMENTO', 'AGUARDANDO_REVERIFICACAO', 'RESOLVIDA')),
  marcado_por text not null,
  marcada_em timestamptz not null default now()
);

create index if not exists verificacoes_guia_data_idx on public.verificacoes (id_guia, criada_em desc);
create index if not exists verificacoes_status_idx on public.verificacoes (status);

create or replace view public.ultima_verificacao with (security_invoker = true) as
select distinct on (id_guia) id_guia, carga_id, status, resultado, valor, criada_em
from public.verificacoes
order by id_guia, criada_em desc, id desc;

create or replace function public.registrar_carga(p_nome text, p_hash text, p_guias jsonb, p_verificacoes jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.cargas (nome_arquivo, hash_arquivo, quantidade_guias)
  values (p_nome, p_hash, jsonb_array_length(p_guias))
  on conflict (hash_arquivo) do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from public.cargas where hash_arquivo = p_hash;
    return jsonb_build_object('carga_id', v_id, 'ja_existia', true);
  end if;
  insert into public.guias (id_guia, dados, atualizada_em)
  select g->>'id_guia', g, now() from jsonb_array_elements(p_guias) g
  on conflict (id_guia) do update set dados = excluded.dados, atualizada_em = now();
  insert into public.verificacoes (id_guia, carga_id, status, resultado, valor)
  select v->>'id_guia', v_id, v->>'status', v, nullif(v->>'valor', '')::numeric
  from jsonb_array_elements(p_verificacoes) v;
  update public.tratamentos t set situacao = case
    when v.status = 'OK' then 'RESOLVIDA'
    when t.situacao = 'AGUARDANDO_REVERIFICACAO' then 'EM_TRATAMENTO'
    when t.situacao = 'RESOLVIDA' then 'ABERTA'
    else t.situacao end
  from (select x->>'id_guia' id_guia, x->>'status' status from jsonb_array_elements(p_verificacoes) x) v
  where t.id_guia = v.id_guia and (v.status = 'OK' or t.situacao in ('AGUARDANDO_REVERIFICACAO', 'RESOLVIDA'));
  return jsonb_build_object('carga_id', v_id, 'ja_existia', false);
end $$;

create or replace function public.bloquear_historico() returns trigger language plpgsql as $$
begin raise exception 'historico append-only'; end; $$;
drop trigger if exists verificacoes_append_only on public.verificacoes;
create trigger verificacoes_append_only before update or delete on public.verificacoes for each row execute function public.bloquear_historico();
drop trigger if exists cargas_append_only on public.cargas;
create trigger cargas_append_only before update or delete on public.cargas for each row execute function public.bloquear_historico();

alter table public.cargas enable row level security;
alter table public.guias enable row level security;
alter table public.verificacoes enable row level security;
alter table public.tratamentos enable row level security;
revoke all on public.cargas, public.guias, public.verificacoes, public.tratamentos, public.ultima_verificacao from anon, authenticated;
revoke all on function public.registrar_carga(text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_carga(text, text, jsonb, jsonb) to service_role;

do $$ begin
  alter publication supabase_realtime add table public.cargas;
  alter publication supabase_realtime add table public.verificacoes;
  alter publication supabase_realtime add table public.tratamentos;
exception when duplicate_object then null;
end $$;
