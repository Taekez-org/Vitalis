import { createHash } from "node:crypto";

export function normalizarObservacao(value: string): string {
  return value.normalize("NFC").replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ");
}

export function mascararObservacao(value: string): string {
  return normalizarObservacao(value)
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]")
    .replace(/(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}\b/g, "[TELEFONE]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[EMAIL]");
}

export function hashObservacao(value: string): string {
  return createHash("sha256").update(normalizarObservacao(value)).digest("hex");
}

export function chaveLeitura(observacao: string, contexto: unknown, promptVersion: string, model: string): string {
  return createHash("sha256").update(JSON.stringify({ observacao: normalizarObservacao(observacao), contexto, promptVersion, model })).digest("hex");
}
