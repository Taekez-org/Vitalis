# Ajustes do V4: correções antes da entrega

Briefing para o agente que vai corrigir. Leia tudo antes de escrever código.

## 0. Contexto e regras do trabalho

- Projeto: Verificador de guias da Clínica Vitalis (Next.js, TypeScript, Supabase). A recepção carrega o CSV do sistema de gestão, o núcleo verifica cada guia (OK ou PENDENTE), a fila mostra o que ajustar, e a guia só sai da fila quando uma nova verificação retorna OK. O MCP (`consultar_regra`, `verificar_guia`, `consultar_pendencias`) e a Skill `conferir-guia` usam a mesma fila.
- **O que está certo e NÃO deve mudar:** o núcleo (`src/core/*`). As 80 guias de `data/guias.csv` batem com o gabarito em status, códigos e avisos (41 OK, 39 pendentes, R$ 2.664,00), e o `PRAZO_ENVIO_VENCIDO` dá 0/7/38 nas datas 31/08, 04/09 e 20/09. `tests/golden.test.ts` deve continuar passando sem alteração.
- Regras: testes primeiro (veja o teste falhar, depois corrija); nenhuma regra de negócio nova; toda decisão que não estiver aqui vai para `docs/divergencias.md`; ao final, um relatório por item com a evidência (comando e saída).
- Origem dos achados: revisão feita executando o núcleo, o serviço e as rotas compilados (o vitest e o `next build` não rodaram no ambiente da revisão, por causa dos binários de Windows do `node_modules`). **A sua execução do vitest é a fonte de verdade.** Onde este documento diz "reproduza", rode e confirme antes de corrigir.

### Requisitos da prova (o que a avaliação olha)

O projeto é a etapa técnica de um processo seletivo. A avaliação olha: (1) funciona com os dados, isto é, as decisões batem com o que está errado de verdade nas 80 guias; (2) aguenta uma guia nova sem quebrar; (3) o candidato sabe explicar o que construiu; (4) cuidado básico: nenhuma chave ou senha no repositório (que é público), erro tratado. "Não precisa ser bonito; precisa funcionar, aguentar uma guia nova e ser explicável."

Entregas do formulário: link publicado com as 80 guias; como a guia nova entra e como a decisão sai; o relatório de terça gerado pela solução; um MCP com **pelo menos duas** ferramentas (consultar a regra de um convênio para um procedimento; verificar uma guia devolvendo a decisão e o motivo) e uma Skill para a recepção; README "Como fiz"; vídeo de até 5 minutos; repositório público com código, prompts, MCP, Skill e README. O projeto tem que ter nascido para esta prova (nada reaproveitado de projeto anterior).

### O que é do humano (você NÃO faz)

- Criar o repositório, o projeto Supabase e o projeto Vercel, e preencher as variáveis nas contas. Você prepara o código, o SQL e as instruções passo a passo.
- **Nunca peça nem escreva chave ou senha.** Use `.env.local` (fora do git) e `.env.example` só com nomes.
- Escrever a seção "Como fiz" do README, as decisões do candidato e as horas trabalhadas: são dele. O enunciado exige pelo menos três decisões dele e o tempo real. Você só prepara o esqueleto (item H3).
- Gravar o vídeo, conectar o MCP no Claude e preencher o formulário.

### Ordem e checkpoints

B (testes herméticos) → A (privacidade) → E (estado do tratamento) → **Checkpoint 1** → C (datas e frescor) → **Checkpoint 2** → D (Supabase) → **Checkpoint 3** (o humano fornece as credenciais do projeto de TESTE em `.env.local`) → H (alinhamento com a prova) → F (docs) → **Checkpoint 4** → G (menores, opcional).

Faça B primeiro: sem testes confiáveis, o resto não tem rede de segurança. Em cada checkpoint, pare e mostre os comandos rodados, a saída e o que NÃO foi verificado. Antes do Checkpoint 1, entregue o relatório do "Passo 0" descrito no prompt de abertura (reproduzir os achados, sem alterar nada).

---

## Item B. Testes que não dependem de estado escondido (P0)

### Problema (reproduza)
`data/.local-store.json` está no `.gitignore`, mas os testes de API e de MCP dependem dele: nenhum teste carrega dados antes de rodar. Numa cópia sem o arquivo:

- `consultarPendencias({ limite: 20 })` devolve `"Nenhuma guia foi verificada ainda. Carregue o lote em Lote."`.
- `GET /api/pendencias?codigo=DUPLICADA` devolve 0 itens (o teste espera 4).

Rode `rm -f data/.local-store.json && npm test`. Esperado (falha antes da correção): os 4 testes de `mcp.test.ts` e 2 de `api.test.ts` falham. Só `golden.test.ts` e o teste de `treatmentAfterVerification` passam. O "9 passando" do README só vale na máquina do autor.

### História
Como quem mantém o projeto, quero que `npm test` passe num clone limpo, sem nenhum arquivo local, para confiar nos testes no CI e na máquina de outra pessoa.

### Lógica
1. `src/infra/store.ts`: `loadLocal()` e `persistLocal()` respeitam `process.env.VITALIS_STORE_FILE`; o valor `"memory"` desliga leitura e escrita de arquivo. Exporte `resetStore()`, que esvazia o singleton no lugar (`store.guides.clear()`, `store.verifications.length = 0`, `store.treatments.clear()`, `store.loads.length = 0`).
2. `vitest.config.ts`: `test.env = { VITALIS_STORE_FILE: "memory" }` e `test.setupFiles = ["tests/setup.ts"]`, com `beforeEach(() => resetStore())`.
3. `tests/helpers/demo.ts`: `carregarDemo()` lê `data/guias.csv`, faz `parseGuides` e `verifyBatch` (ref 2026-08-31) e chama `saveLoad("demo.csv", sha256, guides, results)`.
4. `tests/api.test.ts` e `tests/mcp.test.ts` chamam `await carregarDemo()` num `beforeEach`.
5. Se o item D introduzir o repositório com adaptadores, a memória vira o adaptador dos testes e este item se simplifica; mantenha o comportamento descrito.

### Critérios de aceite
- [ ] `rm -f data/.local-store.json && npm test` verde.
- [ ] Depois de `npm test`, `git status` não mostra `data/.local-store.json` criado ou alterado.
- [ ] Os testes existentes mantêm as mesmas asserções (só ganham o carregamento).

---

## Item A. A API da fila não pode devolver dado pessoal (P0)

### Problema (reproduza)
`GET /api/pendencias` (`src/app/api/pendencias/route.ts`) monta cada item com `...result` e `guia: store.guides.get(id)`. Cada item traz a guia inteira (18 campos): paciente, carteirinha, CID e observação da recepção. Isso contradiz `docs/DECISOES-V4.md` (V4-08) e o README. Chaves do primeiro item hoje: `id_guia, status, modo, data_referencia, motivos, avisos, valor, createdAt, loadId, guia, tratamento`, com `guia` de 18 campos. A tela `/pendencias` consome essa rota. Os outros endpoints (`/csv`, `/dashboard`, `/relatorio`, `POST /api/lote`, MCP) estão limpos.

### História
Como recepcionista, quero ver o que preciso corrigir sem que dados de pacientes trafeguem por uma rota pública, para respeitar a privacidade que o projeto prometeu.

### Lógica
Crie `src/servico/publico.ts` com uma única função de saída da fila, usada por TODA rota que devolve pendências:

```ts
export function pendenciaPublica(result, guia, tratamento) {
  return {
    id_guia: result.id_guia,
    guia: guia && { unidade: guia.unidade, convenio: guia.convenio,
                    procedimento_codigo: guia.procedimento_codigo, valor: guia.valor },
    valor: result.valor,
    motivos: result.motivos.map(publicReason),   // já existe em store.ts
    tratamento: { status: tratamento.status },
    verificada_em: result.createdAt,
  };
}
```

- Nenhum `...result` e nenhum objeto de guia inteiro na resposta: liste os campos.
- `publicReason` deve filtrar o `detalhe` por lista branca: `observacao_convenio`, `limite_efetivo`, `dias`, `relacionadas`. Qualquer outra chave é descartada.
- A tela `src/app/pendencias/page.tsx` continua compatível (usa `guia.unidade` e `guia.convenio`).

### Testes
`tests/privacidade.test.ts` (com `carregarDemo()`): monte a lista de valores proibidos a partir de `data/guias.csv` (paciente, carteirinha, CID e cada observação não vazia; não digite valores fixos). Chame e verifique que o texto da resposta não contém nenhum deles em: `GET /api/pendencias` (sem filtro e com filtros), `/api/pendencias/csv`, `/api/dashboard`, `/api/relatorio` (JSON e texto), a resposta de `POST /api/lote`, a resposta de `POST /api/pendencias/[id]` e as saídas do MCP (`consultar_pendencias` em lista e em detalhe, `consultar_regra`). No `/api/pendencias`, confirme também que `Object.keys(item.guia)` está contido em `[unidade, convenio, procedimento_codigo, valor]`.

### Critérios de aceite
- [ ] O teste falha antes da correção (vazamento em `/api/pendencias`) e passa depois.
- [ ] Nenhum endpoint devolve paciente, carteirinha, CID ou observação.

---

## Item E. Estado do tratamento e reenvio de arquivo (P0)

### Problema 1: pendência que reaparece some da tela (reproduza)
Sequência com `G-2608-0031` (que começa pendente por `AUT_VENCIDA`):

1. Carga A (original): 39 pendentes.
2. Marcar "Corrigi": tratamento `AGUARDANDO_REVERIFICACAO`.
3. Carga B (0031 com validade 10/08): 38 pendentes, tratamento `RESOLVIDA`.
4. Carga C (0031 volta a errar, validade 02/08): **39 pendentes, mas o tratamento continua `RESOLVIDA`**, e a guia NÃO aparece na aba padrão "A fazer" (`situacao=ABERTA`). Uma pendência real fica invisível na tela principal.

Causa: `treatmentAfterVerification` (`src/infra/store.ts`) deixa `RESOLVIDA` como está quando a nova verificação é `PENDENTE`.

Correção: `RESOLVIDA` + verificação `PENDENTE` volta a `ABERTA` (novo ciclo). Regras completas:

| Tratamento atual | Nova verificação | Novo tratamento |
| --- | --- | --- |
| sem registro ou `ABERTA` | PENDENTE | inalterado |
| qualquer | OK | `RESOLVIDA` |
| `AGUARDANDO_REVERIFICACAO` | PENDENTE | `EM_TRATAMENTO` |
| `EM_TRATAMENTO` | PENDENTE | inalterado |
| `RESOLVIDA` | PENDENTE | `ABERTA` |

Teste: os 4 passos acima; no passo 4, `0031` aparece com `situacao=ABERTA`. Cubra também cada linha da tabela em teste unitário de `treatmentAfterVerification`. A mesma regra vale no SQL do item D.

### Problema 2: reenvio do mesmo arquivo é silencioso
`saveLoad` devolve o id da carga anterior quando o hash já existe, sem avisar; `POST /api/lote` responde como se tivesse verificado de novo, e o plano (`docs/BACKLOG-V4.md`, Fase 3) prometia "mensagem para arquivo já carregado". Além disso, o modo local compara nome E hash, e o modo Supabase só o hash.

Correção:
- `saveLoad` devolve `{ loadId, jaExistia }`; a comparação é só pelo hash em qualquer modo.
- A resposta de `POST /api/lote` inclui `ja_carregado: boolean`; quando verdadeiro, a tela mostra "Este arquivo já foi carregado. Nada mudou." em vez de um novo resumo.
- Limite a documentar no README: reenviar um arquivo idêntico a uma carga ANTIGA (A, depois B, depois A de novo) não restaura o estado de A.

### Critérios de aceite
- [ ] Os 4 passos do problema 1 viram teste e passam.
- [ ] Enviar o mesmo corpo duas vezes: a segunda resposta tem `ja_carregado: true` e o número de verificações não muda.

---

## Item C. Data de referência e frescor dos dados (P0)

### Problema (reproduza)
`"2026-08-31"` está escrito fixo em 5 arquivos: `src/app/api/lote/route.ts` (`data_referencia`), `src/servico/pendencias.ts` (`hoje = "2026-08-31"`), `src/mcp/formatar.ts` (duas vezes, em "dados de ..."), `src/app/api/relatorio/route.ts` (`data_referencia` e origem "informada") e `src/mcp/ferramentas.ts` (padrão do `verificar_guia`). Consequências: a lista do MCP diz "dados de 31/08/2026" mesmo quando a última carga foi em 21/09, e `defasado` é sempre `false`. Um número velho aparece como atual: exatamente o risco que o aviso de frescor deveria evitar.

### História
Como Dr. Renato, quero ver de quando são os números e ser avisado quando ninguém carrega o lote há 2 ou mais dias úteis, para não decidir com dado velho.

### Lógica
1. `src/infra/relogio.ts`: `agora(): Date` e `hojeEmSaoPaulo(now = agora()): string` (`AAAA-MM-DD`, usando `Intl.DateTimeFormat` com `America/Sao_Paulo`). O núcleo (`src/core`) continua sem ler o relógio.
2. `src/core/dates.ts`: `diasUteis(desde, ate)` conta segundas a sextas em `(desde, ate]`, sem feriados, como no V3.
3. `src/servico/frescor.ts`, função pura:

```ts
calcularFrescor(ultimaCargaISO: string | undefined, hoje: string) => {
  ultima_carga: string | null,            // ISO original
  dia_ultima_carga: string | null,        // AAAA-MM-DD em America/Sao_Paulo
  dias_uteis_desde_ultima_carga: number | null,
  defasado: boolean | null,               // dias úteis >= 2; null se nunca houve carga
}
```
   Sem nenhuma carga, `defasado` é `null` (estado vazio, não alerta).
4. `POST /api/lote`: aceita `?ref=AAAA-MM-DD`. Sem ele, usa `hojeEmSaoPaulo()`. Valor inválido: 400 `PARAMETRO_INVALIDO` com mensagem em português. A resposta traz `resumo.data_referencia` e `resumo.origem_data_referencia` (`"informada"` ou `"padrao_hoje"`). O botão de demonstração da tela e `/api/demo` passam `ref=2026-08-31` de forma explícita, e a tela mostra "Data de referência: dd/mm/aaaa (informada)" ou "(hoje)".
5. `listarPendencias(filtro, ref = hojeEmSaoPaulo())`: `dias_para_prazo` usa `ref`; devolve `frescor` (mantenha `data_ultima_carga` e `defasado` por compatibilidade, agora vindos de `calcularFrescor`).
6. `src/mcp/formatar.ts`: a linha de cabeçalho usa o dia da última carga (`frescor.dia_ultima_carga`), nunca uma data fixa. Quando defasado, logo abaixo do cabeçalho:

```text
Atenção: os dados são de dd/mm/aaaa; faz N dias úteis sem carga. Carregue o lote do dia em Lote.
```
   Casos vazios como hoje, mas com a data real.
7. `verificar_guia` (MCP): o padrão de `data_referencia` passa a ser `hojeEmSaoPaulo()`; a resposta continua trazendo `data_referencia`.
8. `/api/relatorio`, `/api/dashboard` e `/api/pendencias` incluem `frescor`; as três telas mostram "Última carga: dd/mm/aaaa HH:mm" e um aviso visível quando `defasado` for verdadeiro.

### Testes (com relógio simulado: `vi.useFakeTimers({ toFake: ["Date"] })` e `vi.setSystemTime`)
- `calcularFrescor`: carga hoje (0 dias úteis, `defasado` falso); sexta para segunda (1, falso); sexta para terça (2, verdadeiro); sem carga (`null`); carga às 22:00 em São Paulo (01:00 UTC do dia seguinte) conta como o dia de São Paulo; função pura (recebe `hoje`).
- `formatarLista` com `data_ultima_carga = "2026-09-21T03:17:00Z"` mostra "dados de 21/09/2026"; com `"2026-09-22T01:00:00Z"` também mostra 21/09.
- Linha "Atenção: os dados são de..." aparece só quando defasado.
- `POST /api/lote?ref=2026-08-31` fixa a referência; sem `ref` usa o dia do relógio; `?ref=31/08` dá 400.
- Golden inalterado; `grep -rn '"2026-08-31"' src` só pode achar a demonstração explícita.

### Critérios de aceite
- [ ] Nenhuma data de negócio fixa em `src/` além do botão e da rota de demonstração.
- [ ] A lista do MCP mostra a data real da última carga e o aviso de defasagem.

---

## Item D. Modo Supabase completo e erros corretos (P0 para a entrega)

A prova exige uma solução publicada. Hoje só o modo local (memória e arquivo) funciona de ponta a ponta.

### Problemas (por leitura do código; confirme antes)
1. `listarPendencias`, `/api/pendencias`, `/csv`, `/dashboard`, `/relatorio` e `markTreatment` leem `store.guides`, `store.treatments` e `store.verifications` (memória do servidor). Com Supabase ligado esses mapas ficam vazios: a fila sai vazia (`if (!guide) return []`), sem unidade nem convênio, e "Corrigi" não persiste (`markTreatment` só olha a memória).
2. A tabela `tratamentos` do `db/schema.sql` nunca é lida nem escrita.
3. `saveLoad` (ramo Supabase) insere a carga primeiro e depois as guias e as verificações, sem transação. Se uma etapa falhar depois de inserir a carga, o hash já existe e a próxima tentativa devolve "já carregada" sem os dados: a falha envenena a idempotência.
4. `latestResults` (Supabase) lê toda a tabela `verificacoes` sem paginar; o PostgREST corta em 1000 linhas por padrão, em silêncio.
5. Realtime: o dashboard assina `postgres_changes` com a chave anônima, mas as tabelas têm RLS ligado sem política, então o anônimo não recebe eventos. Só o polling de 5 s funciona.
6. Sem Supabase (deploy sem variáveis), `persistLocal()` faz `writeFileSync` num disco somente leitura da Vercel, e `POST /api/lote` responde `CSV_INVALIDO` (o `catch` mapeia todo erro para isso).

### História
Como equipe da clínica, quero que a fila, o "Corrigi" e o dashboard funcionem no ambiente publicado e sobrevivam a reinícios do servidor, para acompanhar o trabalho de verdade.

### Lógica

**D1. Repositório com dois adaptadores.** `src/infra/repositorio.ts` define a interface e escolhe o adaptador por `supabase()`; `repositorio-memoria.ts` (a lógica atual) e `repositorio-supabase.ts`. Rotas e serviços passam a falar só com o repositório (nunca com `store` direto):

```ts
salvarCarga(nome, hash, guias, resultados, ref): Promise<{ id: string; jaExistia: boolean }>
ultimasVerificacoes(): Promise<VerificationRecord[]>     // paginado
guias(): Promise<Map<string, Guia>>                       // uso interno do servidor, nunca serializado
tratamentos(): Promise<Map<string, Treatment>>
marcarTratamento(id_guia, porQuem): Promise<Treatment | undefined>
historicoPorGuia(): Promise<VerificationRecord[]>        // tempo de resolução do dashboard
ultimaCarga(): Promise<{ createdAt: string; nome: string } | null>
```

**D2. SQL (arquivo novo `db/schema-v4-2.sql` ou edição de `db/schema.sql`; escrito sem execução, valide no projeto de TESTE).**

```sql
create or replace view public.ultima_verificacao with (security_invoker = true) as
select distinct on (id_guia) id_guia, carga_id, status, resultado, valor, criada_em
from public.verificacoes order by id_guia, criada_em desc, id desc;

create or replace function public.registrar_carga(p_nome text, p_hash text, p_guias jsonb, p_verificacoes jsonb)
returns jsonb language plpgsql as $$
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
  select v->>'id_guia', v_id, v->>'status', v, nullif(v->>'valor','')::numeric
  from jsonb_array_elements(p_verificacoes) v;
  -- tabela do item E: OK -> RESOLVIDA; PENDENTE: AGUARDANDO -> EM_TRATAMENTO, RESOLVIDA -> ABERTA
  update public.tratamentos t set situacao = case
      when v.status = 'OK' then 'RESOLVIDA'
      when t.situacao = 'AGUARDANDO_REVERIFICACAO' then 'EM_TRATAMENTO'
      else 'ABERTA' end
  from (select x->>'id_guia' id_guia, x->>'status' status from jsonb_array_elements(p_verificacoes) x) v
  where t.id_guia = v.id_guia
    and (v.status = 'OK' or t.situacao in ('AGUARDANDO_REVERIFICACAO', 'RESOLVIDA'));
  return jsonb_build_object('carga_id', v_id, 'ja_existia', false);
end $$;
```

Também: gatilho que bloqueia `update` e `delete` em `verificacoes` e `cargas` (o plano diz "append-only" e o esquema atual não impede); `revoke all` das tabelas e da função para `anon` e `authenticated`; `execute` da função só para `service_role`. Se algo do SQL acima não rodar como escrito, corrija no projeto de teste e registre em `docs/divergencias.md`.

**D3. Leituras paginadas.** `ultimasVerificacoes` lê a view `ultima_verificacao` em páginas de 1000 com `.range()` e ordem estável por `id_guia`; `guias` e `tratamentos` idem. Nunca uma consulta sem `range`.

**D4. Marcar "Corrigi".** `marcarTratamento` faz `upsert` em `tratamentos` (`situacao`, `marcado_por`, `marcada_em`; mapeie para `status`, `markedBy`, `markedAt` do tipo local) só se a guia existir. Guia cuja última verificação é OK: 409 `GUIA_NAO_PENDENTE`.

**D5. Erros.** Classes de erro: `CsvInvalidoError`, `ColunasAusentesError(colunas)`, `BancoIndisponivelError`; qualquer outra vira 500 `ERRO_INTERNO`. `POST /api/lote` responde `{ erro: "CODIGO", mensagem: "texto em português" }` com 400 (CSV inválido, colunas ausentes listadas), 413 (`ARQUIVO_GRANDE`), 503 (`BANCO_INDISPONIVEL`) ou 500. Em `NODE_ENV=production` sem variáveis do Supabase, todas as rotas de dados respondem 503 com "Banco não configurado". O modo arquivo só vale fora de produção; `persistLocal()` fica em `try/catch`. A tela mostra o campo `mensagem`.

**D6. Realtime: DECIDIDO, só polling.** O enunciado não pede tempo real, e o Realtime é a parte mais difícil de validar e de explicar. Faça:
- Remova a assinatura de `postgres_changes` do dashboard e apague `src/infra/supabase-browser.ts`. O dashboard usa polling de 5 s, o botão "Atualizar" e mostra "Última leitura: HH:mm:ss".
- Remova `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` do código e do `.env.example`. Ficam só `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, ambas usadas apenas no servidor. Nenhuma chave do Supabase vai para o navegador.
- Tire a publicação `supabase_realtime` do `db/schema.sql` e ajuste `docs/V4-PLANO.md` (seções 6 e 10) e o README: "atualização por polling a cada 5 s".
- Se o humano decidir manter o Realtime, ele avisa; sem esse aviso, siga esta decisão. Nenhuma política de `select` para `anon` em nenhuma tabela.

### Testes
- Adaptador de memória: toda a suíte atual passa por ele.
- Adaptador Supabase com cliente falso injetado: `salvarCarga` chama `rpc("registrar_carga")` uma vez; erro da RPC vira `BancoIndisponivelError` e não deixa estado parcial (a segunda tentativa reprocessa); leitura paginada busca a página seguinte quando a anterior vem cheia (simule 2.500 linhas).
- Integração real, pulada quando `SUPABASE_URL_TESTE` e a chave de teste não existirem (projeto SEPARADO do de produção): carga da demo mostra 39 pendentes com unidade e convênio; "Corrigi" persiste; recarga corrigida vai a RESOLVIDA; guia resolvida que volta a errar volta a ABERTA; a chave `anon` não lê nenhuma tabela.
- Rotas: sem Supabase em produção, 503 com mensagem em português; erro de banco não vira `CSV_INVALIDO`.

### Critérios de aceite
- [ ] No projeto de teste: reiniciar o servidor mantém fila (39), tratamentos e dashboard iguais ao modo local.
- [ ] A chave anônima não lê nenhuma tabela nem a função (evidência anexada).
- [ ] O dashboard atualiza por polling e mostra a hora da última leitura; nenhuma chave do Supabase no bundle do navegador.

---

## Item H. Alinhamento com o enunciado da prova (P0)

### H1. `verificar_guia` por número da guia

Problema (reproduza): `verificarGuia({ id_guia: "X" })` devolve PENDENTE com 7 motivos, porque todos os outros campos vêm vazios. Se a pessoa pedir "verifica a G-2608-0030" e o assistente mandar só o número, a resposta é enganosa. O enunciado pede o MCP "em cima das regras e das guias".

História: como recepcionista, quero pedir "verifica a G-2608-0030" sem colar os 18 campos.

Lógica:
- Se só `id_guia` vier preenchido (todos os outros campos vazios): busque a guia no repositório (item D) e verifique com os dados guardados. Se não existir, devolva erro do MCP (`isError`) com "Guia não encontrada na base carregada. Cole os dados da guia ou carregue o lote." Nunca PENDENTE por campos vazios.
- Se qualquer outro campo vier preenchido, vale o comportamento atual.
- A resposta continua sem dado pessoal e traz `data_referencia`. Atualize o `SKILL.md`: "se a pessoa informar só o número da guia, chame `verificar_guia` só com `id_guia`".
- `consultar_pendencias` em modo detalhe: guia com última verificação OK responde "G-... está OK na última verificação (dd/mm/aaaa). Nenhum ajuste necessário."; guia desconhecida mantém "não está na lista de ajustes" (teste existente), acrescentando "e não foi encontrada nas guias carregadas".

Testes (com `carregarDemo()`): só o id de 0030 → PENDENTE com `AUT_VENCIDA` e `TXT_AUTORIZACAO_NOVA_NAO_LANCADA`; só o id de 0001 → OK; id inexistente → `isError`; id mais campos → igual ao de hoje; detalhe de guia OK.

### H2. Relatório de terça legível

`GET /api/relatorio?formato=texto` hoje sai sem acentos e com códigos crus (`AUT_VENCIDA: 13`). O Dr. Renato precisa saber: quantas guias foram verificadas, quantas têm problema, de que tipo e quanto dinheiro está em risco. Formato do texto:

```text
Relatório de terça — referência dd/mm/aaaa
Última carga: dd/mm/aaaa HH:mm
Guias verificadas: 80
OK: 41
Com problema: 39
Valor em risco (guias duplicadas contam uma vez): R$ 2.664,00
Aguardando reverificação: N
Problemas por tipo (uma guia pode ter mais de um):
- autorização vencida: 13
- campo obrigatório vazio: 8
...
```

Use `rotuloMotivo`, ordene por quantidade decrescente (empate pelo nome) e conte GUIAS por tipo. Com a demonstração: 80 / 41 / 39 / R$ 2.664,00 e, por tipo, autorização vencida 13, campo obrigatório vazio 8, sessão acima do limite 6, procedimento não coberto 5, guia duplicada 4, duas autorizações diferentes 2 e um de cada sinal de texto (autorização nova ainda não lançada, sessão remarcada, paciente pediu faturamento particular, autorização verbal sem número, procedimento realizado diferente do lançado). A soma por tipo é 43, maior que 39 porque algumas guias têm mais de um problema. A página `/relatorio` mostra os mesmos rótulos.

### H3. README (você escreve só a parte técnica)

- Sem os nomes "V3" e "V4" e sem "base reaproveitada": o projeto nasceu para esta prova. Descreva o que é, para quem, e o fluxo (CSV, verificação, fila, reenvio).
- Seções técnicas: Como executar (instalar, `dev`, `test`, `typecheck`, `build`, variáveis, aplicar o SQL, deploy); **Como instalar o MCP** (URL `https://<domínio>/api/mcp`, como adicionar como conector remoto no Claude, com a ressalva de que depende do plano e da política do workspace; não declare compatibilidade com ChatGPT sem teste); **Onde está a Skill** (`skills/conferir-guia/`); Como testei (números reais, depois das correções); Limites conhecidos (sem autenticação; o nome de quem marcou é digitado; regras de palavra-chave; o sistema não escreve no sistema de gestão).
- **"Como fiz": crie só o esqueleto** com os cinco tópicos que o enunciado exige, cada um com o marcador `[O CANDIDATO ESCREVE]`: ferramentas e por quê; o que a IA gerou e o que ele mudou na mão (pelo menos três decisões dele); o que ficou de fora e por quê; como testou; quanto tempo levou. Não preencha decisões nem horas.

### H4. Gabarito no repositório e golden por guia

O README cita `docs/fixtures/` (gabarito independente), mas a pasta não está no repositório, e o `tests/golden.test.ts` só confere totais e duplicidade. O critério "as decisões batem com o que está errado" pede a conferência guia a guia.
- O humano fornece `docs/fixtures/` (`gabarito_agosto_2026.csv`, `resumo_esperado.json`, `gerar_gabarito.py`). Copie para o repositório.
- O golden passa a comparar, para cada uma das 80 guias, status, conjunto de códigos e avisos com `gabarito_agosto_2026.csv`, e a falhar listando as guias que divergem. Hoje as 80 batem (verificado fora do vitest).
- Confira no ambiente do agente se `gerar_gabarito.py` reproduz o `resumo_esperado.json` (script independente do núcleo).

### H5. Erros de CSV que dizem onde está o problema

Hoje uma linha com campos a mais ou a menos rejeita o arquivo inteiro com `CSV_INVALIDO`, sem dizer qual. Arquivo só com cabeçalho responde 200 com 0 guias.
- `CsvInvalidoError` carrega o número da linha (base do arquivo, contando o cabeçalho) e o motivo: "Linha 7: 10 campos; esperado 18." Continue rejeitando o arquivo inteiro, sem carga parcial.
- Arquivo sem nenhuma guia: 400 `CSV_VAZIO` com "O arquivo não tem nenhuma guia."
- Mantenha o que já funciona: vírgula, `;`, BOM, CRLF, colunas extras e em outra ordem.
- Testes para cada caso, sem carga gravada quando há erro.

### H6. Prompts no repositório

O enunciado lista "prompts" entre os itens do repositório. Crie `docs/prompts/` com um `README.md` que explica o que são e copie para lá, sem alterar, os briefings que você recebeu (incluindo este documento). O humano acrescenta os prompts que ele mesmo usou com outras ferramentas.

### H7. Guias explicadas para a entrevista (P1)

O candidato será perguntado por que algumas guias caíram onde caíram. Crie `scripts/explicar-guias.ts` (roda o núcleo sobre `data/guias.csv`, ref 2026-08-31) que gera `docs/GUIAS-EXPLICADAS.md`: uma linha por guia pendente com o id, os rótulos, o "por quê" tirado do `detalhe` (validade, atendimento, limite efetivo, guias relacionadas) e o campo afetado, agrupada por tipo de problema; e uma seção destacando os casos que exigem explicação: 0017/0060 (conflito de autorização), 0027/0057 (duplicidade detectada só depois de normalizar a data), 0059/0076 (duplicidade), 0041 (autorização verbal), 0069 (procedimento diferente do lançado), 0035 (consulta no Plano Bem, não coberta). O arquivo é gerado pelo script, nunca digitado à mão.

---

## Item F. Documentação coerente com o código (P1)

- `docs/V4-PLANO.md` (seção 9 e critérios de aceite) e `docs/CLAUDE-TESTE.md` (passo 2) dizem "exatamente duas ferramentas", mas o código, a Skill e o README têm três, e o `docs/divergencias.md` registra o motivo. Alinhe tudo a "pelo menos duas; o projeto tem três". Está decidido: o enunciado da prova pede "pelo menos duas ferramentas", então três é permitido e os nomes não são fixos.
- `README.md`: a rota de upload é `/`, não `/guias`; a seção "Como executar" aponta para o `V4-PLANO`, que não tem comandos, então escreva os passos aqui (instalar, `dev`, `test`, `typecheck`, `build`, variáveis, aplicar o SQL, deploy). Atualize "Como testei" com os números reais depois das correções. Acrescente "Limites conhecidos": sem autenticação; o nome de quem marcou é digitado; reenviar um arquivo idêntico a uma carga antiga não restaura o estado.
- `docs/BACKLOG-V4.md` diz que MCP e Skill "não fazem parte desta fase", mas já existem; `data/README.md` diz que o código ainda não foi criado. Atualize os dois.

---

## Item G. Ajustes menores (opcional, só se sobrar tempo)

1. Desempate da fila: prazo, depois **valor decrescente**, depois `id_guia`. Com `responsavel = todos`, as cinco primeiras devem ser 0035, 0031, 0002, 0063, 0039 (hoje sai 0039 antes de 0063).
2. Erros de entrada do MCP (`limite` fora de 1 a 50, `responsavel` desconhecido) devem devolver mensagem em português (`isError`), não `ZodError` cru.
3. `POST /api/pendencias/[id]` aceita `por_quem` (1 a 60 caracteres, padrão "Equipe"), grava e mostra na tela; o plano promete registrar o responsável.
4. `saveLoad` usa o nome real do arquivo enviado em vez de `"upload.csv"`.
5. Exportação CSV: células com `;`, aspas ou quebra de linha precisam de escape (hoje só as fórmulas são protegidas).

---

## Definição de pronto

- `rm -f data/.local-store.json && npm test && npm run typecheck && npm run build` verdes.
- `tests/privacidade.test.ts` cobre todos os endpoints e passa.
- Golden inalterado (41 OK, 39 pendentes, R$ 2.664,00).
- Nenhuma data de negócio fixa fora da demonstração; o frescor aparece nas três telas e no MCP.
- Supabase de teste validado (item D) e o SQL revisado registrado em `docs/divergencias.md`.
- Documentos alinhados ao código (item F) e ao enunciado (item H): README com Como executar e Como instalar o MCP, esqueleto de "Como fiz" sem preenchimento, `docs/fixtures/` e `docs/prompts/` no repositório.
- Golden por guia (80 de 80) e `verificar_guia` por número da guia funcionando.
- Nenhuma chave, senha ou `.env` no repositório nem no build (varredura registrada).
- Relatório final por item com a evidência de cada critério e a lista do que NÃO foi verificado.
