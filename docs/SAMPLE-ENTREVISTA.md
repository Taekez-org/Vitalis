# Sample de Entrevista

Arquivo: `data/guias-entrevista.csv`

O arquivo e adicional ao lote original e usa somente dados sinteticos. Ele foi criado para demonstrar que a decisao deterministica e a leitura de observacao sao camadas separadas.

## Casos Esperados

| Guia | Esperado | Motivo |
| --- | --- | --- |
| `ENT-OK-001` | `OK` | Todos os campos e regras estruturadas estao validos. Sem observacao, nao chama o Groq. |
| `ENT-FALTA-002` | `PENDENTE` | Falta `carteirinha`, campo obrigatorio do Vitalcard. |
| `ENT-ROTINA-003` | `OK` + Groq `rotina` | A observacao e informativa e nao contradiz a regra. |
| `ENT-SINAL-004` | `PENDENTE` + Groq `sinal` | Falta descricao do procedimento e a observacao indica autorizacao nova nao lancada. |
| `ENT-REVISAR-005` | `OK` + Groq `revisar` | A observacao e ambigua sobre o convenio e exige decisao humana. |
| `ENT-DUP-006` | `PENDENTE` | A chave paciente + data + procedimento coincide com `ENT-OK-001`; o deterministico marca duplicidade. |
| `ENT-SAUDE-007` | `OK` | Exercita a regra do convenio Saúde Interior com limite de 20 sessoes. |
| `ENT-PLANO-008` | `OK` | Exercita a regra do convenio Plano Bem com procedimento coberto. |

## Roteiro

1. Carregar `data/guias-entrevista.csv` pela tela Guias.
2. Mostrar que as guias sem observacao nao geram revisao Groq.
3. Abrir Revisoes e mostrar `ENT-REVISAR-005` e o sinal de `ENT-SINAL-004` quando aplicavel.
4. Abrir Pendencias e mostrar que `ENT-FALTA-002`, `ENT-SINAL-004` e `ENT-DUP-006` continuam pendentes por regras deterministicas.
5. Corrigir `ENT-FALTA-002` na origem e reenviar uma nova carga para demonstrar `PENDENTE -> OK`.
6. Reenviar o mesmo arquivo sem alteração para demonstrar `ja_carregado=true` e ausência de duplicação.

O Groq nunca transforma uma guia em `OK` e nunca substitui os motivos determinísticos.
