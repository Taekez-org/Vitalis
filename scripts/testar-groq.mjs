// Verificacao manual das chaves do Groq. Nao faz parte da suite de testes e nunca imprime a chave.
// Uso (PowerShell):
//   $env:GROQ_API_KEY="..."; $env:GROQ_API_KEY2="..."; $env:GROQ_API_KEY3="..."; $env:GROQ_MODEL="..."
//   node scripts/testar-groq.mjs
const model = process.env.GROQ_MODEL?.trim();
const keys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY2, process.env.GROQ_API_KEY3];

if (!model) {
  console.error("Defina GROQ_MODEL.");
  process.exit(1);
}

const meaning = {
  200: "OK: chave e modelo funcionam",
  401: "chave invalida ou expirada",
  403: "chave sem permissao",
  404: "modelo inexistente ou indisponivel (troque GROQ_MODEL; nao e problema de chave)",
  429: "limite de uso atingido (a rotacao passaria para a proxima chave)",
};

for (const [index, key] of keys.entries()) {
  const name = index === 0 ? "GROQ_API_KEY" : `GROQ_API_KEY${index + 1}`;
  if (!key?.trim()) {
    console.log(`${name}: nao definida`);
    continue;
  }
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key.trim()}` },
      body: JSON.stringify({ model, temperature: 0, max_tokens: 5, messages: [{ role: "user", content: "Responda apenas: ok" }] }),
      signal: AbortSignal.timeout(15000),
    });
    console.log(`${name}: HTTP ${response.status} - ${meaning[response.status] ?? "resposta inesperada"}`);
  } catch (error) {
    console.log(`${name}: falha de rede ou tempo esgotado (${error instanceof Error ? error.name : "erro"})`);
  }
}
