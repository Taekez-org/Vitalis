# Espelho do banco Vitalis

Este diretorio documenta a organizacao do banco usado pela POC e oferece consultas somente leitura para auditoria. O objetivo e permitir que outra pessoa entenda o fluxo sem acessar secrets ou depender do codigo da aplicacao.

## Escopo

O schema principal da POC esta em `schema.sql`. Ele representa as tabelas, a view `ultima_verificacao`, a RPC `registrar_carga`, os indices, triggers e grants usados pelo fluxo de conferencia.

As migracoes do projeto Supabase podem conter outros dominios da mesma conta. As tabelas abaixo sao o nucleo Vitalis usado pela aplicacao.

## Modelo de dados

| Objeto | Responsabilidade | Escrita principal | Leitura principal |
| --- | --- | --- | --- |
| `cargas` | Registro imutavel de cada CSV recebido, hash, nome, quantidade e data | `registrar_carga` | `src/infra/store.ts` |
| `guias` | Ultima versao dos dados da guia, identificada por `id_guia` | `registrar_carga` com upsert | `src/infra/store.ts` |
| `verificacoes` | Historico append-only de cada resultado tecnico `OK` ou `PENDENTE` | `registrar_carga` | `ultima_verificacao`, `src/infra/store.ts` |
| `tratamentos` | Estado operacional atual da guia | `registrar_carga` e `markTreatmentAsync` | fila, dashboard e relatorio |
| `tratamento_eventos` | Historico append-only de transicoes operacionais e tecnicas | `registrar_carga` e `markTreatmentAsync` | historico e relatorio |
| `observacao_revisoes` | Revisoes humanas de observacoes tratadas pelo leitor de IA | `persistObservationRevisions` e API de revisoes | `src/infra/store.ts`, `/api/revisoes` |
| `ultima_verificacao` | View que seleciona o resultado mais recente por guia | nenhuma; derivada | `markTreatmentAsync` e fila |

## Relacionamentos

```text
cargas 1 ---- N verificacoes N ---- 1 guias
  |                 |
  +---- N tratamento_eventos ---- 1 guias

guias 1 ---- 1 tratamentos
guias 1 ---- N observacao_revisoes
```

`verificacoes` e `tratamento_eventos` sao historicos. Eles nao devem ser atualizados ou apagados. A guia em `guias` e propositalmente atualizada para que as telas tenham os dados atuais, enquanto o resultado tecnico continua preservado em `verificacoes`.

## Separacao de estados

### Estado tecnico

Coluna `verificacoes.status`:

- `OK`: a ultima conferencia tecnica nao encontrou pendencia.
- `PENDENTE`: a ultima conferencia tecnica encontrou um ou mais motivos.

### Estado operacional

Coluna `tratamentos.situacao`:

- `ABERTA`: pendencia nova ou reaberta.
- `EM_TRATAMENTO`: a guia foi reverificada e continua pendente.
- `AGUARDANDO_REVERIFICACAO`: alguem informou que corrigiu a origem, mas ainda nao houve nova carga.
- `RESOLVIDA`: a nova verificacao retornou `OK`.

O clique em `Corrigi` nunca altera `verificacoes.status`. Ele apenas grava `AGUARDANDO_REVERIFICACAO` e um evento. Uma nova carga pendente muda o tratamento para `EM_TRATAMENTO`; uma nova carga `OK` muda para `RESOLVIDA`.

## Fluxo de carga

1. `POST /api/lote` le o CSV e executa `verifyBatch`.
2. `registrar_carga` grava a carga, atualiza as guias, insere verificacoes e registra eventos.
3. A aplicacao recarrega `verificacoes`, `guias`, `tratamentos`, eventos e cargas do Supabase.
4. `ultima_verificacao` seleciona o resultado mais recente por `id_guia` usando `criada_em DESC, id DESC`.
5. Dashboard, fila, relatorio textual e PDF calculam a partir do mesmo snapshot carregado.

O hash unico em `cargas.hash_arquivo` torna o reenvio do mesmo CSV idempotente.

## Regra financeira

`paciente + data_atendimento + procedimento_codigo` forma a chave de exposicao financeira.

- Todas as guias do grupo continuam tecnicamente pendentes quando ha duplicidade ou conflito.
- O contador de pendencias conta todas as guias.
- O valor em risco conta uma exposicao por grupo.
- Se os valores do grupo forem diferentes, usa o maior valor, de modo deterministico e conservador.
- `DUPLICADA` e `CONFLITO_AUTORIZACAO` seguem a mesma regra financeira.
- A glosa evitada usa a mesma chave e o mesmo maior valor, somente depois de uma reverificacao `OK`.

Implementacao: `src/core/batch.ts`, `src/core/metrics.ts` e `src/servico/relatorio.ts`.

## Leitor de IA

O leitor e controlado por `LEITOR_IA=on`. Quando ligado, `POST /api/lote` chama `processarObservacoes` para observacoes nao vazias, respeitando concorrencia e orcamento de tempo. O resultado e salvo em `verificacoes.resultado.observacao` e as revisoes relevantes sao persistidas em `observacao_revisoes`.

O leitor de IA nao altera `OK`, `PENDENTE`, valor em risco ou motivos deterministas. Falha ou timeout gera observacao `nao_lida` para revisao humana.

## Auditoria de producao

Execute as consultas em `auditoria.sql` com o Supabase CLI:

```bash
npx supabase db query --linked --file db/auditoria.sql
```

As consultas nao fazem `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `ALTER` ou `DROP`. Elas verificam contagens, cargas, estados, integridade referencial, view, funcao e eventos sem carga.

## Pontos de codigo

- Persistencia e sincronizacao: `src/infra/store.ts`
- Cliente Supabase server-side: `src/infra/supabase.ts`
- Regras de verificacao e duplicidade: `src/core/batch.ts`
- Risco deduplicado: `src/core/metrics.ts`
- Snapshot historico e glosa evitada: `src/servico/relatorio.ts`
- Carga: `src/app/api/lote/route.ts`
- Dashboard: `src/app/api/dashboard/route.ts`
- Relatorio e PDF: `src/app/api/relatorio/route.ts` e `src/app/api/relatorio/pdf/route.ts`
- Fila: `src/app/api/pendencias/route.ts` e `src/app/pendencias/page.tsx`
