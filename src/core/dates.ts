const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export function parseDate(value: string): { date?: string; formatted: boolean; invalid: boolean } {
  const input = value.trim().replace(/\u00a0/g, " ");
  const iso = DATE_PATTERN.exec(input);
  const br = BR_DATE_PATTERN.exec(input);
  const year = iso ? Number(iso[1]) : br ? Number(br[3]) : NaN;
  const month = iso ? Number(iso[2]) : br ? Number(br[2]) : NaN;
  const day = iso ? Number(iso[3]) : br ? Number(br[1]) : NaN;
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || !Number.isInteger(day)) return { formatted: false, invalid: true };
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return { formatted: Boolean(br), invalid: true };
  return { date: `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`, formatted: Boolean(br), invalid: false };
}

export function addDays(value: string, days: number): string {
  const parsed = parseDate(value);
  if (!parsed.date) return value;
  const date = new Date(`${parsed.date}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function differenceInDays(later: string, earlier: string): number {
  const a = Date.parse(`${later}T00:00:00Z`);
  const b = Date.parse(`${earlier}T00:00:00Z`);
  return Math.round((a - b) / 86400000);
}

export function diasUteis(desde: string, ate: string): number {
  const start = parseDate(desde).date;
  const end = parseDate(ate).date;
  if (!start || !end || end <= start) return 0;
  let total = 0;
  const cursor = new Date(`${start}T00:00:00Z`);
  const target = Date.parse(`${end}T00:00:00Z`);
  while (cursor.getTime() < target) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) total += 1;
  }
  return total;
}
