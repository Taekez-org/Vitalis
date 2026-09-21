# Epico: Revisao assistida de observacoes com Groq

## Objetivo

Adicionar uma segunda camada de verificacao para observacoes preenchidas pela recepcao. O Groq deve confrontar a observacao com o contexto estruturado da regra aplicavel e alertar sobre contradicoes, relevancia ou informacoes que merecam leitura humana.

O Groq e assistivo. Ele nao aprova, reprova, altera dados, remove motivos deterministas ou encerra pendencias tecnicas.

## Problema

O motor deterministico confere campos estruturados, mas uma observacao pode registrar algo importante que nao esta nesses campos. Exemplos:

- autorizacao nova ainda nao lancada;
- atendimento feito de forma diferente do procedimento informado;
- paciente que nao compareceu;
- cobranca como particular;
- sessao remarcada com autorizacao da data original;
- contradicao entre o que esta na guia e o que foi anotado.

Hoje os sinais de texto dependem de padroes exatos e podem perder parafrases ou interpretar uma negacao como sinal.

## Fluxo de negocio

```text
CSV
 |
 v
Verificacao deterministica
 |
 +--> Guia sem observacao: segue somente com resultado deterministico
 |
 +--> Guia com observacao: passa pelo Groq, qualquer que seja o resultado deterministico
             |
             +--> Sem alerta: nenhum registro de revisao
             |
             +--> Com alerta: revisao de observacao humana
                              |
                              +--> Resolver revisao
                              |
                              +--> Se exigir correcao na origem, novo CSV e nova verificacao
```

## Regras inegociaveis

- Toda guia com observacao nao vazia passa pelo Groq.
- Guia sem observacao nao gera chamada ao Groq.
- O resultado deterministico e independente do resultado do Groq.
- Uma pendencia deterministica so e resolvida por nova verificacao deterministica `OK`.
- Uma revisao Groq pode ser resolvida humanamente mesmo que a observacao permaneça no CSV.
- `Resolver revisao` nao significa que a guia foi aprovada tecnicamente.
- Uma guia pode ter simultaneamente pendencia deterministica e revisao Groq.
- O MCP consulta revisoes persistidas, mas nao chama o Groq em tempo real.
- O Groq recebe somente observacao mascarada e contexto minimo da regra aplicavel.
- Nenhuma chave, observacao original, identificador da guia ou dado pessoal vai para o navegador, log ou resposta publica indevida.
- Falha do Groq nunca bloqueia a carga; ela gera revisao com origem `nao_lida`.
- A IA fica desligada por padrao e, desligada, o golden atual deve permanecer identico.

## Separacao de estados

### Pendencia deterministica

- Origem: motor de regras.
- Pode alterar `status_verificacao` para `PENDENTE`.
- Entra na fila operacional atual.
- Sai somente depois de nova carga cujo resultado seja `OK`.

### Revisao de observacao

- Origem: Groq ou falha de leitura.
- Nao altera `status_verificacao`.
- Pode existir mesmo quando a guia esta `OK`.
- Possui estado proprio: aberta ou resolvida.
- A resolucao registra responsavel, data, hash da observacao, contexto e versao da leitura.

## Regra de glosa evitada

Uma guia so entra no relatorio de resultado confirmado e na contabilizacao de glosa evitada quando:

1. Falhou na primeira verificacao deterministica e entrou como `PENDENTE`.
2. Foi corrigida ou tratada na origem.
3. Foi reenviada em uma nova carga.
4. Passou pela segunda verificacao deterministica com resultado `OK`.

Resolver uma revisao Groq nao conta como glosa evitada. Uma guia que ja estava `OK` na primeira verificacao tambem nao conta como glosa evitada, mesmo que tenha recebido e resolvido um alerta de observacao.

O calculo deve ser feito por transicao de uma verificacao `PENDENTE` para uma verificacao posterior `OK`, sem dupla contagem da mesma guia ou do mesmo ciclo de pendencia. O valor deve ser derivado do registro de risco da verificacao que abriu a pendencia, com a regra de valor documentada e testada.

## Dashboard e relatorio por periodo

O Dashboard deve apresentar, no minimo, dois cards financeiros separados:

- `Em risco`: valor das guias que permanecem com pendencia deterministica no fim do periodo selecionado.
- `Glosa evitada`: valor das guias que fizeram a transicao de `PENDENTE` para `OK` dentro do periodo selecionado.

O periodo deve aceitar data inicial e final, incluindo selecao de um unico dia. Deve haver atalhos para dia, semana e mes, sem impedir um intervalo personalizado.

O relatorio PDF deve usar exatamente o mesmo recorte e os mesmos calculos do Dashboard. O PDF deve ser simples, legivel, otimizado para envio semanal e conter:

- periodo selecionado;
- data da geracao;
- guias verificadas no periodo;
- pendencias abertas no fim do periodo;
- valor em risco;
- glosa evitada confirmada;
- quantidade de revisoes Groq abertas e resolvidas;
- observacao de que revisao Groq resolvida nao e glosa evitada;
- resumo por convenio, unidade e motivo, sem dados pessoais.

Os calculos devem usar o historico append-only de verificacoes e tratamentos. Nunca devem depender apenas da ultima verificacao atual, pois isso faria um relatorio antigo mudar depois de uma nova carga.

## Fora de escopo

- Usar Groq para substituir regras deterministicas.
- Permitir que Groq marque uma guia como `OK`.
- Enviar a guia completa para o provedor.
- Chamar Groq pelo MCP em tempo real.
- Resolver automaticamente uma revisao com base apenas na resposta do modelo.
- Prometer eliminacao de glosas ou garantia de aprovacao pelo convenio.

## Criterios de aceite do epico

- Todas as guias com observacao nao vazia sao lidas ou registradas como `nao_lida`.
- Guias sem observacao nunca chamam o Groq.
- O resultado deterministico nao muda por causa de uma falha ou classificacao do Groq.
- Pendencias deterministicas e revisoes Groq aparecem separadas.
- Uma guia `OK` com alerta Groq aparece em `Para revisar`.
- `Resolver revisao` encerra somente a revisao Groq e nao reduz o valor em risco deterministico.
- Apenas uma guia que passou de `PENDENTE` para `OK` em nova carga entra como glosa evitada.
- Resolver alerta Groq ou estar `OK` desde a primeira carga nunca entra como glosa evitada.
- Uma nova observacao gera uma nova revisao.
- A mesma observacao pode ser reconhecida sem reabrir infinitamente a mesma revisao.
- O MCP apresenta revisoes persistidas sem depender da disponibilidade do Groq.
- Com a IA desligada, testes, golden, typecheck e build continuam passando.
- Nenhum texto original da observacao aparece em fila, relatorio, CSV, MCP ou logs.
- Dashboard e PDF usam o mesmo intervalo e os mesmos valores para `Em risco` e `Glosa evitada`.
- Um intervalo de um dia funciona sem incluir dados do dia anterior ou seguinte.
- Um relatorio antigo permanece reproduzivel a partir do historico, mesmo depois de novas cargas.

## Ordem recomendada

1. Contratos, tipos e separacao dos sinais deterministas.
2. Combinacao pura e testes sem rede.
3. Leitor Groq, validacao, timeout, cache e limites.
4. Integracao no lote para todas as observacoes.
5. Persistencia, revisoes e resolucao humana.
6. Tela, relatorio e MCP.
7. Avaliacao real, seguranca, privacidade e habilitacao controlada.
