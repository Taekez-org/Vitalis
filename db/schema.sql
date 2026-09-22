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

create table if not exists public.tratamento_eventos (
  id uuid primary key default gen_random_uuid(),
  id_guia text not null references public.guias(id_guia),
  carga_id uuid references public.cargas(id),
  status_tecnico text check (status_tecnico in ('OK', 'PENDENTE')),
  status_anterior text check (status_anterior is null or status_anterior in ('ABERTA', 'EM_TRATAMENTO', 'AGUARDANDO_REVERIFICACAO', 'RESOLVIDA')),
  status_novo text not null check (status_novo in ('ABERTA', 'EM_TRATAMENTO', 'AGUARDANDO_REVERIFICACAO', 'RESOLVIDA')),
  evento text not null,
  por_quem text not null,
  comentario text,
  criado_em timestamptz not null default now()
);

create table if not exists public.observacao_revisoes (
  id_guia text not null references public.guias(id_guia),
  chave text not null,
  status text not null check (status in ('ABERTA', 'RESOLVIDA')),
  origem text not null check (origem in ('groq', 'nao_lida')),
  classe text not null check (classe in ('sinal', 'revisar', 'nao_lida')),
  sinais jsonb not null default '[]'::jsonb,
  motivo text,
  criada_em timestamptz not null default now(),
  resolvida_em timestamptz,
  resolvida_por text,
  comentario text,
  primary key (id_guia, chave)
);

create index if not exists verificacoes_guia_data_idx on public.verificacoes (id_guia, criada_em desc);
create index if not exists verificacoes_status_idx on public.verificacoes (status);
create index if not exists tratamento_eventos_guia_data_idx on public.tratamento_eventos (id_guia, criado_em desc);
create index if not exists tratamento_eventos_status_idx on public.tratamento_eventos (status_novo, criado_em desc);
create index if not exists observacao_revisoes_status_idx on public.observacao_revisoes (status, criada_em desc);

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
  insert into public.tratamento_eventos (id_guia, carga_id, status_tecnico, status_anterior, status_novo, evento, por_quem)
  select v->>'id_guia', v_id, v->>'status', t.situacao,
    case
      when v->>'status' = 'OK' then 'RESOLVIDA'
      when t.situacao = 'AGUARDANDO_REVERIFICACAO' then 'EM_TRATAMENTO'
      when t.situacao = 'RESOLVIDA' then 'ABERTA'
      else coalesce(t.situacao, 'ABERTA')
    end,
    case
      when v->>'status' = 'OK' then 'VERIFICACAO_OK'
      when t.situacao = 'AGUARDANDO_REVERIFICACAO' then 'REVERIFICACAO_PENDENTE'
      when t.situacao = 'RESOLVIDA' then 'PENDENCIA_REABERTA'
      else 'PENDENCIA_IDENTIFICADA'
    end,
    'sistema'
  from jsonb_array_elements(p_verificacoes) v
  left join public.tratamentos t on t.id_guia = v->>'id_guia';
  insert into public.tratamentos (id_guia, situacao, marcado_por, marcada_em)
  select v->>'id_guia',
    case
      when v->>'status' = 'OK' then 'RESOLVIDA'
      when t.situacao = 'AGUARDANDO_REVERIFICACAO' then 'EM_TRATAMENTO'
      when t.situacao = 'RESOLVIDA' then 'ABERTA'
      else coalesce(t.situacao, 'ABERTA')
    end,
    'sistema', now()
  from jsonb_array_elements(p_verificacoes) v
  left join public.tratamentos t on t.id_guia = v->>'id_guia'
  on conflict (id_guia) do update set situacao = excluded.situacao, marcado_por = excluded.marcado_por, marcada_em = excluded.marcada_em;
  return jsonb_build_object('carga_id', v_id, 'ja_existia', false);
end $$;

create or replace function public.bloquear_historico() returns trigger language plpgsql set search_path = public as $$
begin raise exception 'historico append-only'; end; $$;
drop trigger if exists verificacoes_append_only on public.verificacoes;
create trigger verificacoes_append_only before update or delete on public.verificacoes for each row execute function public.bloquear_historico();
drop trigger if exists cargas_append_only on public.cargas;
create trigger cargas_append_only before update or delete on public.cargas for each row execute function public.bloquear_historico();
drop trigger if exists tratamento_eventos_append_only on public.tratamento_eventos;
create trigger tratamento_eventos_append_only before update or delete on public.tratamento_eventos for each row execute function public.bloquear_historico();

alter table public.cargas enable row level security;
alter table public.guias enable row level security;
alter table public.verificacoes enable row level security;
alter table public.tratamentos enable row level security;
alter table public.tratamento_eventos enable row level security;
alter table public.observacao_revisoes enable row level security;
revoke all on public.cargas, public.guias, public.verificacoes, public.tratamentos, public.tratamento_eventos, public.observacao_revisoes, public.ultima_verificacao from anon, authenticated;
grant select on public.cargas, public.guias, public.verificacoes, public.tratamentos, public.tratamento_eventos, public.observacao_revisoes, public.ultima_verificacao to service_role;
grant insert, update on public.tratamentos to service_role;
grant insert on public.tratamento_eventos to service_role;
grant insert, update on public.observacao_revisoes to service_role;
revoke all on function public.registrar_carga(text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_carga(text, text, jsonb, jsonb) to service_role;

do $$ begin
  alter publication supabase_realtime add table public.cargas;
  alter publication supabase_realtime add table public.verificacoes;
  alter publication supabase_realtime add table public.tratamentos;
  alter publication supabase_realtime add table public.tratamento_eventos;
exception when duplicate_object then null;
end $$;
