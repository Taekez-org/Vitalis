# Indice canonico

Este diretorio e a entrada da documentacao do V4. O repositorio foi reduzido ao produto entregue, seus dados ficticios, banco, testes e instrucoes operacionais.

## Ordem de leitura

| Ordem | Arquivo | Finalidade |
| --- | --- | --- |
| 1 | `AGENTS.md` | Regras para agentes e contribuidores |
| 2 | `docs/00-canonico/STATUS-FINAL.md` | Comportamento e limites da entrega |
| 3 | `data/README.md` | Fixtures e dados de entrada |
| 4 | `db/README.md` | Modelo, persistencia e auditoria |
| 5 | `docs/03-operacao/TESTE-MCP-CLAUDE.md` | Validacao manual do MCP publicado |
| 6 | `README.md` | Uso e publicacao, a ser finalizado por ultimo |

## Mapa do repositorio

| Pasta | Conteudo |
| --- | --- |
| `src/core/` | Verificacao deterministica, regras, datas e metricas |
| `src/infra/` | Relogio, armazenamento e cliente Supabase server-side |
| `src/app/` | Paginas e rotas HTTP do Next.js |
| `src/servico/` | Relatorios, fila, PDF e apresentacao |
| `src/mcp/` | Ferramentas e formatacao do MCP |
| `src/observacao/` | Leitura opcional de observacoes por IA e revisao humana |
| `data/` | Regras e os dois CSVs ficticios oficiais da demonstracao |
| `db/` | Schema e consultas somente leitura de auditoria |
| `tests/` | Testes unitarios, API, privacidade, golden e MCP |
| `skills/` | Skill `conferir-guia` |

## O que nao deve entrar no Git

`node_modules/`, `.next/`, `.vercel/`, `supabase/.temp/`, `coverage/`, `tsconfig.tsbuildinfo`, `.env.local` e qualquer chave ou token real. O `.gitignore` cobre esses caminhos.

## Contrato de entrega

O produto deve ser entendido por tres fontes alinhadas: `STATUS-FINAL.md` explica o que foi entregue, o codigo implementa o comportamento e `tests/` fornece a evidencia automatica. O avaliador nao precisa reconstruir a historia do projeto para validar a entrega.
