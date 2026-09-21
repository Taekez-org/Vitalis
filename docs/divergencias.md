# Divergências Registradas

## Fila MCP: responsável padrão e primeira guia

- O briefing da nova ferramenta define `responsavel = recepcao` como padrão e espera 26 guias.
- O mesmo briefing cita a guia `G-2608-0035` como primeira linha, mas essa guia tem apenas `PROCEDIMENTO_NAO_COBERTO`, cujo responsável é `gestao`.
- Implementação adotada: o filtro padrão respeita `recepcao`, portanto a primeira guia da lista filtrada é `G-2608-0031`; a ordenação global (`responsavel = todos`) começa por `G-2608-0035`, conforme o gabarito.
- Nenhum motivo ou número foi alterado para forçar os dois critérios simultaneamente.

## Ferramentas MCP

- A prova original pede pelo menos `consultar_regra` e `verificar_guia`.
- O ajuste posterior pede também `consultar_pendencias`.
- O MCP V4 expõe as três ferramentas; a ferramenta adicional não altera o núcleo nem o tratamento da fila.

## Supabase e Realtime

- O adaptador Supabase, a função transacional `registrar_carga`, a view de última verificação, RLS e paginação foram implementados.
- Não há credenciais do projeto de teste disponíveis nesta execução; a integração remota, RLS efetiva e reinício do servidor permanecem **não verificados**.
- O dashboard mantém polling de 5 segundos como comportamento garantido. Realtime não é declarado como validado.
