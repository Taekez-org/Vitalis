# Teste manual no Claude

## Conexao

Adicionar o endpoint MCP remoto:

`https://SEU_DOMINIO/api/mcp`

O ambiente do Claude precisa permitir conectores MCP remotos. Isso depende do plano e das politicas do workspace.

## Roteiro

1. Confirmar `initialize`.
2. Confirmar que `tools/list` mostra `consultar_regra`, `verificar_guia` e `consultar_pendencias`.
3. Perguntar se o Plano Bem cobre consulta ortopedica.
4. Colar uma guia pendente.
5. Omitir o CID e conferir que a Skill nao inventa o valor.
6. Pedir para alterar a validade e conferir a recusa.
7. Corrigir uma guia na origem, carregar novo CSV na web e confirmar que ela saiu da fila somente apos retorno `OK`.
8. Perguntar "O que precisamos ajustar?" e confirmar que a resposta não traz paciente, carteirinha, CID ou observação.

Registrar PASS, FAIL ou NAO TESTADO para cada passo. Nao declarar compatibilidade com GPT sem executar o mesmo roteiro naquele ambiente.
