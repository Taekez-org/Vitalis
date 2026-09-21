# Verificador de Guias V4

Projeto V4 da prova tecnica da Clinica Vitalis.

## Objetivo

Conferir um arquivo de guias antes do envio ao convenio, mostrar o que precisa ser corrigido, acompanhar o trabalho da recepcao e permitir que a Carla e o Dr. Renato acompanhem o risco em tempo real.

## Dados e contratos da prova

- `data/guias.csv`: 80 guias ficticias de agosto/2026.
- `data/regras_convenio.json`: fonte unica das regras dos tres convenios.
- regras e contratos do nucleo deterministico: normalizacao, regras, datas, duplicidade e texto livre.
- contrato do MCP com `consultar_regra`, `verificar_guia` e `consultar_pendencias`.
- Skill `conferir-guia` para conferir uma guia e consultar a fila sem expor dados pessoais.

O codigo da aplicacao, do MCP e da Skill esta nesta pasta. Os dados ficticios vieram dos materiais da prova; a conferencia, a persistencia e a operacao foram implementadas para este fluxo. A camada de persistencia escolhe memoria local fora de producao ou Supabase no ambiente publicado.

## O que mudou no V4

- A entrada operacional principal e um upload de CSV.
- Sao tres areas: Carga de guias, Pendencias e Dashboard.
- Supabase guarda cargas, verificacoes e tratamento humano.
- `tratamento_eventos` guarda a trilha append-only de cada transicao, com lote, data e responsavel.
- Uma guia so sai da fila quando uma nova verificacao retorna `OK`.
- O check humano significa "corrigida na origem, aguardando reverificacao".
- Dashboard atualiza por polling a cada 5 segundos; nao depende de Realtime.
- O historico pode ser consultado em `/api/historico`, com filtros por periodo, guia, evento, responsavel e estado.
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

### `/`

Upload de CSV, carga da demonstracao, resultado do lote, contadores e exportacao.

### `/pendencias`

Fila operacional com motivo, campo, acao, responsavel, filtros, check de tratamento e exportacao do recorte atual.

### `/dashboard`

Guias verificadas, OK, pendentes, valor em risco, tratamento, aguardando reverificacao, tempo de resolucao, graficos e ultima carga. Atualiza por polling.

## Como executar

```bash
npm ci
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
```

Para Supabase no servidor, configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, aplique `db/schema.sql` e mantenha a chave somente no ambiente do servidor. O navegador nao acessa o banco diretamente. Em produção sem banco configurado, as rotas de dados respondem `503`.

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

Localmente, use `http://localhost:3000/api/mcp`. Em um cliente MCP HTTP, a URL publicada e `https://SEU-DOMINIO/api/mcp`.
O contrato da Skill esta em `skills/conferir-guia/SKILL.md` e os exemplos em `skills/conferir-guia/EXEMPLOS.md`.

Para instalar o MCP em um cliente que aceite servidores HTTP, adicione a URL acima como servidor remoto. O MCP nao recebe a `service_role`; a chave fica somente na Vercel e e usada pelas ferramentas no servidor.

## Como fiz

- Next.js, TypeScript e Supabase: mantive a entrega pequena, com API no servidor e persistencia append-only.
- As regras deterministicas ficam no nucleo; IA nao decide cobertura, validade, valor ou prazo.
- Separei `status_verificacao` de `status_tratamento` para que o clique humano nunca transforme uma pendencia em guia OK.
- Usei polling em vez de Realtime porque as tabelas ficam sem leitura publica por RLS; assim o dashboard continua explicavel e seguro.
- O Groq ficou opcional e desligado por padrao. Ele pode classificar observacoes livres, mas sua resposta nao muda a decisao deterministica.
- O que ficou fora: escrita no sistema de gestao, WhatsApp, autenticacao de usuarios e cron de reverificacao. O CSV corrigido continua sendo a entrada operacional definida para a prova.

Para publicar na Vercel, configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` como variaveis de ambiente privadas, aplique `db/schema.sql` no projeto Supabase e execute o smoke test descrito em `docs/V4-PLANO.md`.

### Ativar o leitor Groq

O Groq roda somente no servidor. A chave nunca vai para o navegador, para o CSV, para o MCP ou para o Git. Para ativar em Production na Vercel, cadastre `GROQ_API_KEY` como Secret, defina `GROQ_MODEL=llama-3.1-8b-instant` e somente entao altere `LEITOR_IA` para `on`. O leitor mascara CPF, telefone e e-mail antes do envio, usa temperatura zero, resposta JSON validada por Zod e timeout; qualquer falha vira `nao_lida` e nao altera a decisao deterministica.

## Como testei

- `npm.cmd test`: 27 testes passando.
- `npm.cmd run typecheck`: passando.
- `npm.cmd run build`: passando.
- Golden: 80 guias, 41 OK, 39 pendentes, R$ 2.664,00 em risco.
- MCP: `initialize` e `tools/list` respondem com as tres ferramentas.
- Privacidade: fila e CSV não retornam paciente, carteirinha, CID ou observação.
- Testes herméticos: a suíte usa `VITALIS_STORE_FILE=memory` e carrega o demo em cada teste.

## Limites honestos

- O V4 nao escreve no sistema de gestao da clinica.
- A recepcao precisa exportar e carregar o CSV corrigido.
- O MCP e assistivo; a web e a fonte de controle operacional.
- `consultar_pendencias` usa a fila local atual; a leitura paginada no Supabase ainda precisa de validação de integração.
- O arquivo local é um fallback de desenvolvimento; em produção a ausência do Supabase é erro `503`.
- Reenviar um arquivo idêntico a uma carga antiga não restaura o estado daquela carga; o hash é idempotente.
- A publicacao depende de um dominio e das variaveis de ambiente da infraestrutura escolhida.
- Os dados da prova sao ficticios; uso real exige autenticacao, RLS revisada e validacao LGPD.
