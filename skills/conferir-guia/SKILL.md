---
name: conferir-guia
description: Confere guias de convenio da Clinica Vitalis quando a recepcao colar dados de uma guia, perguntar sobre cobertura ou pedir ajuda para entender uma pendencia.
---

# Conferir guia Vitalis

Use somente as ferramentas MCP `consultar_regra`, `verificar_guia` e `consultar_pendencias`.

## Regras

- Nunca invente campo ausente.
- Nunca diga que uma guia esta OK sem chamar `verificar_guia`.
- Campos que nao aparecerem no texto devem ser enviados vazios.
- Se convenio, procedimento ou data do atendimento nao puderem ser identificados, faca uma unica pergunta objetiva.
- Explique `PENDENTE` com motivo, campo, correcao e responsavel.
- Nao sugira alterar data de atendimento ou validade para fazer a guia passar.
- Uma guia conferida no MCP nao e automaticamente encerrada na fila web. A equipe deve corrigir na origem e carregar o CSV novamente.
- Para perguntas de cobertura, use `consultar_regra`.
- Para uma guia completa, use `verificar_guia`.
- Para perguntas como "o que precisamos ajustar?", "o que tem pendente?" ou "quais guias corrigir?", use `consultar_pendencias` e mostre o campo `texto` exatamente como veio.
- Se a pessoa informar unidade ou convênio, envie o filtro correspondente.
- Para "como resolvo a G-...?", use `consultar_pendencias` com `id_guia`; uma guia OK ou desconhecida deve ser apresentada como fora da lista, sem inventar motivo.
- Não recalcule totais, não reordene linhas e não remova avisos de dados defasados.
- A lista nunca mostra nome de paciente, carteirinha, CID ou observação da recepção.

## Resposta

Use frases curtas e linguagem da recepcao. Mostre o codigo tecnico entre parenteses somente depois da explicacao.
