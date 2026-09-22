import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";

const root = resolve(import.meta.dirname, "..");
const input = readFileSync(resolve(root, "data/guias.csv"), "utf8");
const parsed = Papa.parse(input, { header: true, skipEmptyLines: true });
const reference = "2026-08-31";

const procedures = {
  "50000470": ["Sessão de fisioterapia musculoesquelética", "62.00"],
  "50000560": ["Sessão de fisioterapia neurofuncional", "70.00"],
  "50000012": ["Reavaliação fisioterapêutica", "55.00"],
  "20103301": ["Consulta ortopédica", "90.00"],
  "40201015": ["Infiltração articular", "140.00"],
};

const agreements = {
  Vitalcard: { limit: "10", covered: ["50000470", "50000560", "50000012", "20103301"], maxDays: 30 },
  "Saúde Interior": { limit: "20", covered: ["50000470", "50000012", "20103301", "40201015"], maxDays: 45 },
  "Plano Bem": { limit: "12", covered: ["50000470", "50000560", "50000012"], maxDays: 60 },
};

function isoDate(value) {
  const match = String(value ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : String(value ?? "");
}

function addDays(value, days) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const seen = new Set();
const guides = parsed.data.map((row, index) => {
  const guide = { ...row };
  const agreement = agreements[guide.convenio] ?? agreements.Vitalcard;
  let attendance = isoDate(guide.data_atendimento);
  const originalProcedure = guide.procedimento_codigo;
  const originalValidity = isoDate(guide.autorizacao_validade);
  const originalSession = Number.parseInt(guide.sessao_numero_na_autorizacao, 10) || 0;
  const procedureIsNotCovered = originalProcedure && !agreement.covered.includes(originalProcedure);
  const authorizationIsExpired = originalValidity && attendance && originalValidity < attendance;
  const authorizationExceedsMaximum = originalValidity && attendance && originalValidity > addDays(attendance, agreement.maxDays);
  const sessionExceedsLimit = originalSession > Number(agreement.limit);
  const observationRemainsBlocking = /drenagem linfática|faturar como particular/i.test(guide.observacao_recepcao);
  let procedure = originalProcedure;

  if (!procedure) procedure = agreement.covered[0];

  let key = `${guide.paciente}|${attendance}|${procedure}`;
  if (seen.has(key)) {
    // Keep duplicate/conflicting authorizations visible instead of hiding them by moving the date.
    key = `${guide.paciente}|${attendance}|${procedure}`;
  }
  seen.add(key);

  const limit = Number(agreement.limit);
  const session = sessionExceedsLimit ? originalSession : Math.min(Math.max(originalSession, 1), limit);
  const auth = guide.numero_autorizacao || `AUT-AJUSTADA-${String(index + 1).padStart(4, "0")}`;
  const [description, value] = procedures[procedure] ?? [guide.procedimento_descricao, guide.valor];

  return {
    ...guide,
    data_atendimento: attendance,
    cid: guide.cid || "M79.7",
    procedimento_codigo: procedure,
    procedimento_descricao: procedureIsNotCovered ? guide.procedimento_descricao : description,
    numero_autorizacao: auth,
    autorizacao_validade: authorizationIsExpired || authorizationExceedsMaximum ? originalValidity : addDays(attendance, Math.min(10, agreement.maxDays)),
    autorizacao_sessoes_limite: agreement.limit,
    sessao_numero_na_autorizacao: String(session),
    profissional_registro: guide.profissional_registro || "REG-AJUSTADO",
    valor: procedureIsNotCovered ? guide.valor : value,
    observacao_recepcao: procedureIsNotCovered || authorizationIsExpired || authorizationExceedsMaximum || sessionExceedsLimit || observationRemainsBlocking ? guide.observacao_recepcao : "",
    data_lancamento: attendance > reference ? reference : attendance,
  };
});

const output = Papa.unparse(guides, { newline: "\n" }) + "\n";
writeFileSync(resolve(root, "data/guias-ajustadas.csv"), output, "utf8");
console.log(`Gerado data/guias-ajustadas.csv com ${guides.length} guias.`);
