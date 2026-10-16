// "Base de datos" en memoria para simular el back en modo mock.
// Replica las reglas que vi en ScheduleService / ReservationService para que la
// UI se comporte igual con mocks que contra el back real.

import { mockServices } from "./servicesMock";
import {
  addDays, isoWeekday, minutesToTime, timeToMinutes, todayISO, slotStart,
  respectsMinNotice, withinMaxNotice,
} from "../utils/dates";
import { apiError } from "../api/httpClient";

export const OTP_DEMO = "123456";

// serviceId -> [{ id, dayOfWeek, startTime, endTime }]
export const schedules = new Map();
export const reservations = [];
export const clients = new Map(); // "CC:123" -> datos del cliente

let seq = 1;
export const nextId = () => (globalThis.crypto?.randomUUID?.() ?? `mock-${Date.now().toString(36)}-${seq++}`);

function seedSchedules() {
  const mk = (days, from, to) =>
    days.map((d) => ({ id: nextId(), dayOfWeek: d, startTime: from, endTime: to }));
  schedules.set(mockServices[0].id, [
    ...mk([1, 2, 3, 4, 5], "08:00", "12:00"),
    ...mk([1, 2, 3, 4, 5], "14:00", "17:00"),
  ]);
  schedules.set(mockServices[1].id, mk([2, 4], "09:00", "13:00"));
  // yoga: sin agenda, a propósito
  schedules.set(mockServices[3].id, mk([1, 3, 5], "09:00", "15:00"));
}

function nextDateWithWeekday(fromISO, weekdays) {
  let d = fromISO;
  for (let i = 0; i < 30; i++) {
    if (weekdays.includes(isoWeekday(d))) return d;
    d = addDays(d, 1);
  }
  return fromISO;
}

function seedReservations() {
  const client = {
    documentType: "CC", documentNumber: "1234567890", firstName: "Ana", lastName: "Gómez",
    phone: "3001234567", email: "cliente@demo.co",
  };
  clients.set("CC:1234567890", client);
  const svc = mockServices[0];

  // Un día completo (para que se vea "Agotado") y otro a medias ("Parcialmente ocupado")
  const full = nextDateWithWeekday(addDays(todayISO(), 3), [1, 2, 3, 4, 5]);
  const half = nextDateWithWeekday(addDays(full, 1), [1, 2, 3, 4, 5]);
  const fullSlots = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];
  fullSlots.forEach((t, i) =>
    reservations.push(buildReservation(svc, full, t, i === 0 ? client : { ...client, documentNumber: `99${i}` }, "CONFIRMED"))
  );
  reservations.push(buildReservation(svc, half, "09:00", client, "CONFIRMED"));
}

export function buildReservation(service, date, startTime, client, status = "PENDING") {
  return {
    id: nextId(),
    serviceId: service.id,
    serviceName: service.name,
    companyName: service.companyName,
    clientDocumentType: client.documentType,
    clientDocumentNumber: client.documentNumber,
    clientName: `${client.firstName} ${client.lastName}`,
    reservationDate: date,
    startTime,
    endTime: minutesToTime(timeToMinutes(startTime) + service.durationMinutes),
    status,
    cancelledBy: null,
    cancellationReason: null,
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
}

function isActive(r) {
  if (r.status === "CONFIRMED") return true;
  return r.status === "PENDING" && r.expiresAt > Date.now();
}

export function overlapping(serviceId, date, start, end) {
  return reservations.filter(
    (r) =>
      r.serviceId === serviceId &&
      r.reservationDate === date &&
      isActive(r) &&
      timeToMinutes(start) < timeToMinutes(r.endTime) &&
      timeToMinutes(end) > timeToMinutes(r.startTime)
  );
}

// Mismo cálculo que ScheduleService.computeSlots (incluidos los mismos errores).
export function mockSlots(service, date) {
  if (!service.isActive) throw apiError("SERVICE_INACTIVE", "El servicio no está activo.", 409);
  if (date < todayISO()) return [];
  if ((service.startDate && date < service.startDate) || (service.endDate && date > service.endDate)) {
    throw apiError("DATE_OUT_OF_RANGE", "La fecha está fuera del rango de vigencia del servicio.");
  }
  const day = isoWeekday(date);
  const todays = (schedules.get(service.id) || []).filter((s) => s.dayOfWeek === day);
  if (todays.length === 0) {
    throw apiError("SERVICE_WITHOUT_SCHEDULE", "El servicio no presta atención en la fecha seleccionada.");
  }
  const slots = [];
  const now = new Date();
  for (const s of todays) {
    const last = timeToMinutes(s.endTime) - service.durationMinutes;
    for (let c = timeToMinutes(s.startTime); c <= last; c += service.durationMinutes) {
      const start = minutesToTime(c);
      if (slotStart(date, start) < now) continue;
      const end = minutesToTime(c + service.durationMinutes);
      if (overlapping(service.id, date, start, end).length < service.capacity) {
        slots.push({ startTime: start, endTime: end });
      }
    }
  }
  return slots;
}

export function checkHorizon(date, startTime) {
  if (!respectsMinNotice(date, startTime)) {
    throw apiError("RESERVATION_TOO_SOON", "Debes reservar con al menos 24 horas de antelación.");
  }
  if (!withinMaxNotice(date)) {
    throw apiError("RESERVATION_TOO_FAR", "Solo puedes reservar con hasta 30 días de antelación.");
  }
}

seedSchedules();
seedReservations();
