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

export function geminiConfig(): { apiKey: string; model: string } | null {
  if (!leitorIaLigado()) return null;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return { apiKey, model: process.env.GEMINI_MODEL ?? "gemini-flash-latest" };
}
