import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const csv = await readFile(resolve(process.cwd(), "data/guias.csv"), "utf8");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8" } });
}
