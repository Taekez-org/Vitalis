# Plano V4 - Verificador de Guias

## 1. Proposta de valor

O V4 transforma a conferencia tardia do financeiro em um ciclo controlado:

1. A recepcao exporta as guias do sistema de gestao.
2. O sistema verifica todas as guias usando as regras do JSON.
3. As pendencias mostram exatamente o motivo, o campo, a acao e o responsavel.
4. A equipe corrige na origem.
5. Um novo arquivo e carregado.
6. A guia so sai da fila quando a nova verificacao retorna `OK`.

O produto prova capacidade de interceptar risco de glosa. Nao promete economia mensal sem medir a glosa real antes e depois.

## 2. Escopo da entrega

### Incluido

- Motor puro reaproveitado do V3.
- Upload de CSV com virgula, ponto e virgula, BOM e CRLF.
- Carga em lote com idempotencia por hash do arquivo.
- Reverificacao por `id_guia`.
- Historico append-only de verificacoes.
- Fila de pendencias.
- Check humano separado do status tecnico.
- Dashboard com polling; Realtime depende de validação específica com RLS.
- Filtros avancados.
- Exportacao CSV segura contra injecao de formula.
- Tempo de pendencia e tempo de resolucao.
- Graficos simples em HTML/CSS ou SVG, sem biblioteca de graficos.
- MCP e Skill foram adicionados depois da validacao local do fluxo web; a ferramenta `consultar_pendencias` le a mesma fila operacional sem alterar tratamento.

### Fora do escopo

- Integracao de escrita no sistema de gestao.
- WhatsApp.
- Groq.
- Relatorio mensal.
- Reverificacao automatica por cron.
- Autenticacao completa de usuarios.
- Formulario web com os 18 campos.
- Compatibilidade garantida com qualquer plano do Claude ou GPT.

## 3. Fluxo operacional

```text
CSV do sistema de gestao
        |
        v
      /guias
        |
        v
  verificacao deterministica
        |
        +--> OK ----------------------> historico e dashboard
        |
        +--> PENDENTE --> /pendencias --> correcao na origem
                                      |
                                      v
                                check humano
                                      |
                                      v
                           aguardando reverificacao
                                      |
                                      v
                                novo CSV
```

## 4. Estados

### Status tecnico

- `OK`
- `PENDENTE`

### Status de tratamento

- `ABERTA`
- `EM_TRATAMENTO`
- `AGUARDANDO_REVERIFICACAO`
- `RESOLVIDA`

O status tecnico e derivado da ultima verificacao. O status de tratamento e uma informacao operacional e nunca substitui a verificacao.

## 5. Regras de reverificacao

- `id_guia` e a chave da guia ao longo das cargas.
- Cada carga cria uma nova verificacao para cada guia aceita.
- A guia atual e atualizada com os dados mais recentes.
- A fila consulta a ultima verificacao de cada `id_guia`.
- Ultima verificacao `PENDENTE`: permanece na fila.
- Ultima verificacao `OK`: sai da fila ativa.
- Se o mesmo arquivo for carregado novamente, o hash evita nova carga.
- Se o mesmo `id_guia` vier com dados diferentes, uma nova verificacao e criada.
- Se uma guia marcada como corrigida continuar pendente, volta para `EM_TRATAMENTO` com os novos motivos.

## 6. Dashboard

### KPIs

- Guias verificadas.
- OK.
- Pendentes.
- Valor em risco sem dupla contagem.
- Em tratamento.
- Aguardando reverificacao.
- Resolvidas no periodo.
- Tempo medio de resolucao.
- Pendencia aberta mais antiga.

### Graficos

- Pendencias por codigo.
- Pendencias por unidade.
- Pendencias por convenio.
- Abertas x resolvidas por dia.

Cada grafico deve ter tabela ou texto equivalente. Nenhuma informacao pode depender apenas de cor.

### Realtime

O dashboard faz uma leitura inicial e assina alteracoes em `cargas`, `verificacoes` e `tratamentos`. Em caso de falha do canal realtime, a pagina continua funcional com botao de atualizar e mostra a hora da ultima leitura.

## 7. Pendencias

### Filtros

- Unidade.
- Convenio.
- Codigo.
- Responsavel.
- Status de tratamento.
- Data de atendimento.
- Busca por `id_guia`.
- Ordenacao por prazo, valor, pendente desde ou tempo de tratamento.

### Detalhe

Mostra somente dados necessarios para agir:

- `id_guia`.
- Convenio.
- Unidade.
- Procedimento.
- Valor.
- Codigo.
- Campo afetado.
- Motivo.
- Acao.
- Responsavel.

Nao mostra paciente, carteirinha, CID ou observacao.

### Check humano

O botao e `Marcar corrigida na origem`. Ele muda apenas o tratamento para `AGUARDANDO_REVERIFICACAO`, registra data e responsavel e nao altera nenhum KPI tecnico.

## 8. Tempo de resolucao

### Pendencia aberta

Tempo desde a primeira verificacao da sequencia atual como `PENDENTE` ate agora.

### Resolucao

Tempo desde a primeira verificacao `PENDENTE` ate a primeira verificacao posterior `OK`.

Uma verificacao manual nao e resolucao.

## 9. MCP e Skill

### `consultar_regra`

Consulta convenio, procedimento, cobertura, limites, prazo e observacao diretamente do JSON.

### `verificar_guia`

Recebe os dados estruturados, aplica o mesmo nucleo e devolve `OK` ou `PENDENTE`.

O MCP nao persiste tratamento e nao tira guias da fila. A Skill pode ajudar a extrair os campos e explicar o retorno, mas a carga web e a fonte operacional.

### Teste manual Claude

Registrar evidencias para:

1. `initialize`.
2. `tools/list` com três ferramentas: `consultar_regra`, `verificar_guia` e `consultar_pendencias`.
3. Consulta de cobertura.
4. Guia valida.
5. Campo ausente.
6. Observacao que gera motivo.
7. Pedido para alterar validade, recusado.
8. Guia corrigida reenviada pelo CSV e removida da fila.

## 10. Criterios de aceite

- As 80 guias batem com o gabarito do V3.
- O mesmo arquivo nao gera nova carga.
- Uma guia corrigida pelo mesmo `id_guia` pode retornar `OK` e sair da fila.
- Uma guia ainda errada permanece pendente com os motivos atuais.
- O check nao altera `status_verificacao`.
- Dashboard e pendencias mostram os mesmos numeros.
- O dashboard atualiza por polling; Realtime ainda não foi validado no Supabase de teste.
- Filtros combinados retornam o conjunto correto.
- CSV exportado usa `;`, BOM e protecao contra formula.
- Tempo de resolucao e calculado a partir das verificacoes, nao do clique humano.
- MCP devolve as duas ferramentas pedidas pela prova e a ferramenta adicional de fila definida no ajuste.
- Skill nunca inventa campo nem sugere alterar datas.
- Nenhum segredo aparece no repositorio ou no bundle.
