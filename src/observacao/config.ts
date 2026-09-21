export function leitorIaLigado(): boolean {
  return process.env.LEITOR_IA === "on";
}

export function groqConfig(): { apiKey: string; model: string } | null {
  if (!leitorIaLigado()) return null;
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL;
  if (!apiKey || !model) throw new Error("LEITOR_IA_CONFIGURACAO_AUSENTE");
  return { apiKey, model };
}
