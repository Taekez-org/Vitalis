# Dados da prova

`guias.csv` e `regras_convenio.json` devem ser copiados do pacote V3 sem alteracao.

O V4 usa os mesmos dados ficticios e o mesmo gabarito do V3. O núcleo, a aplicação, o MCP e a Skill já estão implementados nesta pasta; estes arquivos continuam sendo a fonte de entrada da prova e não devem ser alterados para ajustar testes.

## Amostras da POC

- `guias.csv`: amostra original com erros intencionais; em `2026-08-31`, o resultado esperado é 41 `OK` e 39 `PENDENTE`.
- `guias-ajustadas.csv`: carga de reverificação que corrige problemas administrativos, mas preserva bloqueios que ainda impedem faturamento; em `2026-08-31`, o resultado esperado é 49 `OK`, 31 `PENDENTE` e R$ 2.116,00 em risco.
- Para recriar a amostra corrigida, execute `node scripts/gerar-guias-ajustadas.mjs`.
