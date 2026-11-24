import { httpClient, USE_MOCKS, wait, apiError } from "./httpClient";
import { clients, reservations } from "../mocks/mockDb";
import { mockServices } from "../mocks/servicesMock";
import { getClientSession, getClientProfile, clearClientSession } from "./reservationService";

/* ------------------------------------------------------------------------- */
/* HU-006 · Recuperar contraseña del proveedor                                */
/* ------------------------------------------------------------------------- */

const mockResetTokens = new Map(); // token -> email

/** POST /auth/forgot-password { email } — responde siempre el mismo mensaje (200). */
export async function forgotPassword(email) {
  if (USE_MOCKS) {
    await wait(400);
    mockResetTokens.set("demo-token", email);
    return { status: 200, data: { message: "Si la cuenta existe, enviaremos las instrucciones por correo." } };
  }
  const { data } = await httpClient.post("/auth/forgot-password", { email });
  return { status: 200, data };
}

/**
 * POST /auth/password/reset { token, new_password }
 * Errores: RESET_TOKEN_INVALID (enlace vencido, usado o inexistente), VALIDATION_ERROR, 429.
 */
export async function resetPassword(token, newPassword) {
  if (USE_MOCKS) {
    await wait(400);
    if (!mockResetTokens.has(token)) {
      throw apiError("RESET_TOKEN_INVALID", "El enlace de restablecimiento es inválido o ha expirado.");
    }
    const email = mockResetTokens.get(token);
    mockResetTokens.delete(token); // un solo uso
    return { status: 200, data: { email } };
  }
  const { data } = await httpClient.post("/auth/password/reset", { token, new_password: newPassword });
  return { status: 200, data };
}

/* ------------------------------------------------------------------------- */
/* HU-041 · Actualizar correo o teléfono de contacto del cliente              */
/* ------------------------------------------------------------------------- */

const mockContactCodes = new Map(); // clientKey -> { email, code }

export { getClientProfile };

/** POST /clients/me/contact/verification { new_email } — el OTP llega al correo NUEVO. */
export async function requestContactCode(newEmail) {
  if (USE_MOCKS) {
    await wait(400);
    const s = getClientSession();
    if (!s) throw apiError("AUTH_REQUIRED", "Tu sesión expiró.", 401);
    const me = clients.get(`${s.documentType}:${s.documentNumber}`);
    if (me.email.toLowerCase() === newEmail.toLowerCase()) throw apiError("EMAIL_UNCHANGED", "El correo indicado ya es el actual.");
    for (const c of clients.values()) {
      if (c.email.toLowerCase() === newEmail.toLowerCase()) throw apiError("EMAIL_TAKEN", "Ese correo ya está registrado.", 409);
    }
    mockContactCodes.set(`${s.documentType}:${s.documentNumber}`, { email: newEmail, code: "123456" });
    return { status: 200, data: { message: "Enviamos el código de confirmación al nuevo correo." } };
  }
  const { data } = await httpClient.post("/clients/me/contact/verification", { new_email: newEmail }, { clientAuth: true });
  return { status: 200, data };
}

/** PATCH /clients/me/contact { first_name, last_name, phone, email, verification_code? } */
export async function updateClientContact({ firstName, lastName, phone, email, verificationCode }) {
  if (USE_MOCKS) {
    await wait(400);
    const s = getClientSession();
    if (!s) throw apiError("AUTH_REQUIRED", "Tu sesión expiró.", 401);
    const key = `${s.documentType}:${s.documentNumber}`;
    const me = clients.get(key);
    if (email.toLowerCase() !== me.email.toLowerCase()) {
      if (!verificationCode) throw apiError("EMAIL_VERIFICATION_REQUIRED", "Debes confirmar el nuevo correo con el código enviado.");
      const pending = mockContactCodes.get(key);
      if (!pending || pending.email.toLowerCase() !== email.toLowerCase() || pending.code !== verificationCode) {
        throw apiError("INVALID_OTP", "El código es inválido o expiró.");
      }
      mockContactCodes.delete(key);
    }
    const updated = { ...me, firstName, lastName, phone, email };
    clients.set(key, updated);
    return { status: 200, data: updated };
  }
  const body = { first_name: firstName, last_name: lastName, phone, email };
  if (verificationCode) body.verification_code = verificationCode;
  const { data } = await httpClient.patch("/clients/me/contact", body, { clientAuth: true });
  return { status: 200, data };
}

/* ------------------------------------------------------------------------- */
/* HU-045 · Cambio de correo por pérdida (sin sesión)                         */
/* ------------------------------------------------------------------------- */
/**
 * PENDIENTE DE BACK: no existe endpoint. Contrato propuesto a AyD2 (ver PENDIENTES-BACK.md):
 *   POST /client/auth/email-recovery  { document_type, document_number, first_name, phone,
 *                                       reservation_code, new_email }
 *   -> 200 mensaje neutro; el OTP viaja al correo NUEVO.
 *   POST /client/auth/email-recovery/confirm { …mismos datos, otp_code } -> 200
 * Respuestas neutras para no revelar si el documento existe.
 */
export async function requestEmailRecovery(payload) {
  if (USE_MOCKS) {
    await wait(500);
    return { status: 200, data: { message: "Si los datos coinciden, enviaremos un código al correo nuevo." } };
  }
  const { data } = await httpClient.post("/client/auth/email-recovery", {
    document_type: payload.documentType,
    document_number: payload.documentNumber,
    first_name: payload.firstName,
    phone: payload.phone,
    reservation_code: payload.reservationCode,
    new_email: payload.newEmail,
  });
  return { status: 200, data };
}

export async function confirmEmailRecovery(payload) {
  if (USE_MOCKS) {
    await wait(500);
    if (payload.otpCode !== "123456") throw apiError("INVALID_OTP", "Código inválido o expirado.");
    clearClientSession(); // se cierran las sesiones anteriores
    return { status: 200, data: { message: "Correo actualizado." } };
  }
  const { data } = await httpClient.post("/client/auth/email-recovery/confirm", {
    document_type: payload.documentType,
    document_number: payload.documentNumber,
    first_name: payload.firstName,
    phone: payload.phone,
    reservation_code: payload.reservationCode,
    new_email: payload.newEmail,
    otp_code: payload.otpCode,
  });
  return { status: 200, data };
}

/* ------------------------------------------------------------------------- */
/* HU-042 / HU-043 / HU-044 · Administración                                  */
/* ------------------------------------------------------------------------- */

/** El login no informa el rol: probamos /admin/overview. 200 = admin, 403/401 = no lo es. */
export async function checkIsAdmin() {
  if (USE_MOCKS) return (() => { try { return localStorage.getItem("servas_mock_admin") === "1"; } catch { return false; } })();
  try {
    await httpClient.get("/admin/overview");
    return true;
  } catch {
    return false;
  }
}

/** GET /admin/overview -> { providers, companies, services, activeServices, clients, reservations:{total,pending,confirmed,cancelled,completed} } */
/** GET /admin/overview?period=DAY|WEEK|MONTH -> totales + series (reservas por periodo, listas para graficar). */
export async function getAdminOverview(period = "MONTH") {
  if (USE_MOCKS) {
    await wait(250);
    const by = (st) => reservations.filter((r) => r.status === st).length;
    const n = period === "DAY" ? 14 : period === "WEEK" ? 8 : 6;
    const today = new Date();
    const series = Array.from({ length: n }, (_, i) => {
      const d = new Date(today);
      if (period === "DAY") d.setDate(d.getDate() - (n - 1 - i));
      else if (period === "WEEK") d.setDate(d.getDate() - 7 * (n - 1 - i));
      else d.setMonth(d.getMonth() - (n - 1 - i), 1);
      const confirmed = (i * 3 + 2) % 7 + 1, pending = (i * 2) % 3, cancelled = i % 3 === 0 ? 1 : 0, completed = (i * 5) % 4;
      return { start: d.toISOString().slice(0, 10), total: confirmed + pending + cancelled + completed, pending, confirmed, cancelled, completed };
    });
    return {
      status: 200,
      data: {
        providers: 3, companies: 3, services: mockServices.length,
        activeServices: mockServices.filter((x) => x.isActive).length, clients: clients.size,
        reservations: { total: reservations.length, pending: by("PENDING"), confirmed: by("CONFIRMED"), cancelled: by("CANCELLED"), completed: by("COMPLETED") },
        period, series,
      },
    };
  }
  const { data } = await httpClient.get("/admin/overview", { params: { period } });
  return { status: 200, data };
}

const MOCK_PROVIDERS = [
  { id: "p-1", firstName: "Laura", lastName: "Mejía", email: "laura@menteclara.co", phone: "+573001112233", verified: true, companies: 1, nit: "900123456-1",
    businesses: [{ id: "c-1", name: "Mente Clara", nit: "900123456-1", address: "Cra 43A # 5-20" }], categories: ["Salud mental"], comunas: ["El Poblado"] },
  { id: "p-2", firstName: "Andrés", lastName: "Ruiz", email: "andres@estudionorte.co", phone: "+573004445566", verified: true, companies: 1, nit: "901234567-2",
    businesses: [{ id: "c-2", name: "Estudio Norte", nit: "901234567-2", address: "Cl 50 # 40-10" }], categories: ["Asesoría legal"], comunas: ["La Candelaria"] },
  { id: "p-3", firstName: "Sara", lastName: "Gil", email: "sara@casarespira.co", phone: "+573007778899", verified: false, companies: 0, nit: null, businesses: [], categories: [], comunas: [] },
];

/** GET /admin/providers?page&size -> PageView de { id, firstName, lastName, email, verified, companies } */
export async function listAdminProviders({ page = 0, size = 100 } = {}) {
  if (USE_MOCKS) {
    await wait(250);
    return { status: 200, data: { items: MOCK_PROVIDERS, page, size, totalElements: MOCK_PROVIDERS.length, totalPages: 1 } };
  }
  const { data } = await httpClient.get("/admin/providers", { params: { page, size } });
  return { status: 200, data };
}

/** GET /admin/providers/{id}: mismos campos del listado + documento y servicios (activos e inactivos). */
export async function getAdminProvider(id) {
  if (USE_MOCKS) {
    await wait(200);
    const p = MOCK_PROVIDERS.find((x) => x.id === id);
    if (!p) throw apiError("NOT_FOUND", "Proveedor no encontrado.", 404);
    const services = p.businesses.map((b, i) => ({
      id: `${b.id}-s1`, name: i === 0 ? "Servicio principal" : "Servicio", companyId: b.id, companyName: b.name, category: p.categories[0] || "General",
      modality: "PRESENCIAL", comunaName: p.comunas[0] || null, cost: 90000, durationMinutes: 60, capacity: 1, isActive: true,
    }));
    return { status: 200, data: { ...p, documentType: "CC", documentNumber: "1000000000", services } };
  }
  const { data } = await httpClient.get(`/admin/providers/${id}`);
  return { status: 200, data };
}

/**
 * HU-044 (endpoints ya disponibles en el back): no existen estos endpoints. Contrato propuesto:
 *   POST  /admin/providers/{id}/password-reset            -> 200 (envía enlace o clave temporal por correo)
 *   PATCH /admin/providers/{id}/contact { email?, phone?, justification } -> 200
 */
export async function adminResetProviderPassword(providerId) {
  if (USE_MOCKS) { await wait(300); return { status: 200, data: { message: "Enviamos el enlace de restablecimiento al proveedor." } }; }
  const { data } = await httpClient.post(`/admin/providers/${providerId}/password-reset`);
  return { status: 200, data };
}

export async function adminUpdateProviderContact(providerId, { email, phone, justification }) {
  if (USE_MOCKS) { await wait(300); return { status: 200, data: { email, phone } }; }
  const body = { justification };
  if (email) body.email = email;
  if (phone) body.phone = phone;
  const { data } = await httpClient.patch(`/admin/providers/${providerId}/contact`, body);
  return { status: 200, data };
}
