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
  return { apiKey, model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite" };
}

export function geminiModels(): { apiKey: string; models: string[] } | null {
  const config = geminiConfig();
  if (!config) return null;
  const configured = process.env.GEMINI_MODEL?.trim();
  const models = [configured, config.model, "gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"].filter((model, index, list): model is string => Boolean(model) && list.indexOf(model) === index);
  return { apiKey: config.apiKey, models };
}

export function openRouterConfig(): { apiKey: string; model: string } | null {
  if (!leitorIaLigado()) return null;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  return { apiKey, model: process.env.OPENROUTER_MODEL ?? "openrouter/free" };
}
