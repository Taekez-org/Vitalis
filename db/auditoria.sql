-- Vitalis: auditoria somente leitura.
-- Executar com: npx supabase db query --linked --file db/auditoria.sql

-- 1. Volume de dados por objeto.
select 'cargas' as tabela, count(*)::bigint as total from public.cargas
union all select 'guias', count(*) from public.guias
union all select 'verificacoes', count(*) from public.verificacoes
union all select 'tratamentos', count(*) from public.tratamentos
union all select 'tratamento_eventos', count(*) from public.tratamento_eventos
union all select 'observacao_revisoes', count(*) from public.observacao_revisoes
order by tabela;

-- 2. Cada carga deve ter o numero esperado de verificacoes.
select c.id, c.nome_arquivo, c.quantidade_guias, c.criada_em,
       count(v.id)::bigint as verificacoes_gravadas
from public.cargas c
left join public.verificacoes v on v.carga_id = c.id
group by c.id, c.nome_arquivo, c.quantidade_guias, c.criada_em
order by c.criada_em desc;

-- 3. Snapshot tecnico atual.
select status, count(*)::bigint as total
from public.ultima_verificacao
group by status
order by status;

-- 4. Snapshot operacional atual.
select situacao, count(*)::bigint as total
from public.tratamentos
group by situacao
order by situacao;

-- 5. Integridade entre entidades.
select 'verificacoes_sem_guia' as teste, count(*)::bigint as total
from public.verificacoes v
left join public.guias g on g.id_guia = v.id_guia
where g.id_guia is null
union all
select 'verificacoes_sem_carga', count(*)::bigint
from public.verificacoes v
left join public.cargas c on c.id = v.carga_id
where c.id is null
union all
select 'eventos_sem_guia', count(*)::bigint
from public.tratamento_eventos e
left join public.guias g on g.id_guia = e.id_guia
where g.id_guia is null
union all
select 'eventos_sem_carga', count(*)::bigint
from public.tratamento_eventos e
left join public.cargas c on c.id = e.carga_id
where e.carga_id is not null and c.id is null
union all
select 'tratamentos_sem_verificacao', count(*)::bigint
from public.tratamentos t
left join public.ultima_verificacao v on v.id_guia = t.id_guia
where v.id_guia is null;

-- 6. Guias tecnicamente pendentes que nao estao na fila operacional esperada.
select v.id_guia, v.status, t.situacao
from public.ultima_verificacao v
left join public.tratamentos t on t.id_guia = v.id_guia
where v.status = 'PENDENTE'
  and coalesce(t.situacao, 'ABERTA') not in ('ABERTA', 'EM_TRATAMENTO', 'AGUARDANDO_REVERIFICACAO');

-- 7. Reconciliacao financeira do snapshot atual.
-- A data segue a mesma normalizacao de src/core/dates.ts usada por duplicateKey:
-- 26/08/2026 e 2026-08-26 representam a mesma data.
with pending as (
  select v.id_guia,
         v.valor,
         concat_ws('|',
           trim(g.dados->>'paciente'),
           case
             when trim(g.dados->>'data_atendimento') ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
               then to_char(to_date(trim(g.dados->>'data_atendimento'), 'DD/MM/YYYY'), 'YYYY-MM-DD')
             else trim(g.dados->>'data_atendimento')
           end,
           trim(g.dados->>'procedimento_codigo')
         ) as exposure_key
  from public.ultima_verificacao v
  join public.guias g on g.id_guia = v.id_guia
  where v.status = 'PENDENTE'
), groups as (
  select exposure_key,
         count(*)::bigint as guides,
         sum(coalesce(valor, 0)) as raw_group,
         max(greatest(coalesce(valor, 0), 0)) as exposure
  from pending
  group by exposure_key
)
select sum(guides)::bigint as pending_guides,
       count(*)::bigint as exposure_groups,
       sum(raw_group) as raw_value,
       sum(exposure) as deduplicated_value,
       sum(raw_group - exposure) as removed_by_dedup
from groups;

-- 8. Eventos tecnicos sem correspondencia na mesma carga.
select e.id_guia, e.carga_id, e.status_tecnico, e.status_novo, e.evento, e.criado_em
from public.tratamento_eventos e
left join public.verificacoes v on v.id_guia = e.id_guia and v.carga_id = e.carga_id
where e.carga_id is not null and v.id is null
order by e.criado_em desc;

-- 9. Definicao da view que abastece a ultima verificacao.
select pg_get_viewdef('public.ultima_verificacao'::regclass, true) as view_definition;

-- 10. Definicao da RPC atomica de carga.
select pg_get_functiondef('public.registrar_carga(text,text,jsonb,jsonb)'::regprocedure) as function_definition;
