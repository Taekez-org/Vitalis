import { describe, expect, it } from "vitest";
import { diasUteis } from "../src/core/dates";
import { calcularFrescor } from "../src/servico/frescor";

describe("frescor dos dados", () => {
  it("conta dias úteis sem incluir o dia da carga", () => {
    expect(diasUteis("2026-09-21", "2026-09-21")).toBe(0);
    expect(diasUteis("2026-09-18", "2026-09-21")).toBe(1);
    expect(diasUteis("2026-09-18", "2026-09-22")).toBe(2);
    expect(calcularFrescor("2026-09-18T12:00:00Z", "2026-09-22")).toMatchObject({ dia_ultima_carga: "2026-09-18", dias_uteis_desde_ultima_carga: 2, defasado: true });
  });

  it("converte o instante para a data de São Paulo", () => {
    expect(calcularFrescor("2026-09-22T01:00:00Z", "2026-09-22")).toMatchObject({ dia_ultima_carga: "2026-09-21", dias_uteis_desde_ultima_carga: 1, defasado: false });
    expect(calcularFrescor(undefined, "2026-09-22")).toEqual({ ultima_carga: null, dia_ultima_carga: null, dias_uteis_desde_ultima_carga: null, defasado: null });
  });
});
