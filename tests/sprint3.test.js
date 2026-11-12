import { beforeEach, describe, expect, it } from "vitest";
import { httpClient } from "../src/api/httpClient";
import {
  blockDates, getOccupancyReport, listMyServices, listProviderReservations, setServiceActive, updateService,
} from "../src/api/providerService";
import { forgotPassword, requestContactCode, resetPassword, updateClientContact } from "../src/api/accountService";
import { listAllReservations, modifyReservation } from "../src/api/reservationService";
import {
  classifyOccupancy, conflictsFor, displayStatus, expandDateRange, filterReservations, filterServices, paginate,
  splitReservations, validateBlockRange, validateNewPassword, validateServiceForm, serviceToBody,
} from "../src/utils/sprint3";
import { addDays, todayISO } from "../src/utils/dates";

const calls = [];
function answerWith(handler) {
  calls.length = 0;
  httpClient.defaults.adapter = async (config) => {
    calls.push({ method: config.method, url: config.url, params: config.params, data: config.data ? JSON.parse(config.data) : undefined });
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

const svc = (id, o = {}) => ({ id, companyId: "c1", name: `Servicio ${id}`, modality: "VIRTUAL", cost: 1000, isActive: true, ...o });

describe("HU-010 · listado de mis servicios", () => {
  const list = [svc("a", { name: "Yoga" }), svc("b", { name: "Consulta", isActive: false }), svc("c", { name: "Consulta legal" })];
  it("filtra por estado y por nombre", () => {
    expect(filterServices(list, { status: "ACTIVE" })).toHaveLength(2);
    expect(filterServices(list, { status: "INACTIVE" }).map((s) => s.id)).toEqual(["b"]);
    expect(filterServices(list, { search: "consulta" })).toHaveLength(2);
  });
  it("pagina", () => {
    const many = Array.from({ length: 20 }, (_, i) => svc(String(i)));
    expect(paginate(many, 0).items).toHaveLength(8);
    expect(paginate(many, 9).page).toBe(2);
  });
});

describe("HU-012 · activar y desactivar (el back no lista inactivos)", () => {
  it("PATCH /services/{id}/status con is_active", async () => {
    answerWith(() => ({ status: 200, data: {} }));
    await setServiceActive("s1", false);
    expect(calls[0]).toMatchObject({ method: "patch", url: "/services/s1/status", data: { is_active: false } });
  });
  it("sigue mostrando un servicio desactivado usando el registro local", async () => {
    answerWith((c) => {
      if (c.url === "/companies") return { status: 200, data: [{ id: "c1" }] };
      if (c.url === "/services") return { status: 200, data: { items: [svc("a")], page: 0, size: 100, totalElements: 1, totalPages: 1 } };
      return { status: 200, data: svc("b", { isActive: false }) };
    });
    localStorage.setItem("servas_my_services_c1", JSON.stringify(["a", "b"]));
    const { data } = await listMyServices();
    expect(data.map((s) => [s.id, s.isActive])).toEqual([["a", true], ["b", false]]);
  });
});

describe("HU-011 · editar servicio", () => {
  const ok = { name: "Yoga", cost: "50000", description: "d", modality: "VIRTUAL", durationMinutes: 60, capacity: 1 };
  it("valida los obligatorios", () => {
    expect(validateServiceForm({ ...ok, name: "", cost: "", description: "" })).toMatchObject({ name: expect.any(String), cost: expect.any(String), description: expect.any(String) });
    expect(validateServiceForm({ ...ok, modality: "PRESENCIAL" }).comunaId).toBeTruthy();
    expect(validateServiceForm(ok)).toEqual({});
  });
  it("PUT /services/{id} en snake_case", async () => {
    answerWith(() => ({ status: 200, data: svc("s1") }));
    await updateService("s1", { ...ok, modality: "PRESENCIAL", comunaId: "12", recommendations: "r" });
    expect(calls[0]).toMatchObject({ method: "put", url: "/services/s1" });
    expect(calls[0].data).toMatchObject({ name: "Yoga", cost: 50000, duration_minutes: 60, comuna_id: 12, recommendations: "r" });
    expect(serviceToBody(ok).comuna_id).toBeUndefined();
  });
});

describe("HU-035 / HU-036 · reservas del proveedor", () => {
  it("manda filtros con los nombres del back", async () => {
    answerWith(() => ({ status: 200, data: { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } }));
    await listProviderReservations({ status: "CANCELLED", serviceId: "s1", fromDate: "2026-11-01", toDate: "2026-11-30" });
    expect(calls[0].params).toMatchObject({ status: "CANCELLED", service_id: "s1", from_date: "2026-11-01", to_date: "2026-11-30" });
  });
  it("una reserva confirmada que ya pasó se ve Finalizada", () => {
    expect(displayStatus({ status: "CONFIRMED", reservationDate: "2020-01-01", startTime: "09:00", endTime: "10:00" })).toBe("COMPLETED");
    expect(displayStatus({ status: "CONFIRMED", reservationDate: addDays(todayISO(), 3), startTime: "09:00", endTime: "10:00" })).toBe("CONFIRMED");
    expect(displayStatus({ status: "CANCELLED", reservationDate: "2020-01-01", startTime: "09:00", endTime: "10:00" })).toBe("CANCELLED");
  });
});

describe("HU-038 / HU-039 · reportes", () => {
  it("clasifica ocupación: 0 % sin ocupación, 100 % completo", () => {
    const out = classifyOccupancy([
      { serviceId: 1, booked: 0, capacity: 7, occupancyPercent: 0 },
      { serviceId: 2, booked: 7, capacity: 7, occupancyPercent: 100 },
      { serviceId: 3, booked: 3, capacity: 7, occupancyPercent: 42.9 },
    ]);
    expect(out.empty.map((r) => r.serviceId)).toEqual([1]);
    expect(out.full.map((r) => r.serviceId)).toEqual([2]);
    expect(out.rows[2].free).toBe(4);
  });
  it("GET /reports/occupancy con from_date/to_date", async () => {
    answerWith(() => ({ status: 200, data: { services: [], overallPercent: 0 } }));
    await getOccupancyReport({ fromDate: "2026-11-01", toDate: "2026-11-30" });
    expect(calls[0]).toMatchObject({ url: "/reports/occupancy", params: { from_date: "2026-11-01", to_date: "2026-11-30" } });
  });
});

describe("HU-017 · bloqueo de fechas", () => {
  it("expande un rango y lo limita a 31 días", () => {
    expect(expandDateRange("2026-12-01", "2026-12-03")).toEqual(["2026-12-01", "2026-12-02", "2026-12-03"]);
    expect(expandDateRange("2026-12-05")).toEqual(["2026-12-05"]);
    expect(validateBlockRange(addDays(todayISO(), 1), addDays(todayISO(), 90))).toMatch(/máximo/);
    expect(validateBlockRange("2020-01-01")).toMatch(/pasadas/);
  });
  it("detecta reservas activas en conflicto", () => {
    const found = conflictsFor([
      { reservationDate: "2026-12-01", status: "CONFIRMED" }, { reservationDate: "2026-12-01", status: "CANCELLED" }, { reservationDate: "2026-12-09", status: "CONFIRMED" },
    ], ["2026-12-01"]);
    expect(found).toHaveLength(1);
  });
  it("hace un POST por fecha y reporta las que fallan", async () => {
    let n = 0;
    answerWith(() => (++n === 2 ? { status: 400, data: { code: "VALIDATION_ERROR", message: "Fecha inválida" } } : { status: 201, data: {} }));
    const out = await blockDates({ companyId: "c1", from: "2026-12-01", to: "2026-12-03", reason: "Vacaciones" });
    expect(calls).toHaveLength(3);
    expect(calls[0].data).toEqual({ company_id: "c1", block_date: "2026-12-01", reason: "Vacaciones" });
    expect(out.done).toHaveLength(2);
    expect(out.failed[0].date).toBe("2026-12-02");
  });
});

describe("HU-030 / HU-031 / HU-032 / HU-033 · reservas del cliente", () => {
  const today = todayISO();
  const mk = (id, status, date) => ({ id, status, reservationDate: date, startTime: "09:00", reservationCode: `RSV-${id}` });
  it("separa activas e historial y filtra", () => {
    const { active, history } = splitReservations([
      mk("A1", "CONFIRMED", addDays(today, 2)), mk("B1", "CANCELLED", addDays(today, 2)), mk("C1", "CONFIRMED", "2020-01-01"),
    ]);
    expect(active.map((r) => r.id)).toEqual(["A1"]);
    expect(history).toHaveLength(2);
    expect(filterReservations(history, { status: "CANCELLED" })).toHaveLength(1);
    expect(filterReservations(history, { code: "rsv-c1" })).toHaveLength(1);
    expect(filterReservations(history, { from: "2025-01-01" })).toHaveLength(1);
  });
  it("lista todas las reservas con la sesión del cliente", async () => {
    sessionStorage.setItem("servas_client_token", "tok");
    answerWith(() => ({ status: 200, data: { items: [{ id: "11111111-aaaa", status: "CANCELLED", reservationDate: "2026-01-01", startTime: "09:00" }] } }));
    const { data } = await listAllReservations("123456");
    expect(data[0].reservationCode).toBe("RSV-11111111");
    expect(calls[0].url).toBe("/reservations/client/123456");
  });
  it("PUT /reservations/{id} con la nueva fecha y hora", async () => {
    answerWith(() => ({ status: 200, data: { serviceId: "s1" } }));
    await modifyReservation("r1", { date: "2026-12-02", startTime: "10:00", endTime: "11:00" });
    expect(calls[0]).toMatchObject({ method: "put", url: "/reservations/r1", data: { reservation_date: "2026-12-02", start_time: "10:00", end_time: "11:00" } });
  });
});

describe("HU-006 · recuperar contraseña", () => {
  it("valida la contraseña nueva", () => {
    expect(validateNewPassword("corta", "corta")).toMatch(/8/);
    expect(validateNewPassword("12345678", "87654321")).toMatch(/coinciden/);
    expect(validateNewPassword("12345678", "12345678")).toBeNull();
  });
  it("forgot y reset usan los endpoints del back", async () => {
    answerWith(() => ({ status: 200, data: {} }));
    await forgotPassword("a@b.co");
    await resetPassword("tok", "12345678");
    expect(calls[0]).toMatchObject({ url: "/auth/forgot-password", data: { email: "a@b.co" } });
    expect(calls[1]).toMatchObject({ url: "/auth/password/reset", data: { token: "tok", new_password: "12345678" } });
  });
  it("un token usado llega como RESET_TOKEN_INVALID", async () => {
    answerWith(() => ({ status: 400, data: { code: "RESET_TOKEN_INVALID", message: "vencido" } }));
    await expect(resetPassword("x", "12345678")).rejects.toMatchObject({ code: "RESET_TOKEN_INVALID" });
  });
});

describe("HU-041 · contacto del cliente", () => {
  it("pide el código para el correo nuevo y guarda con verification_code", async () => {
    answerWith(() => ({ status: 200, data: {} }));
    await requestContactCode("nuevo@x.co");
    await updateClientContact({ firstName: "Ana", lastName: "G", phone: "3001234567", email: "nuevo@x.co", verificationCode: "123456" });
    expect(calls[0]).toMatchObject({ method: "post", url: "/clients/me/contact/verification", data: { new_email: "nuevo@x.co" } });
    expect(calls[1]).toMatchObject({ method: "patch", url: "/clients/me/contact", data: { first_name: "Ana", email: "nuevo@x.co", verification_code: "123456" } });
  });
  it("sin cambio de correo no manda código", async () => {
    answerWith(() => ({ status: 200, data: {} }));
    await updateClientContact({ firstName: "Ana", lastName: "G", phone: "3001234567", email: "a@x.co" });
    expect(calls[0].data.verification_code).toBeUndefined();
  });
  it("correo repetido llega como EMAIL_TAKEN (409)", async () => {
    answerWith(() => ({ status: 409, data: { code: "EMAIL_TAKEN", message: "ocupado" } }));
    await expect(requestContactCode("otro@x.co")).rejects.toMatchObject({ status: 409 });
  });
});
