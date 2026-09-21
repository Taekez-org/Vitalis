import { geminiConfig, geminiModels, groqConfig, leitorIaLigado, openRouterConfig } from "./config";
import { mascararObservacao } from "./seguranca";
import { observationPromptVersion, observationSystemPrompt, userPrompt } from "./prompt";
import { parseObservationReading, type ObservationContext, type ObservationReading, type ObservationSource } from "./contrato";

const REQUEST_TIMEOUT_MS = 10000;

export type ObservationReadResult = {
  source: ObservationSource;
  reading?: ObservationReading;
  reason?: string;
  promptVersion: string;
  model?: string;
};

export interface ObservationReader {
  read(observation: string, context: ObservationContext): Promise<ObservationReading>;
}

export class GroqObservationReader implements ObservationReader {
  async read(observation: string, context: ObservationContext): Promise<ObservationReading> {
    const config = groqConfig();
    if (!config) throw new Error("LEITOR_IA_DESLIGADO");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          temperature: 0,
          max_tokens: 200,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: observationSystemPrompt },
            { role: "user", content: userPrompt(mascararObservacao(observation), context) },
          ],
        }),
      });
      if (!response.ok) throw new Error(`GROQ_HTTP_${response.status}`);
      const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("GROQ_RESPOSTA_VAZIA");
      return parseObservationReading(JSON.parse(content));
    } finally {
      clearTimeout(timer);
    }
  }
}

export class GeminiObservationReader implements ObservationReader {
  constructor(private readonly model?: string) {}

  async read(observation: string, context: ObservationContext): Promise<ObservationReading> {
    const config = geminiConfig();
    if (!config) throw new Error("GEMINI_CONFIGURACAO_AUSENTE");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model ?? config.model}:generateContent`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "X-goog-api-key": config.apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${observationSystemPrompt}\n\n${userPrompt(mascararObservacao(observation), context)}` }] }], generationConfig: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: 200 } }),
      });
      if (!response.ok) throw new Error(`GEMINI_HTTP_${response.status}`);
      const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error("GEMINI_RESPOSTA_VAZIA");
      return parseObservationReading(JSON.parse(content));
    } finally {
      clearTimeout(timer);
    }
  }
}

export class OpenRouterObservationReader implements ObservationReader {
  async read(observation: string, context: ObservationContext): Promise<ObservationReading> {
    const config = openRouterConfig();
    if (!config) throw new Error("OPENROUTER_CONFIGURACAO_AUSENTE");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}`, "HTTP-Referer": "https://vitalis-ei.vercel.app", "X-Title": "Vitalis" },
        body: JSON.stringify({ model: config.model, temperature: 0, max_tokens: 200, response_format: { type: "json_object" }, messages: [{ role: "system", content: observationSystemPrompt }, { role: "user", content: userPrompt(mascararObservacao(observation), context) }] }),
      });
      if (!response.ok) throw new Error(`OPENROUTER_HTTP_${response.status}`);
      const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("OPENROUTER_RESPOSTA_VAZIA");
      return parseObservationReading(JSON.parse(content));
    } finally {
      clearTimeout(timer);
    }
  }
}

export class FakeObservationReader implements ObservationReader {
  constructor(private readonly response: ObservationReading | Error) {}

  async read(): Promise<ObservationReading> {
    if (this.response instanceof Error) throw this.response;
    return this.response;
  }
}

export async function readObservation(observation: string, context: ObservationContext, reader?: ObservationReader): Promise<ObservationReadResult> {
  if (!observation.trim()) return { source: "desligada", reason: "SEM_OBSERVACAO", promptVersion: observationPromptVersion };
  if (!leitorIaLigado()) return { source: "desligada", reason: "LEITOR_IA_OFF", promptVersion: observationPromptVersion };
  try {
    if (reader) return { source: "groq", reading: await reader.read(observation, context), promptVersion: observationPromptVersion, model: "fake" };
    const gemini = geminiModels();
    const providers = [
      ...(gemini?.models.map((model) => ({ reader: new GeminiObservationReader(model), model })) ?? []),
      openRouterConfig() ? { reader: new OpenRouterObservationReader(), model: openRouterConfig()!.model } : null,
      groqConfig() ? { reader: new GroqObservationReader(), model: groqConfig()!.model } : null,
    ].filter((provider): provider is { reader: ObservationReader; model: string } => Boolean(provider));
    if (!providers.length) return { source: "nao_lida", reason: "LEITOR_IA_CONFIGURACAO_AUSENTE", promptVersion: observationPromptVersion };
    const errors: string[] = [];
    for (const provider of providers) {
      try {
        return { source: "groq", reading: await readWithRetry(provider.reader, observation, context), promptVersion: observationPromptVersion, model: provider.model };
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "IA_LEITURA_INDISPONIVEL");
      }
    }
    throw new Error(errors.join(";"));
  } catch (error) {
    const code = error instanceof Error && /^(GEMINI|OPENROUTER|GROQ)_/.test(error.message) ? error.message : "IA_LEITURA_INDISPONIVEL";
    return { source: "nao_lida", reason: code, promptVersion: observationPromptVersion };
  }
}

async function readWithRetry(reader: ObservationReader, observation: string, context: ObservationContext): Promise<ObservationReading> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await reader.read(observation, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : "IA_LEITURA_INDISPONIVEL";
      if (attempt === 2 || !retryableProviderError(message)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw new Error("IA_LEITURA_INDISPONIVEL");
}

function retryableProviderError(message: string): boolean {
  return /_HTTP_(429|5\d\d)$/.test(message) || /aborted|timeout|fetch failed|network/i.test(message);
}
