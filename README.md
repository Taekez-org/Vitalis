# Verificador de Guias V4

Projeto V4 da prova tecnica da Clinica Vitalis.

## Objetivo

Conferir um arquivo de guias antes do envio ao convenio, mostrar o que precisa ser corrigido, acompanhar o trabalho da recepcao e permitir que a Carla e o Dr. Renato acompanhem o risco em tempo real.

## Base reaproveitada do V3

- `data/guias.csv`: 80 guias ficticias de agosto/2026.
- `data/regras_convenio.json`: fonte unica das regras dos tres convenios.
- `docs/fixtures/`: gabarito independente e resumo esperado.
- regras e contratos do nucleo deterministico: normalizacao, regras, datas, duplicidade e texto livre.
- contrato do MCP com `consultar_regra`, `verificar_guia` e `consultar_pendencias`.
- Skill `conferir-guia` para conferir uma guia e consultar a fila sem expor dados pessoais.

O codigo da aplicacao, do MCP e da Skill esta nesta pasta. O nucleo usa os dados ficticios da prova e a camada de persistencia escolhe memoria local fora de producao ou Supabase no ambiente publicado.

## O que mudou no V4

- A entrada operacional principal e um upload de CSV.
- Sao tres areas: Carga de guias, Pendencias e Dashboard.
- Supabase guarda cargas, verificacoes e tratamento humano.
- Uma guia so sai da fila quando uma nova verificacao retorna `OK`.
- O check humano significa "corrigida na origem, aguardando reverificacao".
- Dashboard atualiza por polling; Realtime fica condicionado a uma validacao posterior com Supabase e RLS.
- Pendencias tem filtros avancados, exportacao CSV e tempo de resolucao.
- Dashboard tem graficos simples sem biblioteca adicional.
- O MCP ajuda a consultar regras, conferir uma guia e explicar a fila, mas nao fecha pendencias.

## Regra central

`status_verificacao` e independente de `status_tratamento`.

```text
PENDENTE + ABERTA = aparece em A fazer
PENDENTE + AGUARDANDO_REVERIFICACAO = aguarda novo CSV
OK + RESOLVIDA = sai da fila ativa
```

O clique manual nunca muda `PENDENTE` para `OK` e nunca reduz o valor em risco.

## Paginas

### `/guias`

Upload de CSV, carga da demonstracao, resultado do lote, contadores e exportacao.

### `/pendencias`

Fila operacional com motivo, campo, acao, responsavel, filtros, check de tratamento e exportacao do recorte atual.

### `/dashboard`

Guias verificadas, OK, pendentes, valor em risco, tratamento, aguardando reverificacao, tempo de resolucao, graficos e ultima carga. Atualiza com Realtime.

## Como executar

```bash
npm ci
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
```

Para Supabase no servidor, configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, aplique `db/schema.sql` e mantenha a chave somente no ambiente do servidor. O navegador usa apenas as variáveis públicas de Realtime quando configuradas. Em produção sem banco configurado, as rotas de dados respondem `503`.

## MCP e Skill

O MCP esta em `src/app/api/mcp/route.ts` e usa `mcp-handler` com transporte HTTP.
As ferramentas sao:

- `consultar_regra`: recebe convenio e codigo do procedimento.
- `verificar_guia`: recebe os campos da guia e devolve `OK` ou `PENDENTE`.
- `consultar_pendencias`: lista os ajustes por responsavel, unidade ou convenio, ou detalha uma guia pelo `id_guia`.

Exemplo de configuracao para um cliente MCP HTTP:

```json
{
  "verificador-vitalis": {
    "url": "https://SEU-DOMINIO/api/mcp"
  }
}
```

Localmente, use `http://localhost:3000/api/mcp`.
O contrato da Skill esta em `skills/conferir-guia/SKILL.md` e os exemplos em `skills/conferir-guia/EXEMPLOS.md`.

## Como testei

- `npm.cmd test`: 15 testes passando.
- `npm.cmd run typecheck`: passando.
- `npm.cmd run build`: passando.
- Golden: 80 guias, 41 OK, 39 pendentes, R$ 2.664,00 em risco.
- MCP: `initialize` e `tools/list` respondem com as três ferramentas.
- Privacidade: fila e CSV não retornam paciente, carteirinha, CID ou observação.
- Testes herméticos: a suíte usa `VITALIS_STORE_FILE=memory` e carrega o demo em cada teste.

## Limites honestos

- O V4 nao escreve no sistema de gestao da clinica.
- A recepcao precisa exportar e carregar o CSV corrigido.
- O MCP e assistivo; a web e a fonte de controle operacional.
- `consultar_pendencias` usa a fila local atual; a leitura paginada no Supabase ainda precisa de validação de integração.
- O arquivo local é um fallback de desenvolvimento; em produção a ausência do Supabase é erro `503`.
- Reenviar um arquivo idêntico a uma carga antiga não restaura o estado daquela carga; o hash é idempotente.
- A publicação depende de um domínio e das variáveis de ambiente da infraestrutura escolhida.
- Os dados da prova sao ficticios; uso real exige autenticacao, RLS revisada e validacao LGPD.
