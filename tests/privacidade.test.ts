import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { parseGuides } from "../src/core/batch";
import { GET as getPendencias } from "../src/app/api/pendencias/route";
import { GET as getCsv } from "../src/app/api/pendencias/csv/route";
import { GET as getDashboard } from "../src/app/api/dashboard/route";
import { GET as getReport } from "../src/app/api/relatorio/route";
import { POST as postLote } from "../src/app/api/lote/route";
import { POST as postTreatment } from "../src/app/api/pendencias/[id]/route";
import { consultarPendencias, consultarRegra } from "../src/mcp/ferramentas";
import { carregarDemo } from "./helpers/demo";

const csv = readFileSync("data/guias.csv", "utf8");
const guides = parseGuides(csv);
const forbidden = guides.flatMap((guide) => [guide.paciente, guide.carteirinha, guide.cid, guide.observacao_recepcao]).filter(Boolean);

describe("privacidade das saídas públicas", () => {
  beforeEach(async () => { await carregarDemo(); });

  it("não expõe dados pessoais em nenhuma saída", async () => {
    const requests: Response[] = [
      await getPendencias(new Request("http://localhost/api/pendencias")),
      await getPendencias(new Request("http://localhost/api/pendencias?codigo=DUPLICADA")),
      await getCsv(new Request("http://localhost/api/pendencias/csv")),
      await getDashboard(new Request("http://localhost/api/dashboard")),
      await getReport(new Request("http://localhost/api/relatorio")),
      await getReport(new Request("http://localhost/api/relatorio?formato=texto")),
      await postLote(new Request("http://localhost/api/lote", { method: "POST", body: csv })),
      await postTreatment(new Request("http://localhost/api/pendencias/G-2608-0031", { method: "POST" }), { params: Promise.resolve({ id: "G-2608-0031" }) }),
    ];
    const mcpList = await consultarPendencias({ responsavel: "todos" });
    const mcpDetail = await consultarPendencias({ id_guia: "G-2608-0030" });
    const mcpRule = consultarRegra({ convenio: "Vitalcard", procedimento_codigo: "50000470" });
    const output = `${await Promise.all(requests.map((response) => response.text()))}${JSON.stringify(mcpList)}${JSON.stringify(mcpDetail)}${JSON.stringify(mcpRule)}`;
    for (const value of forbidden) expect(output).not.toContain(value);
  });

  it("limita os campos da guia na fila", async () => {
    const body = await (await getPendencias(new Request("http://localhost/api/pendencias"))).json() as { pendencias: { guia?: Record<string, unknown> }[] };
    const keys = Object.keys(body.pendencias[0]?.guia ?? {});
    expect(keys.every((key) => ["unidade", "convenio", "procedimento_codigo", "valor"].includes(key))).toBe(true);
  });
});
