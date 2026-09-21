import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseGuides, verifyBatch } from "../src/core/batch";
import { riskValue } from "../src/core/metrics";

const root = resolve(__dirname, "..");
const csv = readFileSync(resolve(root, "data/guias.csv"), "utf8");

describe("golden de agosto", () => {
  it("verifica as 80 guias e fecha os numeros principais", () => {
    const guides = parseGuides(csv);
    const results = verifyBatch(guides, { modo: "lote", data_referencia: "2026-08-31" });
    expect(results).toHaveLength(80);
    expect(results.filter((result) => result.status === "OK")).toHaveLength(41);
    expect(results.filter((result) => result.status === "PENDENTE")).toHaveLength(39);
    expect(results.reduce((total, result) => result.status === "PENDENTE" ? total + (result.valor ?? 0) : total, 0)).toBe(2886);
    expect(riskValue(results, new Map(guides.map((guide) => [guide.id_guia, guide])))).toBe(2664);
  });

  it("distingue duplicidade de conflito de autorizacao", () => {
    const guides = parseGuides(csv);
    const results = verifyBatch(guides, { modo: "lote", data_referencia: "2026-08-31" });
    const codes = (id: string) => results.find((result) => result.id_guia === id)?.motivos.map((reason) => reason.codigo) ?? [];
    expect(codes("G-2608-0027")).toContain("DUPLICADA");
    expect(codes("G-2608-0057")).toContain("DUPLICADA");
    expect(codes("G-2608-0059")).toContain("DUPLICADA");
    expect(codes("G-2608-0076")).toContain("DUPLICADA");
    expect(codes("G-2608-0017")).toContain("CONFLITO_AUTORIZACAO");
    expect(codes("G-2608-0060")).toContain("CONFLITO_AUTORIZACAO");
    expect(codes("G-2608-0017")).not.toContain("DUPLICADA");
    expect(codes("G-2608-0060")).not.toContain("DUPLICADA");
  });
});
