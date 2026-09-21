import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseGuides, verifyBatch } from "../../src/core/batch";
import { saveLoad } from "../../src/infra/store";

export async function carregarDemo() {
  const csv = readFileSync(resolve(process.cwd(), "data/guias.csv"), "utf8");
  const guides = parseGuides(csv);
  const results = verifyBatch(guides, { modo: "lote", data_referencia: "2026-08-31" });
  return saveLoad("demo.csv", createHash("sha256").update(csv).digest("hex"), guides, results);
}
