export function agora(): Date {
  return new Date();
}

export function hojeEmSaoPaulo(now = agora()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function diaEmSaoPaulo(iso: string): string {
  return hojeEmSaoPaulo(new Date(iso));
}
