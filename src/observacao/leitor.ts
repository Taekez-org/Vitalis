import { groqConfig, leitorIaLigado } from "./config";
import { mascararObservacao } from "./seguranca";
import { observationPromptVersion, observationSystemPrompt, userPrompt } from "./prompt";
import { parseObservationReading, type ObservationContext, type ObservationReading, type ObservationSource } from "./contrato";

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
    const timer = setTimeout(() => controller.abort(), 4000);
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
    const config = reader ? null : groqConfig();
    if (!reader && !config) return { source: "nao_lida", reason: "LEITOR_IA_CONFIGURACAO_AUSENTE", promptVersion: observationPromptVersion };
    return { source: "groq", reading: await (reader ?? new GroqObservationReader()).read(observation, context), promptVersion: observationPromptVersion, model: config?.model ?? "fake" };
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith("GROQ_HTTP_") ? error.message : "GROQ_LEITURA_INDISPONIVEL";
    return { source: "nao_lida", reason: code, promptVersion: observationPromptVersion };
  }
}
