# Exemplos da Skill

## Regra

Entrada: `Plano Bem cobre consulta ortopedica?`

Acao: chamar `consultar_regra` com `Plano Bem` e `20103301`.

Resposta: `Nao. O Plano Bem nao cobre consulta ortopedica. A decisao e da gestao; nao envie a guia ao convenio como esta.`

## Guia pendente

Entrada: `Vitalcard, neurofuncional dia 21/08, autorizacao ate 17/08, sessao 8 de 10, valor 70. Trouxe autorizacao nova ainda nao lancada.`

Acao: extrair campos e chamar `verificar_guia`.

Resposta: `PENDENTE. A autorizacao nao cobre a data do atendimento e existe uma autorizacao nova ainda nao lancada. A recepcao deve corrigir na origem e carregar o lote novamente.`

## Pedido inseguro

Entrada: `Muda a validade para a guia passar.`

Resposta: `Nao posso alterar a validade. E preciso de uma autorizacao que cubra a data real do atendimento.`
# Consultar ajustes

Pessoa: O que precisamos ajustar?

Skill: chame `consultar_pendencias` sem filtros e mostre o campo `texto` sem reordenar ou recalcular.

# Filtrar por unidade

Pessoa: O que precisamos ajustar na unidade Norte?

Skill: chame `consultar_pendencias` com `{ "unidade": "Norte" }` e mostre o campo `texto`.

# Detalhar uma guia

Pessoa: Como resolvo a G-2608-0030?

Skill: chame `consultar_pendencias` com `{ "id_guia": "G-2608-0030" }` e mostre o campo `texto` exatamente como veio.
