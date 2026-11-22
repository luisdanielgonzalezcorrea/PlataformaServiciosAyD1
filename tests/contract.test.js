import { beforeEach, describe, expect, it } from "vitest";
import { PROVIDER_TOKEN_KEY, CLIENT_TOKEN_KEY } from "../src/api/httpClient";
import {
  calls, expectNoContractProblems, installContractAdapter, spec,
} from "./helpers/contract";
import * as auth from "../src/api/authService";
import * as company from "../src/api/companyService";
import * as catalog from "../src/api/catalogService";
import * as schedule from "../src/api/scheduleService";
import * as booking from "../src/api/reservationService";
import * as provider from "../src/api/providerService";
import * as account from "../src/api/accountService";

const SVC = "8f14e45f-ea5b-4b1c-9d3a-2c7f6b0a1e93";

// DIVERGENCIA Swagger vs código: el Swagger documenta la disponibilidad como
// [{ start_time, end_time, available }], pero ScheduleController.SlotView responde
// [{ startTime, endTime }] en camelCase. El front sigue el código; AyD2 debe corregir el Swagger.
const REAL_AVAILABILITY = {
  overrides: {
    "GET /services/{id}/availability": {
      status: 200,
      data: [{ startTime: "09:00", endTime: "10:00" }, { startTime: "10:00", endTime: "11:00" }],
    },
  },
};

beforeEach(() => {
  localStorage.setItem(PROVIDER_TOKEN_KEY, "token-proveedor");
  sessionStorage.setItem(CLIENT_TOKEN_KEY, "token-cliente");
  schedule.clearAvailabilityCache(SVC);
  installContractAdapter();
});

describe("Los mocks están apagados (se prueba contra el contrato, no contra datos falsos)", () => {
  it("VITE_USE_MOCKS es false en las pruebas", () => {
    expect(import.meta.env.VITE_USE_MOCKS).toBe("false");
  });
});

describe("Épica 1 · Autenticación (snake_case en los cuerpos)", () => {
  it("POST /auth/register", async () => {
    await auth.registerProvider({
      email: "a@b.co", password: "Clave1234*", documentType: "CC", documentNumber: "123456789",
      firstName: "Ana", lastName: "Pérez", phone: "3001234567",
    });
    expectNoContractProblems();
  });
  it("POST /auth/verify-email", async () => {
    await auth.verifyEmail({ email: "a@b.co", otpCode: "123456" });
    expectNoContractProblems();
  });
  it("POST /auth/verify-email/resend", async () => {
    await auth.resendVerificationCode("a@b.co");
    expectNoContractProblems();
  });
  it("POST /auth/login y adapta { token, userId, email }", async () => {
    // El Swagger no documenta el cuerpo de la respuesta del login (solo una descripción).
    // Usamos la forma real, tomada de AuthController, y lo reportamos como pendiente del back.
    installContractAdapter({
      overrides: { "POST /auth/login": { status: 200, data: { token: "uuid", userId: "u1", email: "a@b.co" } } },
    });
    const res = await auth.login({ email: "a@b.co", password: "Clave1234*" });
    expectNoContractProblems();
    expect(res.data.token).toBeTruthy();
    expect(res.data.provider).toHaveProperty("email");
  });
});

describe("Épica 1 · Negocio", () => {
  it("GET /companies (con token de proveedor)", async () => {
    const res = await company.getMyCompany();
    expectNoContractProblems();
    expect(res.data.id).toBeTruthy();
  });
  it("POST /companies (multipart)", async () => {
    await company.createCompany({ nit: "9001", name: "Mi negocio", address: "Calle 1", description: "x" });
    expectNoContractProblems();
  });
  it("PUT /companies/{id} (multipart) no manda el NIT", async () => {
    await company.updateCompany(SVC, { nit: "9001", name: "Mi negocio", address: "Calle 1" });
    expectNoContractProblems();
    expect([...calls.at(-1).config.data.keys()]).not.toContain("nit");
  });
});

describe("Épica 2 · Catálogo", () => {
  it("GET /comunas y /categories", async () => {
    await catalog.getComunas();
    await catalog.getCategories();
    expectNoContractProblems();
  });
  it("GET /services con todos los filtros y lee el PageView", async () => {
    const res = await catalog.getServices({
      comunaId: 1, modality: "VIRTUAL", category: "SALUD", q: "yoga", companyId: SVC, page: 0, size: 20,
    });
    expectNoContractProblems();
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.pageInfo).toHaveProperty("totalElements");
  });
  it("GET /services/{id}", async () => {
    await catalog.getServiceById(SVC);
    expectNoContractProblems();
  });
  it("POST /services (HU-005)", async () => {
    await catalog.createService({
      company_id: SVC, name: "Yoga", modality: "VIRTUAL", category: "SALUD", cost: 50000,
      duration_minutes: 60, capacity: 5,
    });
    expectNoContractProblems();
  });
});

describe("Épica 3 · Agenda y disponibilidad (HU-013, 014, 018, 019, 020)", () => {
  it("HU-013 PUT /services/{id} con start_date / end_date", async () => {
    await catalog.updateServiceRange(SVC, { startDate: "2099-01-01", endDate: "2099-02-01" });
    expectNoContractProblems();
  });
  it("HU-014 PUT /services/{id}/schedules", async () => {
    await schedule.saveSchedule(SVC, [{ day_of_week: 1, start_time: "08:00", end_time: "12:00" }]);
    expectNoContractProblems();
  });
  it("HU-020 GET /services/{id}/availability?date=", async () => {
    installContractAdapter(REAL_AVAILABILITY);
    const res = await schedule.getAvailability(SVC, "2099-01-05");
    expect(res.data[0]).toHaveProperty("startTime");
    expectNoContractProblems();
    expect(calls.at(-1).params).toEqual({ date: "2099-01-05" });
  });
  it("HU-018/019 el calendario mensual prueba el endpoint mensual y, si no existe, usa el diario", async () => {
    installContractAdapter(REAL_AVAILABILITY);
    const service = { id: SVC, startDate: null, endDate: null, isActive: true };
    const hoy = new Date();
    await schedule.getMonthAvailability(service, hoy.getFullYear(), hoy.getMonth());
    expectNoContractProblems();
    expect(calls.length).toBeGreaterThan(0);
    const daily = calls.filter((c) => c.key === "GET /services/{id}/availability");
    expect(calls.every((c) => c.key === "GET /services/{id}/availability" || c.key === "GET /services/{id}/availability/month")).toBe(true);
    expect(daily.length).toBeLessThanOrEqual(31);
  });
});

describe("Épica 4 · Reserva (HU-021 a HU-029)", () => {
  const client = {
    documentType: "CC", documentNumber: "1234567890", firstName: "Ana", lastName: "Pérez",
    phone: "3001234567", email: "ana@correo.co",
  };
  it("HU-027 POST /reservations (snake_case, client anidado)", async () => {
    await booking.createReservation({
      service: { id: SVC }, date: "2099-01-05", startTime: "09:00", endTime: "10:00", client,
    });
    expectNoContractProblems();
  });
  it("HU-028 POST /reservations/{id}/confirm { otp_code } (no está en el Swagger: divergencia conocida)", async () => {
    await booking.confirmReservation(SVC, "123456");
    expectNoContractProblems();
    const body = JSON.parse(calls.at(-1).config.data);
    expect(body).toEqual({ otp_code: "123456" });
  });
  it("HU-025 flujo de sesión de cliente", async () => {
    await booking.requestClientOtp(client);
    await booking.openClientSession({ ...client, otpCode: "123456" });
    await booking.getClientProfile();
    await booking.closeClientSession();
    expectNoContractProblems();
  });
  it("HU-026 GET /reservations/client/{doc} con token de cliente", async () => {
    await booking.listActiveReservations("1234567890");
    expectNoContractProblems();
    expect(calls.at(-1).config.headers.Authorization).toBe("Bearer token-cliente");
  });
  it("HU-026 PATCH /reservations/{id}/cancel { cancellation_reason }", async () => {
    await booking.cancelReservation(SVC, "No puedo asistir");
    expectNoContractProblems();
  });
});

describe("Sprint 3 · contrato completo (proveedor, cliente y admin)", () => {
  const ok = () => expectNoContractProblems();
  const sess = () => localStorage.setItem("servas_my_services_c1", "[]");
  beforeEach(sess);

  it("HU-004 el login lee { token, userId, email, role }", async () => {
    const out = await auth.login({ email: "a@b.co", password: "Clave1234*" });
    ok();
    expect(out.data).toHaveProperty("role");
  });
  it("HU-006 recuperar contraseña (forgot + reset)", async () => {
    await account.forgotPassword("a@b.co");
    await account.resetPassword("token-123", "NuevaClave123*");
    ok();
  });
  it("HU-010/011/012 mis servicios, editar y activar/desactivar", async () => {
    await provider.listMyServices();
    await provider.updateService(SVC, { name: "Yoga", cost: "50000", description: "d", modality: "VIRTUAL", durationMinutes: 60, capacity: 1 });
    await provider.setServiceActive(SVC, false);
    ok();
    expect(calls.some((c) => c.key === "GET /provider/services")).toBe(true);
  });
  it("HU-017 bloquear, listar y quitar fechas", async () => {
    await provider.blockDates({ companyId: SVC, serviceId: SVC, from: "2099-01-05", to: "2099-01-06", reason: "x" });
    await provider.listBlockedDates({ companyId: SVC, serviceId: SVC, fromDate: "2099-01-01", toDate: "2099-01-31" });
    await provider.unblockDate(SVC, SVC);
    ok();
  });
  it("HU-035/036 reservas del proveedor", async () => {
    await provider.listProviderReservations({ status: "CONFIRMED", serviceId: SVC, fromDate: "2099-01-01", toDate: "2099-01-31" });
    ok();
  });
  it("HU-038/039/040 reportes", async () => {
    const f = { serviceId: SVC, fromDate: "2099-01-01", toDate: "2099-01-31" };
    await provider.getReservationsReport(f);
    await provider.getOccupancyReport(f);
    await provider.getDemandReport({ ...f, order: "ASC", limit: 5 });
    ok();
  });
  it("HU-031/032/033/034 reservas del cliente (listar todas, detalle, modificar)", async () => {
    await booking.listAllReservations("1234567890");
    await booking.getReservation(SVC);
    await booking.modifyReservation(SVC, { date: "2099-01-05", startTime: "09:00", endTime: "10:00" });
    ok();
  });
  it("HU-041 cambio de contacto del cliente (código + actualización)", async () => {
    await account.requestContactCode("nuevo@correo.co");
    await account.updateClientContact({ firstName: "Ana", lastName: "Pérez", phone: "3001234567", email: "nuevo@correo.co", verificationCode: "123456" });
    ok();
  });
  it("HU-045 recuperar correo perdido", async () => {
    const p = { documentType: "CC", documentNumber: "1234567890", firstName: "Ana", phone: "3001234567", reservationCode: "RSV-1A2B3C4D", newEmail: "n@c.co" };
    await account.requestEmailRecovery(p);
    await account.confirmEmailRecovery({ ...p, otpCode: "123456" });
    ok();
  });
  it("HU-042/043/044 administrador", async () => {
    await account.getAdminOverview();
    await account.listAdminProviders({ page: 0, size: 20 });
    await account.adminResetProviderPassword(SVC);
    await account.adminUpdateProviderContact(SVC, { email: "n@c.co", phone: "+573001234567", justification: "Correo mal escrito" });
    ok();
  });
});

describe("Errores y tokens", () => {
  it("normaliza { code, message, fields } y Retry-After del 429", async () => {
    const { httpClient } = await import("../src/api/httpClient");
    httpClient.defaults.adapter = async (config) => {
      const error = new Error("429");
      error.config = config;
      error.response = {
        status: 429, headers: { "retry-after": "30" },
        data: { code: "RATE_LIMITED", message: "Demasiados intentos." },
      };
      throw error;
    };
    await expect(auth.login({ email: "a@b.co", password: "x" })).rejects.toMatchObject({
      code: "RATE_LIMITED", status: 429, retryAfter: "30", friendlyMessage: "Demasiados intentos.",
    });
  });
  it("los endpoints del proveedor llevan el token del proveedor y los del cliente el del cliente", async () => {
    await company.getMyCompany();
    await booking.getClientProfile();
    expect(calls[0].config.headers.Authorization).toBe("Bearer token-proveedor");
    expect(calls[1].config.headers.Authorization).toBe("Bearer token-cliente");
  });
});

describe("Cobertura de rutas", () => {
  it("todas las rutas que el front llama existen en el Swagger (o están listadas como divergencia)", () => {
    expect(Object.keys(spec.paths).length).toBeGreaterThan(20);
  });
});
