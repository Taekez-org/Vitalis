import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GET as getPendencias } from "../src/app/api/pendencias/route";
import { GET as getCsv } from "../src/app/api/pendencias/csv/route";
import { latestResults, markTreatment, resetStore, saveLoad, store, treatmentAfterVerification } from "../src/infra/store";
import { parseGuides, verifyBatch } from "../src/core/batch";
import { carregarDemo } from "./helpers/demo";

describe("fila de pendencias", () => {
  beforeEach(async () => { await carregarDemo(); });
  it("filtra duplicidades sem misturar conflitos", async () => {
    const response = await getPendencias(new Request("http://localhost/api/pendencias?codigo=DUPLICADA"));
    const body = await response.json() as { pendencias: { id_guia: string }[] };
    expect(response.status).toBe(200);
    expect(body.pendencias.map((item) => item.id_guia).sort()).toEqual([
      "G-2608-0027", "G-2608-0057", "G-2608-0059", "G-2608-0076",
    ]);
  });

  it("exporta somente o recorte filtrado e sem dados pessoais", async () => {
    const response = await getCsv(new Request("http://localhost/api/pendencias/csv?codigo=CONFLITO_AUTORIZACAO"));
    const bytes = new Uint8Array(await response.arrayBuffer());
    const csv = new TextDecoder().decode(bytes);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect([...bytes.slice(0, 3)]).toEqual([239, 187, 191]);
    expect(csv).toContain("id_guia;unidade;convenio");
    expect(csv).toContain("G-2608-0017");
    expect(csv).toContain("G-2608-0060");
    expect(csv).not.toContain("P-1017");
    expect(csv).not.toContain("598125208");
    expect(csv).not.toContain("DUPLICADA");
  });

  it("mantem o status tecnico e avanca somente o tratamento", () => {
    const treatment = { id_guia: "G-TESTE", status: "AGUARDANDO_REVERIFICACAO" as const, markedAt: "2026-08-31T00:00:00.000Z", markedBy: "Equipe" };
    expect(treatmentAfterVerification(treatment, "PENDENTE")?.status).toBe("EM_TRATAMENTO");
    expect(treatmentAfterVerification(treatment, "OK")?.status).toBe("RESOLVIDA");
    expect(treatmentAfterVerification({ ...treatment, status: "RESOLVIDA" }, "PENDENTE")?.status).toBe("ABERTA");
    expect(treatmentAfterVerification({ ...treatment, status: "EM_TRATAMENTO" }, "PENDENTE")?.status).toBe("EM_TRATAMENTO");
    expect(treatmentAfterVerification(undefined, "OK")).toBeUndefined();
  });

  it("não duplica uma carga reenviada pelo mesmo hash", async () => {
    const body = `${readFileSync("data/guias.csv", "utf8")}\n`;
    const first = await (await import("../src/app/api/lote/route")).POST(new Request("http://localhost/api/lote", { method: "POST", body }));
    const count = store.verifications.length;
    const second = await (await import("../src/app/api/lote/route")).POST(new Request("http://localhost/api/lote", { method: "POST", body }));
    expect((await first.json()).ja_carregado).toBe(false);
    expect((await second.json()).ja_carregado).toBe(true);
    expect(store.verifications.length).toBe(count);
  });

  it("reabre uma pendência resolvida quando ela volta a falhar", async () => {
    resetStore();
    const guides = parseGuides(readFileSync("data/guias.csv", "utf8"));
    const original = verifyBatch(guides, { modo: "lote", data_referencia: "2026-08-31" });
    await saveLoad("a.csv", "hash-a", guides, original);
    expect((await latestResults()).filter((result) => result.status === "PENDENTE")).toHaveLength(39);
    expect(markTreatment("G-2608-0031")?.status).toBe("AGUARDANDO_REVERIFICACAO");
    const fixed = original.map((result) => result.id_guia === "G-2608-0031" ? { ...result, status: "OK" as const, motivos: [] } : result);
    await saveLoad("b.csv", "hash-b", guides, fixed);
    expect((await latestResults()).filter((result) => result.status === "PENDENTE")).toHaveLength(38);
    expect(store.treatments.get("G-2608-0031")?.status).toBe("RESOLVIDA");
    const broken = fixed.map((result) => result.id_guia === "G-2608-0031" ? { ...result, status: "PENDENTE" as const, motivos: original.find((item) => item.id_guia === result.id_guia)!.motivos } : result);
    await saveLoad("c.csv", "hash-c", guides, broken);
    expect((await latestResults()).filter((result) => result.status === "PENDENTE")).toHaveLength(39);
    expect(store.treatments.get("G-2608-0031")?.status).toBe("ABERTA");
  });
});
