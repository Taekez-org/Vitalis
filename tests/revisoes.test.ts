import { describe, expect, it } from "vitest";
import { GET as getRevisions } from "../src/app/api/revisoes/route";
import { POST as resolveRevision } from "../src/app/api/revisoes/[id]/route";
import { saveLoad } from "../src/infra/store";
import type { Guia, Resultado } from "../src/core/types";

const guide: Guia = { id_guia: "G-REV-001", unidade: "Centro", data_atendimento: "2026-09-01", paciente: "Paciente", convenio: "Vitalcard", carteirinha: "", cid: "", procedimento_codigo: "50000470", procedimento_descricao: "Fisioterapia", numero_autorizacao: "A", autorizacao_validade: "2026-09-30", autorizacao_sessoes_limite: "10", sessao_numero_na_autorizacao: "1", profissional: "", profissional_registro: "", valor: "100", observacao_recepcao: "Paciente faltou", data_lancamento: "2026-09-01" };
const result: Resultado = { id_guia: guide.id_guia, status: "OK", modo: "lote", data_referencia: "2026-09-01", motivos: [], avisos: [], valor: 100, observacao: { origem: "groq", classe: "revisar", sinais: [], motivo: "Confirmar se o atendimento ocorreu.", chave: "chave-revisao", prompt_versao: "obs-v1", modelo: "modelo-teste" } };

describe("revisao humana da observacao", () => {
  it("persiste uma revisao separada e resolve sem mudar o resultado tecnico", async () => {
    await saveLoad("revisao.csv", "hash-revisao", [guide], [result]);
    const listed = await getRevisions();
    expect((await listed.json()).revisoes[0].status).toBe("ABERTA");
    const response = await resolveRevision(new Request("http://localhost/api/revisoes/G-REV-001", { method: "POST", body: JSON.stringify({ chave: "chave-revisao", por_quem: "Carla" }) }), { params: Promise.resolve({ id: "G-REV-001" }) });
    expect(response.status).toBe(200);
    const after = await (await getRevisions()).json();
    expect(after.revisoes[0].status).toBe("RESOLVIDA");
    expect(after.revisoes[0].resolvida_por).toBe("Carla");
  });
});
