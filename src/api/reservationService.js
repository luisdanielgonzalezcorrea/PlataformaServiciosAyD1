import { httpClient, USE_MOCKS, wait, apiError, CLIENT_TOKEN_KEY } from "./httpClient";
import { findMockServiceById } from "../mocks/servicesMock";
import {
  OTP_DEMO, clients, reservations, overlapping, buildReservation, checkHorizon, mockSlots,
} from "../mocks/mockDb";
import { clearAvailabilityCache } from "./scheduleService";
import { todayISO } from "../utils/dates";

/* ------------------------------------------------------------------------- */
/* Sesión corta del cliente (se guarda en sessionStorage, dura 30 min)       */
/* ------------------------------------------------------------------------- */

const CLIENT_SESSION_KEY = "servas_client_session";

export function getClientSession() {
  try {
    const raw = sessionStorage.getItem(CLIENT_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session.expiresAt && session.expiresAt < Date.now()) {
      clearClientSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function saveClientSession({ token, expiresInMinutes }, identity) {
  const session = {
    ...identity,
    expiresAt: Date.now() + (expiresInMinutes || 30) * 60 * 1000,
  };
  try {
    sessionStorage.setItem(CLIENT_TOKEN_KEY, token);
    sessionStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* sin storage la sesión solo vive mientras no se recargue */
  }
  return session;
}

export function clearClientSession() {
  try {
    sessionStorage.removeItem(CLIENT_TOKEN_KEY);
    sessionStorage.removeItem(CLIENT_SESSION_KEY);
  } catch {
    /* nada */
  }
}

const mockSessions = new Set();

/* ------------------------------------------------------------------------- */
/* HU-025 · Validar documento (OTP al correo + sesión del cliente)           */
/* ------------------------------------------------------------------------- */

/**
 * POST /client/auth/otp  { document_type, document_number, email }
 * Siempre responde 200 con un mensaje neutro (no revela si el documento existe).
 */
export async function requestClientOtp({ documentType, documentNumber, email }) {
  if (USE_MOCKS) {
    await wait(500);
    return {
      status: 200,
      data: { message: "Si el cliente existe, enviaremos las instrucciones por correo." },
    };
  }
  const { data } = await httpClient.post("/client/auth/otp", {
    document_type: documentType,
    document_number: documentNumber,
    email,
  });
  return { status: 200, data };
}

/**
 * POST /client/auth/session  { document_type, document_number, email, otp_code }
 * -> { token, expiresInMinutes }. Guarda la sesión y devuelve la identidad.
 */
export async function openClientSession({ documentType, documentNumber, email, otpCode }) {
  let payload;
  if (USE_MOCKS) {
    await wait(500);
    const known = clients.get(`${documentType}:${documentNumber}`);
    if (!known || known.email.toLowerCase() !== email.toLowerCase() || otpCode !== OTP_DEMO) {
      throw apiError("INVALID_OTP", "Código inválido o expirado.");
    }
    const token = `mock-client-${documentNumber}`;
    mockSessions.add(token);
    payload = { token, expiresInMinutes: 30 };
  } else {
    const { data } = await httpClient.post("/client/auth/session", {
      document_type: documentType,
      document_number: documentNumber,
      email,
      otp_code: otpCode,
    });
    payload = data;
  }
  const session = saveClientSession(payload, { documentType, documentNumber, email });
  return { status: 200, data: session };
}

export async function closeClientSession() {
  try {
    if (!USE_MOCKS) await httpClient.post("/client/auth/logout", null, { clientAuth: true });
  } finally {
    clearClientSession();
  }
}

/**
 * GET /clients/me  (sesión del cliente) -> datos para autocompletar el formulario
 */
export async function getClientProfile() {
  if (USE_MOCKS) {
    await wait(250);
    const session = getClientSession();
    const found = session && clients.get(`${session.documentType}:${session.documentNumber}`);
    if (!found) throw apiError("AUTH_REQUIRED", "Tu sesión expiró.", 401);
    return { status: 200, data: { ...found } };
  }
  const { data } = await httpClient.get("/clients/me", { clientAuth: true });
  return { status: 200, data };
}

/* ------------------------------------------------------------------------- */
/* HU-026 · Reservas activas                                                  */
/* ------------------------------------------------------------------------- */

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"];

/**
 * GET /reservations/client/{documentNumber}?size=  (sesión del cliente)
 * Devuelve solo las activas (pendientes o confirmadas) que aún no pasaron.
 */
export async function listActiveReservations(documentNumber) {
  let items;
  if (USE_MOCKS) {
    await wait(350);
    const session = getClientSession();
    if (!session) throw apiError("AUTH_REQUIRED", "Tu sesión expiró.", 401);
    items = reservations.filter(
      (r) =>
        r.clientDocumentNumber === documentNumber &&
        (r.status === "CONFIRMED" || (r.status === "PENDING" && r.expiresAt > Date.now()))
    );
  } else {
    const { data } = await httpClient.get(`/reservations/client/${encodeURIComponent(documentNumber)}`, {
      params: { size: 100, sort: "reservationDate,asc" },
      clientAuth: true,
    });
    items = data.items || [];
  }
  const today = todayISO();
  return {
    status: 200,
    data: items
      .filter((r) => ACTIVE_STATUSES.includes(r.status) && r.reservationDate >= today)
      .sort((a, b) =>
        `${a.reservationDate} ${a.startTime}`.localeCompare(`${b.reservationDate} ${b.startTime}`)
      ),
  };
}

/**
 * PATCH /reservations/{id}/cancel  { cancellation_reason }  (sesión del cliente)
 * El back rechaza con CANCELLATION_TOO_LATE si faltan menos de 2 h.
 */
export async function cancelReservation(id, reason) {
  if (USE_MOCKS) {
    await wait(400);
    const r = reservations.find((x) => x.id === id);
    if (!r) throw apiError("RESERVATION_NOT_FOUND", "Reserva no encontrada.", 404);
    const start = new Date(`${r.reservationDate}T${r.startTime}:00`);
    if (start.getTime() - Date.now() < 2 * 3600 * 1000) {
      throw apiError("CANCELLATION_TOO_LATE", "Solo puedes cancelar con al menos 2 horas de antelación.");
    }
    r.status = "CANCELLED";
    r.cancelledBy = "CLIENT";
    r.cancellationReason = reason || null;
    clearAvailabilityCache(r.serviceId);
    return { status: 200, data: { ...r } };
  }
  const { data } = await httpClient.patch(
    `/reservations/${id}/cancel`,
    { cancellation_reason: reason || null },
    { clientAuth: true }
  );
  clearAvailabilityCache(data.serviceId);
  return { status: 200, data };
}

/* ------------------------------------------------------------------------- */
/* HU-027 / HU-028 · Registrar y confirmar la reserva                         */
/* ------------------------------------------------------------------------- */

/**
 * POST /reservations
 * body: { service_id, reservation_date, start_time, end_time, client: {...snake_case} }
 * Crea la reserva en PENDING (bloquea el horario 15 min) y el back manda un código al
 * correo del cliente. Errores a tratar: SLOT_NOT_AVAILABLE (409), RESERVATION_TOO_SOON,
 * RESERVATION_TOO_FAR, OUTSIDE_ATTENTION_HOURS, DATE_BLOCKED, SERVICE_INACTIVE.
 */
export async function createReservation({ service, date, startTime, endTime, client }) {
  if (USE_MOCKS) {
    await wait(700);
    const svc = findMockServiceById(service.id);
    if (!svc) throw apiError("SERVICE_NOT_FOUND", "Servicio no encontrado.", 404);
    checkHorizon(date, startTime);
    const free = mockSlots(svc, date).some((s) => s.startTime === startTime);
    if (!free || overlapping(svc.id, date, startTime, endTime).length >= svc.capacity) {
      clearAvailabilityCache(svc.id);
      throw apiError("SLOT_NOT_AVAILABLE", "El horario seleccionado ya no está disponible.", 409);
    }
    const created = buildReservation(
      svc,
      date,
      startTime,
      {
        documentType: client.documentType,
        documentNumber: client.documentNumber,
        firstName: client.firstName,
        lastName: client.lastName,
      },
      "PENDING"
    );
    reservations.push(created);
    clients.set(`${client.documentType}:${client.documentNumber}`, { ...client });
    clearAvailabilityCache(svc.id);
    return { status: 201, data: { ...created } };
  }

  const { data } = await httpClient.post("/reservations", {
    service_id: service.id,
    reservation_date: date,
    start_time: startTime,
    end_time: endTime,
    client: {
      document_type: client.documentType,
      document_number: client.documentNumber,
      first_name: client.firstName,
      last_name: client.lastName,
      phone: client.phone,
      email: client.email,
    },
  });
  clearAvailabilityCache(service.id);
  return { status: 201, data };
}

/**
 * POST /reservations/{id}/confirm  { otp_code }   (público)
 * Errores: INVALID_OTP, OTP_ATTEMPTS_EXCEEDED, RESERVATION_NOT_ACTIVE (se venció la ventana de 15 min).
 */
export async function confirmReservation(id, otpCode) {
  if (USE_MOCKS) {
    await wait(600);
    const r = reservations.find((x) => x.id === id);
    if (!r) throw apiError("RESERVATION_NOT_FOUND", "Reserva no encontrada.", 404);
    if (r.status !== "PENDING" || r.expiresAt < Date.now()) {
      throw apiError("RESERVATION_NOT_ACTIVE", "La reserva expiró o ya no está activa.");
    }
    if (otpCode !== OTP_DEMO) {
      r.attempts = (r.attempts || 0) + 1;
      if (r.attempts >= 5) {
        throw apiError("OTP_ATTEMPTS_EXCEEDED", "Superaste el número de intentos. Inicia la reserva de nuevo.", 429);
      }
      throw apiError("INVALID_OTP", "El código es inválido o ya expiró.");
    }
    r.status = "CONFIRMED";
    clearAvailabilityCache(r.serviceId);
    return { status: 200, data: { ...r } };
  }

  const { data } = await httpClient.post(`/reservations/${id}/confirm`, { otp_code: otpCode });
  clearAvailabilityCache(data.serviceId);
  return { status: 200, data };
}

/**
 * Código corto que le mostramos al cliente (HU-029). El back no tiene un campo "code"
 * aparte: usamos los primeros 8 caracteres del id (UUID) en mayúscula.
 */
export function reservationCode(id) {
  return `RSV-${String(id).replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
