import { httpClient, USE_MOCKS, wait, apiError } from "./httpClient";
import { getMyCompany } from "./companyService";
import { getServicesByCompany, getServiceById, updateServiceRange } from "./catalogService";
import { mockServices } from "../mocks/servicesMock";
import { reservations as mockReservations } from "../mocks/mockDb";
import { clearAvailabilityCache } from "./scheduleService";
import { readRegistry, writeRegistry, serviceToBody, expandDateRange } from "../utils/sprint3";
 
/** Solo mocks: servicios del negocio del proveedor, para que reservas y reportes no mezclen negocios ajenos. */
async function mockMine() {
  const { data: company } = await getMyCompany();
  const mine = mockServices.filter((s) => s.companyId === company.id);
  return { mine, ids: new Set(mine.map((s) => s.id)) };
}
 
/* ------------------------------------------------------------------------- */
/* HU-010 / HU-012 · Mis servicios                                            */
/* ------------------------------------------------------------------------- */
 
/**
 * GET /provider/services?companyId&page&size: servicios del proveedor autenticado, activos e inactivos.
 * (Si el back es una versión anterior y no tiene ese endpoint, se usa el método de respaldo.)
 */
export async function listMyServices() {
  const { data: company } = await getMyCompany();
  if (USE_MOCKS) {
    await wait(250);
    return { status: 200, data: mockServices.filter((s) => s.companyId === company.id).map((s) => ({ ...s })), company };
  }
  try {
    const all = [];
    for (let page = 0; page < 20; page++) {
      const { data } = await httpClient.get("/provider/services", { params: { companyId: company.id, page, size: 100 } });
      all.push(...(data.items || []));
      if (page + 1 >= (data.totalPages || 1)) break;
    }
    return { status: 200, data: all, company };
  } catch (err) {
    if (![404, 405].includes(err.status ?? err.response?.status)) throw err;
    return listMyServicesFallback(company);
  }
}

/** Respaldo para un back sin /provider/services: activos + ids guardados en este navegador. */
async function listMyServicesFallback(company) {
  const { data: active } = await getServicesByCompany(company.id);
  const known = readRegistry(company.id);
  const activeIds = new Set(active.map((s) => s.id));
  const missing = known.filter((id) => !activeIds.has(id));
  const found = await Promise.allSettled(missing.map((id) => getServiceById(id)));
  const inactive = found
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value.data)
    .filter((s) => s.companyId === company.id || !s.companyId);
  writeRegistry(company.id, [...active.map((s) => s.id), ...known]);
  return { status: 200, data: [...active, ...inactive], company };
}
 
/** HU-011 · PUT /services/{id} (campos editables) */
export async function updateService(id, form) {
  const body = serviceToBody(form);
  if (USE_MOCKS) {
    await wait(300);
    const s = mockServices.find((x) => x.id === id);
    if (!s) throw apiError("SERVICE_NOT_FOUND", "Servicio no encontrado.", 404);
    Object.assign(s, {
      name: body.name, modality: body.modality, cost: body.cost, durationMinutes: body.duration_minutes,
      capacity: body.capacity, description: body.description, recommendations: body.recommendations ?? null,
      comunaId: body.comuna_id ?? null, category: body.category ?? s.category,
    });
    return { status: 200, data: { ...s } };
  }
  const { data } = await httpClient.put(`/services/${id}`, body);
  clearAvailabilityCache(id);
  return { status: 200, data };
}
 
/** HU-012 · PATCH /services/{id}/status { is_active } */
export async function setServiceActive(id, isActive) {
  if (USE_MOCKS) {
    await wait(200);
    const s = mockServices.find((x) => x.id === id);
    if (!s) throw apiError("SERVICE_NOT_FOUND", "Servicio no encontrado.", 404);
    s.isActive = isActive;
    return { status: 200, data: { ...s } };
  }
  const { data } = await httpClient.patch(`/services/${id}/status`, { is_active: isActive });
  clearAvailabilityCache(id);
  return { status: 200, data };
}
 
/* ------------------------------------------------------------------------- */
/* HU-035 / HU-036 · Reservas del proveedor                                   */
/* ------------------------------------------------------------------------- */
 
/**
 * GET /provider/reservations?status&service_id&from_date&to_date&page&size
 * -> { items, page, size, totalElements, totalPages }. Orden cronológico (más próximas primero).
 */
export async function listProviderReservations({ status, serviceId, fromDate, toDate, page = 0, size = 20 } = {}) {
  if (USE_MOCKS) {
    await wait(250);
    const { ids } = await mockMine();
    let list = mockReservations.filter((r) => ids.has(r.serviceId)).map((r) => ({
      ...r, reservationCode: `RSV-${String(r.id).replace(/-/g, "").slice(0, 8).toUpperCase()}`,
    }));
    if (status) list = list.filter((r) => r.status === status);
    if (serviceId) list = list.filter((r) => r.serviceId === serviceId);
    if (fromDate) list = list.filter((r) => r.reservationDate >= fromDate);
    if (toDate) list = list.filter((r) => r.reservationDate <= toDate);
    list.sort((a, b) => `${a.reservationDate} ${a.startTime}`.localeCompare(`${b.reservationDate} ${b.startTime}`));
    const items = list.slice(page * size, (page + 1) * size);
    return { status: 200, data: { items, page, size, totalElements: list.length, totalPages: Math.max(1, Math.ceil(list.length / size)) } };
  }
  const params = { page, size, sort: "reservationDate,asc" };
  if (status) params.status = status;
  if (serviceId) params.service_id = serviceId;
  if (fromDate) params.from_date = fromDate;
  if (toDate) params.to_date = toDate;
  const { data } = await httpClient.get("/provider/reservations", { params });
  return { status: 200, data };
}
 
/* ------------------------------------------------------------------------- */
/* HU-038 / HU-039 · Reportes                                                 */
/* ------------------------------------------------------------------------- */
 
function reportParams({ serviceId, fromDate, toDate } = {}) {
  const p = {};
  if (serviceId) p.service_id = serviceId;
  if (fromDate) p.from_date = fromDate;
  if (toDate) p.to_date = toDate;
  return p;
}
 
/** GET /reports/reservations -> { total, byStatus: { CONFIRMED: n, ... } } */
export async function getReservationsReport(filters = {}) {
  if (USE_MOCKS) {
    await wait(250);
    const { ids } = await mockMine();
    const list = mockReservations.filter(
      (r) => ids.has(r.serviceId) && (!filters.serviceId || r.serviceId === filters.serviceId) &&
        (!filters.fromDate || r.reservationDate >= filters.fromDate) &&
        (!filters.toDate || r.reservationDate <= filters.toDate)
    );
    const byStatus = {};
    list.forEach((r) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    return { status: 200, data: { total: list.length, byStatus } };
  }
  const { data } = await httpClient.get("/reports/reservations", { params: reportParams(filters) });
  return { status: 200, data };
}
 
/** GET /reports/occupancy -> { services: [{serviceId,name,booked,capacity,occupancyPercent}], overallPercent } */
export async function getOccupancyReport(filters = {}) {
  if (USE_MOCKS) {
    await wait(250);
    const { mine } = await mockMine();
    const services = mine.filter((s) => s.isActive && (!filters.serviceId || s.id === filters.serviceId)).map((s) => {
      const booked = mockReservations.filter((r) => r.serviceId === s.id && r.status === "CONFIRMED").length;
      const capacity = Math.max(booked, 7);
      return { serviceId: s.id, name: s.name, booked, capacity, occupancyPercent: Math.round((booked / capacity) * 1000) / 10 };
    });
    const b = services.reduce((n, s) => n + s.booked, 0);
    const c = services.reduce((n, s) => n + s.capacity, 0);
    return { status: 200, data: { services, overallPercent: c ? Math.round((b / c) * 1000) / 10 : 0 } };
  }
  const { data } = await httpClient.get("/reports/occupancy", { params: reportParams(filters) });
  return { status: 200, data };
}
 
/** GET /reports/demand?order=DESC|ASC&limit -> [{serviceId, serviceName, reservations}] */
export async function getDemandReport({ order = "DESC", limit = 10, ...filters } = {}) {
  if (USE_MOCKS) {
    await wait(250);
    const { mine } = await mockMine();
    const rows = mine.filter((s) => !filters.serviceId || s.id === filters.serviceId).map((s) => ({
      serviceId: s.id, serviceName: s.name,
      reservations: mockReservations.filter((r) => r.serviceId === s.id && r.status !== "CANCELLED").length,
    }));
    rows.sort((a, b) => (order === "ASC" ? a.reservations - b.reservations : b.reservations - a.reservations));
    return { status: 200, data: rows.slice(0, limit) };
  }
  const { data } = await httpClient.get("/reports/demand", { params: { ...reportParams(filters), order, limit } });
  return { status: 200, data };
}
 
/* ------------------------------------------------------------------------- */
/* HU-017 · Bloqueo de fechas                                                 */
/* ------------------------------------------------------------------------- */
 
const mockBlocked = [];
let mockBlockedSeq = 1;
 
/**
 * POST /blocked-dates { company_id, service_id?, block_date, reason } — una fecha por llamada.
 * Para un rango se llama una vez por día. Devuelve { done: [fechas], failed: [{date, message}] }.
 */
export async function blockDates({ companyId, serviceId, from, to, reason }) {
  const dates = expandDateRange(from, to);
  const done = [];
  const failed = [];
  for (const date of dates) {
    try {
      if (USE_MOCKS) {
        await wait(60);
        mockBlocked.push({ id: `mb-${mockBlockedSeq++}`, companyId, serviceId: serviceId || null, blockDate: date, reason });
      } else {
        const body = { company_id: companyId, block_date: date, reason: reason || "Bloqueo del proveedor" };
        if (serviceId) body.service_id = serviceId;
        await httpClient.post("/blocked-dates", body);
      }
      done.push(date);
    } catch (err) {
      failed.push({ date, message: err.friendlyMessage || "No se pudo bloquear." });
    }
  }
  if (serviceId) clearAvailabilityCache(serviceId);
  return { done, failed };
}
 
/**
 * GET /blocked-dates?company_id&service_id&from_date&to_date -> [{ id, companyId, serviceId|null, blockDate, reason }]
 * Con service_id solo trae los bloqueos de ese servicio (no los de todo el negocio).
 */
export async function listBlockedDates({ companyId, serviceId, fromDate, toDate } = {}) {
  if (USE_MOCKS) {
    await wait(150);
    const list = mockBlocked.filter((b) => (!companyId || b.companyId === companyId)
      && (!serviceId || b.serviceId === serviceId) && (!fromDate || b.blockDate >= fromDate) && (!toDate || b.blockDate <= toDate));
    return { status: 200, data: [...list].sort((a, b) => a.blockDate.localeCompare(b.blockDate)) };
  }
  const params = {};
  if (companyId) params.company_id = companyId;
  if (serviceId) params.service_id = serviceId;
  if (fromDate) params.from_date = fromDate;
  if (toDate) params.to_date = toDate;
  const { data } = await httpClient.get("/blocked-dates", { params });
  return { status: 200, data };
}

/** DELETE /blocked-dates/{id}: quita un bloqueo y devuelve el que se quitó. */
export async function unblockDate(id, serviceId) {
  if (USE_MOCKS) {
    await wait(120);
    const i = mockBlocked.findIndex((b) => b.id === id);
    if (i < 0) throw apiError("BLOCKED_DATE_NOT_FOUND", "Ese bloqueo ya no existe.", 404);
    const [gone] = mockBlocked.splice(i, 1);
    if (serviceId) clearAvailabilityCache(serviceId);
    return { status: 200, data: gone };
  }
  const { data } = await httpClient.delete(`/blocked-dates/${id}`);
  if (serviceId) clearAvailabilityCache(serviceId);
  return { status: 200, data };
}

/**
 * HU-012 · Ejecuta el plan de `planDeactivation`:
 *  - now: PATCH /services/{id}/status { is_active: false }
 *  - block: bloquea las fechas del servicio (sigue activo, pero no se reserva en ese lapso)
 *  - until-further: cierra la vigencia el día anterior (PUT start_date/end_date)
 */
export async function deactivateService(service, plan, companyId) {
  if (plan.type === "now") {
    await setServiceActive(service.id, false);
    return { kind: "now" };
  }
  if (plan.type === "block") {
    const out = await blockDates({ companyId, serviceId: service.id, from: plan.from, to: plan.to, reason: "Servicio inactivo programado" });
    return { kind: "block", ...out };
  }
  await updateServiceRange(service.id, { startDate: service.startDate || "", endDate: plan.endDate });
  return { kind: "until-further", endDate: plan.endDate };
}