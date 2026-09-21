# Backlog V4

## Fase 1 - Reaproveitamento do nucleo

- Copiar o nucleo deterministico do V3.
- Preservar `data/regras_convenio.json`, `data/guias.csv` e fixtures.
- Rodar golden: 80/80, 41 OK, 39 pendentes, R$ 2.664,00.

## Fase 2 - Persistencia minima

- Criar tabelas `cargas`, `guias`, `verificacoes` e `tratamentos`.
- Registrar carga por hash.
- Registrar verificacoes append-only.
- Derivar a ultima verificacao por `id_guia`.
- Aplicar RLS e manter service role somente no servidor.

## Fase 3 - Pagina de carga

- Upload CSV.
- Demo das 80 guias.
- Resumo do lote.
- Reenvio corrigido por `id_guia`.
- Mensagem para arquivo ja carregado.
- Exportacao do resultado.

## Fase 4 - Pendencias

- Lista da ultima verificacao pendente.
- Detalhe com campo, motivo, acao e responsavel.
- Filtros combinados.
- Check de correcao na origem.
- Abas: A fazer, Aguardando reverificacao, Resolvidas.
- Exportacao respeitando filtros.

## Fase 5 - Dashboard e realtime

- KPIs.
- Graficos simples.
- Tempo de resolucao.
- Ultima carga e ultima atualizacao.
- Assinatura Supabase Realtime.
- Fallback manual quando realtime falhar.

## Fase 6 - MCP e Skill

- Implementados `consultar_regra`, `verificar_guia`, `consultar_pendencias` e a Skill `conferir-guia`.

## Fase 7 - Entrega

- README.
- Video de ate 5 minutos.
- Deploy.
- Smoke anonimo.
- Varredura de segredos.

## Cortes se o tempo apertar

1. Graficos avancados, mantendo barras simples.
2. Filtros de periodo.
3. Realtime visual sofisticado, mantendo atualizacao por botao.
4. Ordenacoes secundarias.

Nao cortar: golden, persistencia local, reverificacao, fila, exportacao, MCP e Skill.
