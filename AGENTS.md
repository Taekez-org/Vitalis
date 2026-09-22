# Guia do agente

## Ordem de leitura

1. `docs/00-canonico/INDEX.md`
2. `docs/00-canonico/STATUS-FINAL.md`
3. `data/README.md` e `data/regras_convenio.json`
4. `db/README.md` e `db/schema.sql`
5. O codigo em `src/` e os testes correspondentes em `tests/`
6. `docs/03-operacao/TESTE-MCP-CLAUDE.md`, somente para validar o MCP publicado

## Fonte de verdade

`docs/00-canonico/STATUS-FINAL.md` descreve o comportamento entregue. O codigo e os testes sao a autoridade para detalhes implementados. Nao use documentos apagados, historicos externos ou suposicoes do V3 como requisito.

## Regras de trabalho

- Nao invente regra de convenio: leia `data/regras_convenio.json`.
- O nucleo em `src/core/` deve permanecer deterministico e sem rede, banco ou segredos.
- A IA nunca aprova uma guia e nunca altera o resultado deterministico.
- O botao de tratamento nao muda `OK` ou `PENDENTE`; somente uma nova carga pode resolver uma guia.
- Nao exponha paciente, carteirinha, CID ou observacao na fila, relatorio, exportacao ou logs.
- Segredos ficam somente em variaveis de ambiente server-side; nunca em commits ou `NEXT_PUBLIC_*`.
- Testes nao devem chamar producao, Groq ou outros provedores externos.
- Antes de alterar banco, leia `db/README.md` e `db/schema.sql`.
- Antes de alterar comportamento, atualize testes e confirme o impacto em `docs/00-canonico/STATUS-FINAL.md`.

## Verificacao local

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Nao declare um comando aprovado sem executa-lo.
