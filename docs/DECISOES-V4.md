# Decisoes V4

## V4-01 - CSV como entrada principal

O sistema de gestao nao sera substituido nem escrito pelo prototipo. O CSV e a ponte operacional mais realista para a prova.

## V4-02 - Uma guia sai somente por nova verificacao OK

O check humano nao e evidencia de correcao. A evidencia e a nova entrada e o novo resultado do motor.

## V4-03 - Status tecnico separado do tratamento

Permite que a equipe organize o trabalho sem falsificar os indicadores de risco.

## V4-04 - Supabase somente como historico e estado operacional

Nao ha regra de negocio no banco. O nucleo continua puro e compartilhado pela web, MCP e testes.

## V4-05 - Dashboard com Realtime e fallback

Realtime melhora acompanhamento, mas a aplicacao deve continuar correta se a assinatura cair.

## V4-06 - Graficos sem biblioteca

Barras simples em HTML/CSS ou SVG atendem a leitura e reduzem dependencias.

## V4-07 - MCP como copiloto, nao como fonte de fechamento

O MCP explica regras e verifica texto. A fila e encerrada apenas pela carga persistida e reverificada.

## V4-08 - Privacidade por minimizacao

Relatorio, fila, logs e exportacoes nao exibem paciente, carteirinha, CID ou observacao.
