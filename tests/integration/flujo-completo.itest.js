import { beforeAll, describe, expect, it } from "vitest";
import { PROVIDER_TOKEN_KEY, httpClient } from "../../src/api/httpClient";
import * as auth from "../../src/api/authService";
import * as company from "../../src/api/companyService";
import * as catalog from "../../src/api/catalogService";
import * as schedule from "../../src/api/scheduleService";
import * as booking from "../../src/api/reservationService";
import { leerCodigo, mailpitDisponible } from "./mailpit";

// Datos únicos por corrida para poder repetir la prueba sin chocar con datos anteriores.
const run = Date.now();
const provider = {
  email: `proveedor.${run}@prueba.co`,
  password: "Clave1234*",
  document_type: "CC",
  document_number: String(run).slice(-10),
  first_name: "Prueba",
  last_name: "Integracion",
  phone: "3001234567",
};
const client = {
  documentType: "CC",
  documentNumber: String(run + 7).slice(-10),
  firstName: "Cliente",
  lastName: "Prueba",
  phone: "3009876543",
  email: `cliente.${run}@prueba.co`,
};

function enDias(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const ctx = {};

describe("Front ↔ Back (flujo completo, sin mocks)", () => {
  beforeAll(async () => {
    try {
      await httpClient.get("/comunas");
    } catch {
      throw new Error(
        `El back no responde en ${httpClient.defaults.baseURL}. ¿Hiciste "docker compose up -d" en la carpeta del back?`
      );
    }
    if (!(await mailpitDisponible())) {
      throw new Error("Mailpit no responde (http://localhost:8025). Sin él no se pueden leer los códigos OTP.");
    }
  });

  it("Épica 1: registro, verificación por correo y login del proveedor", async () => {
    await auth.registerProvider(provider);
    const code = await leerCodigo(provider.email, "Verifica tu correo");
    await auth.verifyEmail({ email: provider.email, otpCode: code });
    const { data } = await auth.login({ email: provider.email, password: provider.password });
    expect(data.token).toBeTruthy();
    localStorage.setItem(PROVIDER_TOKEN_KEY, data.token);
  });

  it("Negocio y servicio del proveedor (HU-003, HU-005)", async () => {
    const created = await company.createCompany({
      nit: `9${String(run).slice(-8)}`, name: `Negocio ${run}`, address: "Calle 10 # 20-30",
    });
    ctx.companyId = created.data.id;
    expect(ctx.companyId).toBeTruthy();

    const mine = await company.getMyCompany();
    expect(mine.data.id).toBe(ctx.companyId);

    const svc = await catalog.createService({
      company_id: ctx.companyId, name: `Servicio ${run}`, modality: "VIRTUAL", category: "SALUD",
      cost: 50000, duration_minutes: 60, capacity: 1,
    });
    ctx.serviceId = svc.data.id;
    expect(ctx.serviceId).toBeTruthy();

    const detail = await catalog.getServiceById(ctx.serviceId);
    expect(detail.data.name).toBe(`Servicio ${run}`);
    const list = await catalog.getServicesByCompany(ctx.companyId);
    expect(list.data.some((s) => s.id === ctx.serviceId)).toBe(true);
  });

  it("HU-013 y HU-014: vigencia y horarios de atención", async () => {
    await catalog.updateServiceRange(ctx.serviceId, { startDate: enDias(0), endDate: enDias(25) });
    const items = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ day_of_week: d, start_time: "08:00", end_time: "12:00" }));
    await schedule.saveSchedule(ctx.serviceId, items);
  });

  it("HU-018 a HU-020: disponibilidad por día y calendario mensual", async () => {
    ctx.date = enDias(3);
    const { data } = await schedule.getAvailability(ctx.serviceId, ctx.date);
    expect(data.length).toBe(4); // 08-12 con servicios de 60 min
    ctx.slot = data[0];
    expect(ctx.slot).toMatchObject({ startTime: "08:00", endTime: "09:00" });

    const hoy = new Date();
    const mes = await schedule.getMonthAvailability(
      { id: ctx.serviceId, startDate: enDias(0), endDate: enDias(25), isActive: true },
      hoy.getFullYear(), hoy.getMonth()
    );
    expect(mes).toBeTruthy();
  });

  it("HU-027/028: crea la reserva (queda PENDING y bloquea el horario)", async () => {
    const { data } = await booking.createReservation({
      service: { id: ctx.serviceId }, date: ctx.date,
      startTime: ctx.slot.startTime, endTime: ctx.slot.endTime, client,
    });
    ctx.reservationId = data.id;
    expect(data.status).toBe("PENDING");

    const { data: slots } = await schedule.getAvailability(ctx.serviceId, ctx.date);
    expect(slots.some((s) => s.startTime === "08:00")).toBe(false);
  });

  it("Un segundo cliente no puede tomar el mismo horario (SLOT_NOT_AVAILABLE, 409)", async () => {
    await expect(
      booking.createReservation({
        service: { id: ctx.serviceId }, date: ctx.date,
        startTime: ctx.slot.startTime, endTime: ctx.slot.endTime,
        client: { ...client, documentNumber: "99" + client.documentNumber.slice(2), email: `otro.${run}@prueba.co` },
      })
    ).rejects.toMatchObject({ status: 409, code: "SLOT_NOT_AVAILABLE" });
  });

  it("HU-029: código incorrecto se rechaza y el correcto confirma la reserva", async () => {
    await expect(booking.confirmReservation(ctx.reservationId, "000000")).rejects.toMatchObject({
      code: expect.stringMatching(/INVALID_OTP/),
    });
    const code = await leerCodigo(client.email, "Confirma tu reserva");
    const { data } = await booking.confirmReservation(ctx.reservationId, code);
    expect(data.status).toBe("CONFIRMED");
  });

  it("HU-025/026: sesión del cliente, reservas activas y cancelación", async () => {
    await booking.requestClientOtp(client);
    const code = await leerCodigo(client.email, "Tu código de acceso");
    await booking.openClientSession({ ...client, otpCode: code });

    const profile = await booking.getClientProfile();
    expect(profile.data.email).toBe(client.email);

    const activas = await booking.listActiveReservations(client.documentNumber);
    expect(activas.data.some((r) => r.id === ctx.reservationId)).toBe(true);

    const cancelada = await booking.cancelReservation(ctx.reservationId, "Prueba de integración");
    expect(cancelada.data.status).toBe("CANCELLED");

    const { data: slots } = await schedule.getAvailability(ctx.serviceId, ctx.date);
    expect(slots.some((s) => s.startTime === "08:00")).toBe(true);
    await booking.closeClientSession();
  });

  it("Errores con la forma del contrato: sin token responde 401 con { code, message }", async () => {
    localStorage.clear();
    await expect(company.getMyCompany()).rejects.toMatchObject({ status: 401, code: expect.any(String) });
  });
});
