# Vitalis V4 - Status final

Este documento e a referencia canonica do que esta sendo entregue nesta POC. Os documentos de planejamento, epicos e stories antigos serviram como referencia de produto, mas nao definem requisitos que nao estejam implementados no codigo final.

## Objetivo

Conferir guias medicas antes do envio ao convenio, identificar pendencias e duplicidades, orientar a correcao na origem, receber uma nova carga CSV e acompanhar risco financeiro, tratamento e historico.

A POC nao substitui o sistema de gestao da clinica. O CSV e a ponte operacional entre os dois sistemas.

## Entrega

### Incluido

- Upload de CSV individual e em lote.
- Verificacao deterministica baseada em `data/regras_convenio.json`.
- Validacao de campos, cobertura, autorizacao, validade, sessoes, datas, prazos, duplicidade e observacoes.
- Persistencia no Supabase em ambiente publicado.
- Fallback local em memoria ou arquivo fora de producao.
- Idempotencia de carga por hash do arquivo.
- Fila de pendencias com filtros, detalhes, responsavel e exportacao CSV.
- Tratamento humano sem alterar o resultado tecnico.
- Dashboard por periodo.
- Relatorio textual e PDF.
- Historico de verificacoes e transicoes de tratamento.
- Revisoes humanas de observacoes lidas pelo leitor de IA.
- MCP HTTP autenticado e Skill `conferir-guia`.
- Atualizacao das telas por polling, sem dependencia de Realtime.

### Fora do escopo

- Escrita de volta no sistema de gestao.
- Envio automatico por WhatsApp.
- Autenticacao completa de usuarios da aplicacao.
- Reverificacao automatica por cron.
- Integracao Realtime como mecanismo de atualizacao.
- O MCP nao executa alteracoes de tratamento nem substitui a tela operacional.
- Garantia de cobertura de testes de interface, acessibilidade ou carga de producao.

## Fluxo operacional

```text
CSV
  |
  v
POST /api/lote
  |
  v
verificacao deterministica
  |
  +-- OK ------> historico e indicadores
  |
  +-- PENDENTE -> fila de pendencias
                    |
                    v
              correcao na origem
                    |
                    v
              Corrigi
                    |
                    v
        AGUARDANDO_REVERIFICACAO
                    |
                    v
              novo CSV
                    |
          +---------+---------+
          |                   |
       PENDENTE              OK
          |                   |
          v                   v
    EM_TRATAMENTO          RESOLVIDA
```

O botao `Corrigi` nunca transforma uma guia em `OK`. A guia somente sai da fila tecnica quando uma nova verificacao do mesmo `id_guia` retorna `OK`.

## Estados

### Verificacao tecnica

Persistida em `verificacoes.status`:

- `OK`: a verificacao nao encontrou pendencia tecnica.
- `PENDENTE`: a verificacao encontrou um ou mais motivos.

### Tratamento operacional

Persistido em `tratamentos.situacao`:

- `ABERTA`: pendencia nova ou reaberta.
- `EM_TRATAMENTO`: nova verificacao ainda retornou `PENDENTE`.
- `AGUARDANDO_REVERIFICACAO`: a equipe informou a correcao na origem, mas ainda nao houve nova carga.
- `RESOLVIDA`: nova verificacao retornou `OK`.

Os estados sao independentes. Uma guia pode estar tecnicamente `PENDENTE` e operacionalmente `AGUARDANDO_REVERIFICACAO`.

## Regra de verificacao

O nucleo deterministico e compartilhado pelas APIs, carga web, MCP e testes. A ordem conceitual e:

1. Normalizacao dos dados de entrada.
2. Aplicacao das regras do convenio.
3. Validacao de datas, autorizacoes, sessoes e prazos.
4. Identificacao de duplicidades e conflitos.
5. Leitura opcional de observacoes.
6. Consolidacao do resultado.

O resultado final e `OK` somente quando nao existem motivos tecnicos. Avisos e revisoes de observacao nao aprovam uma guia pendente.

## Duplicidade e valor financeiro

A chave de exposicao e:

```text
paciente + data_atendimento normalizada + procedimento_codigo
```

`DUPLICADA` e `CONFLITO_AUTORIZACAO` mantem todas as guias do grupo como `PENDENTE`, porque todas precisam de tratamento operacional.

Para dinheiro, o grupo representa uma unica exposicao:

- A quantidade de pendencias conta todas as guias.
- O valor bruto soma todas as guias pendentes.
- O valor em risco conta uma exposicao por grupo.
- Se houver valores diferentes no mesmo grupo, usa-se o maior valor do grupo.
- A escolha e deterministica e nao depende da ordem do CSV.
- A mesma regra vale para `DUPLICADA` e `CONFLITO_AUTORIZACAO`.

Implementacao: `src/core/batch.ts` e `src/core/metrics.ts`.

## Glosa evitada

Uma exposicao entra em `glosa_evitada` somente quando:

1. Existia uma verificacao anterior `PENDENTE`.
2. O mesmo grupo foi carregado novamente.
3. A nova verificacao retornou `OK` para todas as guias pendentes do grupo de exposicao.

Resolver uma revisao de observacao nao gera glosa evitada. A mesma exposicao nao e somada duas vezes no mesmo ciclo. O valor usa a mesma deduplicacao do risco.

Implementacao: `src/servico/relatorio.ts`.

## Dashboard, relatorio e PDF

Dashboard, relatorio textual e PDF usam o mesmo calculo de periodo e a mesma base recarregada do Supabase.

Os indicadores principais sao:

- `verificadas`: guias com verificacao ocorrida dentro do periodo.
- `ok`: guias cujo ultimo resultado dentro do periodo e `OK`.
- `pendentes`: snapshot das guias tecnicamente pendentes no fechamento do periodo.
- `valor_em_risco`: exposicao deduplicada das pendencias no fechamento.
- `glosa_evitada`: exposicoes que passaram de `PENDENTE` para `OK` no periodo.
- `glosa_nao_recuperavel`: exposicoes com autorizacao vencida, sessao acima do limite, procedimento nao coberto ou procedimento realizado diferente.
- `risco_por_convenio`: valor em risco deduplicado por convenio; nao representa glosa confirmada.
- `aguardando_reverificacao`: tratamentos nesse estado no fechamento, usando evento historico ou `marcada_em` quando necessario para recuperar registros antigos.

O PDF informa o periodo, data de geracao, guias verificadas, guias pendentes, valor em risco, risco de glosa nao recuperavel, glosa evitada, aguardando reverificacao, distribuicoes gerais e a regra financeira de deduplicacao. Ele nao herda filtros do dashboard.

## Atualizacao dos dados

As rotas de leitura chamam `latestResults()` antes de calcular os indicadores. No Supabase, essa funcao recarrega:

- todas as verificacoes;
- guias atuais;
- tratamentos;
- eventos de tratamento;
- revisoes de observacao;
- cargas.

A view `ultima_verificacao` seleciona o resultado mais recente por `id_guia`, ordenando por `criada_em DESC, id DESC`.

As telas usam `cache: no-store` e polling:

- Dashboard: 5 segundos.
- Pendencias: 15 segundos.
- Contador de pendencias: 15 segundos.
- Revisoes: 15 segundos.

## Supabase

O nucleo Vitalis usa:

- `cargas`: arquivos recebidos, hash, quantidade e data.
- `guias`: ultima versao dos dados de cada guia.
- `verificacoes`: historico append-only dos resultados tecnicos.
- `tratamentos`: estado operacional atual.
- `tratamento_eventos`: historico append-only de transicoes.
- `observacao_revisoes`: revisoes humanas das observacoes.
- `ultima_verificacao`: view do resultado mais recente por guia.
- `registrar_carga`: RPC atomica de persistencia da carga principal.

O navegador nunca acessa o banco diretamente. O service role fica somente no servidor Vercel.

Documentacao do banco: `db/README.md`.

Auditoria somente leitura: `db/auditoria.sql`.

## Leitor de IA

O leitor e ativado por `LEITOR_IA=on` e roda somente no servidor durante `POST /api/lote`.

A cascata configurada e:

1. Gemini.
2. OpenRouter.
3. Groq.

O leitor:

- processa observacoes nao vazias;
- mascara CPF, telefone e e-mail antes do envio;
- valida a resposta estruturada;
- deduplica chamadas repetidas dentro do mesmo lote por observacao, contexto, modelo e versao do prompt;
- aplica limite de concorrencia e orcamento de tempo;
- transforma falha ou timeout em `nao_lida`;
- nunca altera `OK`, `PENDENTE`, valor, cobertura, validade, prazo ou motivos deterministas.

As revisoes de observacao sao separadas das pendencias tecnicas. Resolver uma revisao nao resolve a guia.

## MCP e Skill

Endpoint: `/api/mcp`.

O MCP e HTTP e autenticado por `Authorization: Bearer <MCP_AUTH_TOKEN>`.

Ferramentas:

- `consultar_regra`: consulta convenio, procedimento, cobertura, limites e prazo.
- `verificar_guia`: verifica uma guia com os campos estruturados recebidos.
- `consultar_pendencias`: consulta a fila operacional persistida, sem alterar tratamentos.

O MCP nao recebe service role e nao chama o leitor de IA em tempo real.

A Skill esta em `skills/conferir-guia/SKILL.md`. Ela ajuda a extrair campos e explicar resultados, mas nao inventa dados nem recomenda alterar datas para obter aprovacao.

## Privacidade e seguranca

- Dados ficticios sao usados na amostra.
- Paciente, carteirinha, CID e observacao nao sao expostos na fila publica ou no CSV de pendencias.
- Chaves de IA e service role nao entram no navegador, bundle, MCP, logs ou Git.
- Verificacoes, cargas e eventos historicos sao append-only.
- A ausencia de Supabase em producao retorna `503`.
- Autenticacao completa de usuarios ainda nao faz parte da POC.

## Testes e validacao

Comandos executados:

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Estado atual:

- 31 testes passando em 10 arquivos.
- Typecheck passando.
- ESLint passando.
- Build passando.

Cobertura principal:

- Golden original: 80 guias, 41 `OK`, 39 `PENDENTE`, R$ 2.664,00 em risco.
- Golden ajustado: 80 guias, 49 `OK`, 31 `PENDENTE`, R$ 2.116,00 em risco; bloqueios de glosa permanecem visíveis.
- Duplicidade e conflito de autorizacao.
- Risco deduplicado por grupo.
- Glosa evitada apos reverificacao `OK`.
- Fluxo `AGUARDANDO_REVERIFICACAO` -> `EM_TRATAMENTO` -> `RESOLVIDA`.
- Idempotencia de carga por hash.
- Privacidade da fila e exportacao.
- Leitor de observacoes e revisoes.
- Ferramentas MCP e Skill; o endpoint HTTP autenticado deve ser validado separadamente em ambiente de integracao.
- Geracao de PDF.

## Fixtures oficiais de validacao

O criterio principal da POC usa duas cargas de 80 guias:

### Base com erros intencionais

Arquivo: `data/guias.csv`.

- 80 guias verificadas.
- 41 `OK`.
- 39 `PENDENTE`.
- R$ 2.886,00 de soma bruta das pendencias.
- R$ 2.664,00 de valor em risco apos deduplicacao financeira.
- Duplicidades e conflitos permanecem pendentes na fila.

### Carga de reverificacao

Arquivo: `data/guias-ajustadas.csv`.

- 80 guias verificadas.
- 49 `OK`.
- 31 `PENDENTE`.
- R$ 2.116,00 de valor em risco.
- Permanecem `AUT_VENCIDA`, `PROCEDIMENTO_NAO_COBERTO`, `SESSAO_ACIMA_DO_LIMITE`, duplicidades, conflitos e sinais de autorizacao ainda nao lancada.

Essa carga e gerada por `scripts/gerar-guias-ajustadas.mjs` e serve para testar a reverificacao sem mascarar bloqueios que ainda podem gerar glosa. Uma guia so sai da fila quando a nova verificacao realmente retorna `OK`.

## Validacao de producao

Ambiente: `https://vitalis-ei.vercel.app`.

O smoke test confirmou:

- Pagina inicial: `200`.
- Dashboard: `200`.
- Pendencias: `200`.
- Relatorio: `200`.
- PDF: `200 application/pdf`.
- Dashboard e relatorio com indicadores iguais.
- Supabase sem referencias quebradas entre cargas, guias, verificacoes e eventos.

O ambiente de producao foi validado por smoke test de leitura, dashboard, fila, relatorio e PDF. Os valores de aceite da POC devem ser conferidos usando os dois fixtures oficiais acima, e nao usando cargas acumuladas de testes anteriores no banco publicado.

O Supabase possui auditoria reproduzivel em `db/auditoria.sql`. A consulta financeira normaliza datas no mesmo formato usado por `duplicateKey` e permite reconciliar soma bruta, grupos e valor deduplicado.

## Limitacoes conhecidas

- A aplicacao ainda nao possui autenticacao completa de usuarios.
- Endpoints de mutacao dependem da protecao de infraestrutura enquanto a POC nao tem identidade de usuario.
- O MCP exige token, mas nao substitui controle de acesso completo da aplicacao.
- O leitor de IA depende de disponibilidade e limites dos provedores.
- O CSV corrigido precisa ser exportado e carregado manualmente.
- Nao existe escrita de volta no sistema de gestao.
