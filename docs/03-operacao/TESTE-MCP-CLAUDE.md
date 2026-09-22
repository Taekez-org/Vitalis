# Teste MCP no Claude

O endpoint de producao e:

`https://vitalis-ei.vercel.app/api/mcp`

O MCP exige um header Bearer. O valor de `MCP_AUTH_TOKEN` fica somente como Secret na Vercel e nao deve ser colocado neste arquivo, no GitHub ou em screenshots.

## Configuracao

No conector MCP do Claude, informe a URL acima e configure o header:

```text
Authorization: Bearer <MCP_AUTH_TOKEN>
```

## Roteiro

1. Use `consultar_regra` com `Vitalcard` e `50000470`.
2. Use `consultar_pendencias` com `responsavel=todos` e `limite=5`.
3. Use `verificar_guia` com a guia `G-2608-0001` de `data/guias.csv`, enviando os campos estruturados.
4. Confirme que a resposta nao contem paciente, carteirinha, CID ou observacao original.
5. Teste uma chamada sem header e confirme erro `401`.

Nunca cole o token em prompt, issue, commit, README ou captura de tela.
