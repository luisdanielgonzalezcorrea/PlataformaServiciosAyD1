import { beforeEach, describe, expect, it } from "vitest";
import { httpClient } from "../src/api/httpClient";
import { reservationCode } from "../src/api/reservationService";
import { DAY_STATUS, getMonthAvailability } from "../src/api/scheduleService";

function answerWith(handler) {
  httpClient.defaults.adapter = async (config) => {
    const out = handler(config);
    if (out.status >= 400) {
      const error = new Error(String(out.status));
      error.config = config;
      error.response = { status: out.status, headers: {}, data: out.data };
      throw error;
    }
    return { data: out.data, status: out.status, statusText: "OK", headers: {}, config };
  };
}

describe("Código de reserva (HU-029)", () => {
  it("usa el reservationCode que manda el back", () => {
    expect(reservationCode({ id: "79898eee-21d1-415d-b401-159a83c30bf1", reservationCode: "RSV-ABCD1234" })).toBe("RSV-ABCD1234");
  });
  it("si el back no lo manda, lo arma con el id", () => {
    expect(reservationCode({ id: "79898eee-21d1-415d-b401-159a83c30bf1" })).toBe("RSV-79898EEE");
    expect(reservationCode("79898eee-21d1-415d-b401-159a83c30bf1")).toBe("RSV-79898EEE");
  });
});

describe("Calendario mensual (HU-018 / HU-019)", () => {
  const service = { id: "svc-1" };

  it("con el endpoint mensual del back hace una sola llamada y respeta los estados", async () => {
    const urls = [];
    answerWith((c) => {
      urls.push(c.url);
      return { status: 200, data: [
        { date: "2026-10-19", status: "AVAILABLE", availableSlots: 4, totalSlots: 4 },
        { date: "2026-10-20", status: "PARTIAL", availableSlots: 2, totalSlots: 4 },
        { date: "2026-10-21", status: "FULL", availableSlots: 0, totalSlots: 4 },
        { date: "2026-10-22", status: "UNAVAILABLE", availableSlots: 0, totalSlots: 0 },
      ] };
    });
    const res = await getMonthAvailability(service, 2026, 9);
    expect(urls).toHaveLength(1);
    expect(String(urls[0])).toContain("/availability/month");
    expect(res["2026-10-19"].status).toBe(DAY_STATUS.AVAILABLE);
    expect(res["2026-10-20"].status).toBe(DAY_STATUS.PARTIAL);
    expect(res["2026-10-21"].status).toBe(DAY_STATUS.FULL);
    expect(res["2026-10-22"].status).toBe(DAY_STATUS.DISABLED);
    expect(res["2026-10-23"].status).toBe(DAY_STATUS.DISABLED); // día que el back no mencionó
  });

  it("también entiende un objeto { fecha: estado }", async () => {
    answerWith(() => ({ status: 200, data: { "2026-10-19": "AVAILABLE", "2026-10-20": { status: "FULL" } } }));
    const res = await getMonthAvailability({ id: "svc-2" }, 2026, 9);
    expect(res["2026-10-19"].status).toBe(DAY_STATUS.AVAILABLE);
    expect(res["2026-10-20"].status).toBe(DAY_STATUS.FULL);
  });

  it("si el endpoint mensual no existe (404), usa el cálculo día por día", async () => {
    const urls = [];
    answerWith((c) => {
      urls.push(String(c.url));
      if (String(c.url).endsWith("/availability/month")) return { status: 404, data: "" };
      return { status: 200, data: [] };
    });
    const res = await getMonthAvailability({ id: "svc-3" }, 2026, 9);
    expect(urls[0]).toContain("/availability/month");
    expect(urls.some((u) => u.endsWith("/availability"))).toBe(true);
    expect(Object.keys(res)).toHaveLength(31);
  });
});
