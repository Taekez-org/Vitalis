# Stories: Revisao assistida de observacoes com Groq

Referencia: `docs/EPICO-REVISAO-OBSERVACOES-GROQ.md`.

## OBS-GROQ-01 - Separar sinais deterministas do resultado da guia

**Como** mantenedor do motor, **quero** separar a leitura de texto da verificacao de dados, **para** adicionar o Groq sem tornar `verify` dependente de rede.

### Escopo

- Extrair `textSignals` de `src/core/verify.ts` como funcao pura.
- Manter os codigos `TXT_*` e as acoes atuais.
- Definir tipos para sinais deterministas, leitura Groq, revisao e origem.
- Preservar o resultado atual quando a IA estiver desligada.

### Aceite

- `verify` continua sincrono e deterministico.
- Nenhuma chamada externa existe no nucleo.
- O golden continua com 80 guias, 41 OK e 39 pendentes.
- Os casos atuais de observacao continuam cobertos.

## OBS-GROQ-02 - Combinar resultado deterministico e alerta de observacao

**Como** sistema, **quero** combinar resultados sem misturar estados, **para** mostrar pendencias tecnicas e revisoes sem alterar a verdade do motor.

### Escopo

- Criar `combinarResultadoObservacao` como funcao pura.
- Preservar motivos deterministas sempre.
- Permitir revisao Groq em guia `OK` ou `PENDENTE`.
- Tratar `rotina`, `sinal`, `revisar`, `nao_lida` e `desligada`.

### Aceite

- Alerta Groq nao transforma `OK` em `PENDENTE` automaticamente.
- Motivo determinista nunca e removido.
- Uma guia pode conter pendencia deterministica e revisao Groq simultaneamente.
- A origem da revisao fica explicita.

## OBS-GROQ-03 - Mascarar observacoes e proteger contra prompt injection

**Como** responsavel por privacidade, **quero** enviar apenas texto mascarado e tratado como dado, **para** reduzir exposicao e impedir que a observacao controle o sistema.

### Escopo

- Mascarar CPF, telefone e e-mail.
- Delimitar a observacao como dado no prompt.
- Impedir que comandos presentes na observacao alterem a instrucao.
- Limitar e sanitizar o motivo retornado pelo modelo.

### Aceite

- Dados mascarados nao chegam ao provedor.
- Observacao nao altera status, campos ou regras.
- Resposta fora do esquema e rejeitada.
- Texto original nao aparece em logs ou respostas publicas.

## OBS-GROQ-04 - Implementar leitor Groq com falha segura

**Como** aplicacao, **quero** consultar o Groq com limites claros, **para** manter a carga funcional mesmo quando o provedor falhar.

### Escopo

- Interface `LeitorObservacao`.
- Implementacao Groq e leitor falso para testes.
- Modelo e chave somente por ambiente.
- Timeout de chamada, limite de concorrencia e orcamento por carga.
- Sem retry automatico.

### Aceite

- HTTP nao 2xx, timeout, JSON invalido e resposta fora do esquema viram `nao_lida`.
- A carga termina mesmo com o Groq indisponivel.
- Nenhuma chave aparece em resposta, log ou bundle.
- O MCP nao faz chamada ao Groq.

## OBS-GROQ-05 - Cachear leituras por contexto

**Como** aplicacao, **quero** reutilizar leituras validas, **para** reduzir custo e latencia sem reaproveitar uma classificacao em contexto diferente.

### Escopo

- Chave baseada em observacao normalizada, contexto da regra, versao do prompt e modelo.
- Cache local e Supabase.
- Nao cachear falhas como leituras validas.
- Invalidar por mudanca de prompt, modelo ou documentacao.

### Aceite

- Mesmo texto e mesmo contexto fazem uma chamada no maximo.
- Mesmo texto em outro contexto pode gerar nova chamada.
- Uma nova versao do prompt invalida a leitura anterior.
- A resolucao humana continua sendo especifica para `id_guia` e chave da leitura.

## OBS-GROQ-06 - Processar todas as guias com observacao

**Como** equipe da clinica, **quero** que toda guia com observacao seja revisada, **para** nao ignorar informacoes relevantes mesmo quando a guia tambem tenha erro deterministico.

### Escopo

- Integrar o servico ao fluxo de lote.
- Processar guias `OK` e `PENDENTE` quando houver observacao.
- Ignorar valores vazios, nulos ou compostos apenas por espacos.
- Retornar contagens de rotina, alertas, revisoes e nao lidas.

### Aceite

- Guia sem observacao gera zero chamada.
- Guia com observacao sempre gera leitura, cache hit ou `nao_lida`.
- A falha do Groq nao bloqueia a persistencia do lote.
- O resultado deterministico permanece inalterado.

## OBS-GROQ-07 - Persistir revisoes de observacao

**Como** equipe operacional, **quero** persistir revisoes separadamente das pendencias, **para** acompanhar alertas do Groq sem falsificar os indicadores tecnicos.

### Escopo

- Tabela/cache de leituras.
- Tabela de revisoes por `id_guia` e chave da leitura.
- Adaptador de memoria e Supabase.
- Estado aberto/resolvido, responsavel, data e comentario opcional.

### Aceite

- Revisao Groq nao altera `status_verificacao`.
- A mesma observacao nao reabre infinitamente uma revisao resolvida no mesmo contexto.
- Observacao ou contexto alterado gera nova revisao.
- Falha de leitura fica distinta de rotina e alerta valido.
- RLS e acesso somente pelo servidor seguem o padrao atual.

## OBS-GROQ-08 - Resolver revisao humana

**Como** atendente ou Carla, **quero** resolver uma revisao de observacao, **para** registrar que o alerta foi analisado mesmo que a observacao continue no CSV.

### Escopo

- Endpoint para listar revisoes abertas.
- Endpoint para resolver uma revisao.
- Registro de responsavel, horario e comentario opcional.
- Separacao visual de revisao Groq e pendencia deterministica.

### Aceite

- `Resolver revisao` encerra somente o alerta Groq.
- A acao nao muda `OK`, `PENDENTE`, valor em risco ou motivos deterministas.
- Uma pendencia deterministica continua exigindo novo CSV e resultado `OK`.
- A tela identifica a origem do alerta.
- Sem autenticacao, o limite fica documentado; em producao, a acao deve ser protegida.

## OBS-GROQ-09 - Expor revisoes no dashboard, relatorio e MCP

**Como** atendente ou Carla, **quero** consultar revisoes pelos canais existentes, **para** tratar alertas sem acessar o Groq diretamente.

### Escopo

- Aba `Para revisar`.
- Contadores separados no dashboard e relatorio.
- MCP consulta revisoes persistidas.
- MCP informa quando existem revisoes abertas, sem iniciar leitura nova.

### Aceite

- Revisoes nao entram na contagem de pendencias deterministicas.
- Revisoes nao entram automaticamente no valor em risco.
- O MCP funciona mesmo com Groq fora do ar.
- Nenhuma resposta exibe a observacao original ou dados pessoais.

## OBS-GROQ-11 - Contabilizar glosa evitada somente apos reverificacao OK

**Como** Dr. Renato, Carla ou responsavel pelo acompanhamento, **quero** contabilizar glosa evitada somente depois da segunda verificacao, **para** nao tratar alerta humano ou resultado inicial como economia confirmada.

### Escopo

- Identificar a transicao de uma guia `PENDENTE` para `OK` em uma nova carga.
- Separar `valor_em_risco` atual de `glosa_evitada` confirmada.
- Evitar dupla contagem por guia e por ciclo de pendencia.
- Exibir a metrica no relatorio e no dashboard conforme a regra aprovada.

### Aceite

- Guia `OK` desde a primeira carga nao entra em glosa evitada.
- Resolver uma revisao Groq nao entra em glosa evitada.
- Guia `PENDENTE` que continua `PENDENTE` nao entra em glosa evitada.
- Guia que retorna `OK` em nova carga entra uma unica vez no ciclo correspondente.
- O valor contabilizado e rastreavel ate a verificacao que abriu a pendencia.
- A metrica nao altera `valor_em_risco` das pendencias ainda abertas.

## OBS-GROQ-12 - Dashboard historico e relatorio PDF por periodo

**Como** Dr. Renato, Carla ou responsavel pelo acompanhamento, **quero** filtrar o Dashboard por dia, semana, mes ou intervalo personalizado e baixar um PDF, **para** acompanhar risco e glosa evitada sem perder o historico das cargas.

### Escopo

- Cards de `Em risco` e `Glosa evitada` no Dashboard.
- Filtro por data inicial e final, incluindo intervalo de um unico dia.
- Atalhos de dia, semana, mes e intervalo personalizado.
- Endpoint de relatorio PDF usando o mesmo contrato do Dashboard.
- Botao de download do PDF na tela de relatorio/Dashboard.
- Resumo sem dados pessoais e sem observacao original.

### Regras temporais

- `Em risco` representa as guias que continuam deterministicas `PENDENTE` no fechamento do periodo.
- `Glosa evitada` representa transicoes `PENDENTE -> OK` cuja segunda verificacao ocorreu dentro do periodo.
- Uma guia e contada uma vez por ciclo de pendencia.
- Resolver uma revisao Groq nao entra em `Glosa evitada`.
- O intervalo usa limites inclusivos no fuso de Sao Paulo.
- O resultado historico nao pode depender apenas da ultima verificacao atual.

### Aceite

- Dashboard e PDF apresentam os mesmos numeros para o mesmo intervalo.
- Filtrar um unico dia retorna somente eventos daquele dia.
- Semana e mes podem ser reproduzidos depois de novas cargas.
- O PDF e legivel, tem tamanho razoavel e pode ser enviado sem dados pessoais.
- O PDF informa o periodo, data de geracao, em risco, glosa evitada, verificacoes, pendencias e revisoes.
- Uma guia resolvida depois do periodo nao altera retroativamente o `Em risco` historico daquele periodo.
- Uma guia resolvida no periodo conta em `Glosa evitada` somente uma vez.

## OBS-GROQ-10 - Validar cobertura, seguranca e habilitacao gradual

**Como** responsavel pelo produto, **quero** validar o comportamento antes de habilitar o Groq, **para** aumentar cobertura sem introduzir confianca falsa.

### Escopo

- Testes de mascaramento, cache, schema, combinacao, timeout, concorrencia e injection.
- Fixture com rotina, sinais, contradicoes, negacoes e casos ambiguos.
- Avaliacao real registrada por modelo e versao de prompt.
- Revisao de segredos, bundle, logs, RLS e respostas publicas.

### Aceite

- `LEITOR_IA=off` preserva integralmente o comportamento atual.
- Testes, typecheck e build passam.
- Nenhum segredo aparece no repositorio ou bundle.
- Resultados da avaliacao real sao registrados honestamente.
- A habilitacao em producao ocorre somente apos aprovacao da avaliacao e dos limites de privacidade/custo.
