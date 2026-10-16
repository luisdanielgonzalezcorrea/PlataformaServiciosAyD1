import { beforeEach, describe, expect, it } from "vitest";
import { httpClient } from "../src/api/httpClient";
import { loadSchedule, saveSchedule } from "../src/api/scheduleService";

const ID = "8f14e45f-ea5b-4b1c-9d3a-2c7f6b0a1e93";

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

beforeEach(() => localStorage.clear());

describe("Mi agenda (HU-014): el back no tiene GET de horarios", () => {
  it("sin GET (405) y sin copia local: no hay horarios", async () => {
    answerWith(() => ({ status: 405, data: "" }));
    expect(await loadSchedule(ID)).toEqual({ items: [], source: "none" });
  });

  it("al guardar la agenda queda una copia y se vuelve a mostrar", async () => {
    answerWith((c) => (c.method === "put" ? { status: 200, data: [] } : { status: 405, data: "" }));
    await saveSchedule(ID, [{ day_of_week: 1, start_time: "08:00", end_time: "12:00" }]);
    const res = await loadSchedule(ID);
    expect(res.source).toBe("local");
    expect(res.items).toEqual([{ dayOfWeek: 1, startTime: "08:00", endTime: "12:00" }]);
  });

  it("sin GET ni copia local: reconstruye los días desde la disponibilidad que ve el cliente", async () => {
    // Solo los lunes (ISO 1) tienen horarios: 08:00 a 09:30 en franjas de 30 min.
    answerWith((c) => {
      if (String(c.url).endsWith("/schedules")) return { status: 405, data: "" };
      const [y, m, d] = c.params.date.split("-").map(Number);
      const isMonday = new Date(y, m - 1, d).getDay() === 1;
      return {
        status: 200,
        data: isMonday
          ? [{ startTime: "08:00", endTime: "08:30" }, { startTime: "08:30", endTime: "09:00" }, { startTime: "09:00", endTime: "09:30" }]
          : [],
      };
    });
    const res = await loadSchedule(ID, { id: ID, startDate: null, endDate: null });
    expect(res.source).toBe("inferred");
    expect(res.items).toEqual([{ dayOfWeek: 1, startTime: "08:00", endTime: "09:30" }]);
  });

  it("cuando el back tenga el GET, manda lo del servidor", async () => {
    answerWith(() => ({ status: 200, data: [{ id: "x", dayOfWeek: 2, startTime: "09:00:00", endTime: "11:00:00" }] }));
    const res = await loadSchedule(ID);
    expect(res.source).toBe("server");
    expect(res.items).toHaveLength(1);
  });
});
