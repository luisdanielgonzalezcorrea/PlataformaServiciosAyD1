import { httpClient, USE_MOCKS, wait, apiError } from "./httpClient";
import { findMockServiceById } from "../mocks/servicesMock";
import { schedules, mockSlots, nextId } from "../mocks/mockDb";
import {
  addDays, daysInMonth, isoWeekday, respectsMinNotice, todayISO, withinMaxNotice,
} from "../utils/dates";

/**
 * Estados que pinta el calendario (HU-019).
 */
export const DAY_STATUS = {
  AVAILABLE: "AVAILABLE", // Disponible
  PARTIAL: "PARTIAL", // Parcialmente ocupado
  FULL: "FULL", // Agotado
  DISABLED: "DISABLED", // No habilitado
};

/**
 * HU-014 · Definir días y horarios de atención
 * PUT /services/{id}/schedules   (reemplaza toda la agenda)
 * body: [{ day_of_week: 1..7, start_time: "HH:mm", end_time: "HH:mm" }]
 *
 * OJO: el back no tiene un GET de horarios configurados, por eso la pantalla del
 * proveedor parte de lo que guardó en esta sesión. Ver README (pendientes para AyD2).
 */
export async function saveSchedule(serviceId, items) {
  if (USE_MOCKS) {
    await wait(300);
    schedules.set(
      serviceId,
      items.map((i) => ({
        id: nextId(),
        dayOfWeek: i.day_of_week,
        startTime: i.start_time,
        endTime: i.end_time,
      }))
    );
    return { status: 200, data: schedules.get(serviceId) };
  }

  const { data } = await httpClient.put(`/services/${serviceId}/schedules`, items);
  // El back no tiene GET de horarios: guardamos una copia en este navegador para poder
  // volver a mostrarla en "Mi agenda" (ver loadSchedule).
  rememberSchedule(serviceId, items.map((i) => ({
    dayOfWeek: i.day_of_week, startTime: i.start_time, endTime: i.end_time,
  })));
  return { status: 200, data };
}

const SCHEDULE_KEY = (id) => `servas_schedule_${id}`;

function rememberSchedule(serviceId, list) {
  try {
    localStorage.setItem(SCHEDULE_KEY(serviceId), JSON.stringify(list));
  } catch {
    /* sin almacenamiento: la pantalla simplemente no precarga */
  }
}

function recallSchedule(serviceId) {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY(serviceId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Horarios ya configurados de un servicio, para precargar "Mi agenda".
 * Primero intenta GET /services/{id}/schedules (lo que pedimos a AyD2 en PENDIENTES-BACK.md).
 * Mientras el back no lo tenga (404/405), usa la copia que este navegador guardó al configurar.
 * Devuelve { items, source }: "server" | "local" | "none".
 */
export async function loadSchedule(serviceId, service) {
  if (USE_MOCKS) return { items: schedules.get(serviceId) || [], source: "server" };
  try {
    const { data } = await httpClient.get(`/services/${serviceId}/schedules`);
    if (Array.isArray(data)) return { items: data, source: "server" };
  } catch (err) {
    if (![404, 405].includes(err?.status)) throw err;
  }
  const local = recallSchedule(serviceId);
  if (local) return { items: local, source: "local" };
  const inferred = service ? await inferSchedule(service) : [];
  return inferred.length ? { items: inferred, source: "inferred" } : { items: [], source: "none" };
}

/**
 * Reconstruye los días y horarios ya configurados a partir de lo que el back ofrece al cliente
 * (GET /services/{id}/availability), porque no hay un GET de horarios. Mira hasta 4 semanas por
 * día de la semana, dentro de la vigencia, y junta las franjas que encuentra. Es una
 * aproximación: una franja reservada o bloqueada en todas esas fechas no aparece.
 */
export async function inferSchedule(service) {
  const dates = [];
  const perWeekday = {};
  for (let n = 1; n <= 28; n++) {
    const iso = addDays(todayISO(), n);
    if (service.startDate && iso < service.startDate) continue;
    if (service.endDate && iso > service.endDate) continue;
    const wd = isoWeekday(iso);
    perWeekday[wd] = (perWeekday[wd] || 0) + 1;
    if (perWeekday[wd] <= 4) dates.push(iso);
  }

  const slotsByDay = {};
  await inBatches(dates, 6, async (iso) => {
    try {
      const { data } = await httpClient.get(`/services/${service.id}/availability`, { params: { date: iso } });
      const wd = isoWeekday(iso);
      (slotsByDay[wd] ||= new Map());
      (data || []).forEach((sl) => {
        const start = String(sl.startTime).slice(0, 5);
        slotsByDay[wd].set(start, String(sl.endTime).slice(0, 5));
      });
    } catch {
      /* día sin horario, fuera de vigencia o inactivo: no aporta franjas */
    }
  });

  const items = [];
  for (const [wd, map] of Object.entries(slotsByDay)) {
    const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    let current = null;
    for (const [start, end] of sorted) {
      if (current && current.endTime === start) current.endTime = end;
      else {
        if (current) items.push(current);
        current = { dayOfWeek: Number(wd), startTime: start, endTime: end };
      }
    }
    if (current) items.push(current);
  }
  return items;
}

/**
 * Solo para mocks: devuelve lo configurado, así la pantalla del proveedor puede precargarlo.
 * Con el back real devuelve null (no hay endpoint de lectura).
 */
export function getLocalSchedule(serviceId) {
  if (!USE_MOCKS) return null;
  return schedules.get(serviceId) || [];
}

/**
 * HU-020 · Horarios disponibles de una fecha
 * GET /services/{id}/availability?date=YYYY-MM-DD  ->  [{ startTime, endTime }]
 *
 * Errores relevantes del back (400): SERVICE_WITHOUT_SCHEDULE (el servicio no presta ese día),
 * DATE_OUT_OF_RANGE (fuera de la vigencia). Una lista vacía significa agotado/bloqueado.
 */
export async function getAvailability(serviceId, date) {
  if (USE_MOCKS) {
    await wait(150);
    const svc = findMockServiceById(serviceId);
    if (!svc) throw apiError("SERVICE_NOT_FOUND", "Servicio no encontrado.", 404);
    return { status: 200, data: mockSlots(svc, date) };
  }

  const { data } = await httpClient.get(`/services/${serviceId}/availability`, { params: { date } });
  return { status: 200, data };
}

/* ------------------------------------------------------------------------- */
/* Calendario mensual (HU-018 / HU-019)                                       */
/* ------------------------------------------------------------------------- */

// El back no expone disponibilidad por mes, solo por día. Para pintar el calendario
// consultamos cada día del mes (máximo ~30 llamadas, con caché) y clasificamos acá.
const cache = new Map(); // `${serviceId}|${date}` -> { status, slots, rawCount }

export function clearAvailabilityCache(serviceId) {
  for (const key of cache.keys()) {
    if (!serviceId || key.startsWith(`${serviceId}|`)) cache.delete(key);
  }
}

async function fetchDay(service, date) {
  const key = `${service.id}|${date}`;
  if (cache.has(key)) return cache.get(key);

  let result;
  try {
    const { data } = await getAvailability(service.id, date);
    const reservable = data.filter((s) => respectsMinNotice(date, s.startTime));
    result = { rawCount: data.length, slots: reservable, status: null };
    if (data.length > 0 && reservable.length === 0) {
      // Hay horarios pero todos caen dentro de las 24 h mínimas de antelación.
      result.status = DAY_STATUS.DISABLED;
    } else if (reservable.length === 0) {
      result.status = DAY_STATUS.FULL;
    }
  } catch (err) {
    if (["SERVICE_WITHOUT_SCHEDULE", "DATE_OUT_OF_RANGE", "SERVICE_INACTIVE"].includes(err?.code)) {
      result = { rawCount: 0, slots: [], status: DAY_STATUS.DISABLED };
    } else {
      throw err;
    }
  }
  cache.set(key, result);
  return result;
}

// Ejecuta las promesas de a pocas para no disparar 30 requests de golpe.
async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

/**
 * Devuelve el estado de cada día del mes: { "2026-11-03": { status, slots } , ... }
 *
 * Disponible vs. parcialmente ocupado: el back no dice cuántos cupos tenía el día en total,
 * así que comparamos contra el día con más horarios libres de ese mismo día de la semana
 * dentro del mes. Es una aproximación (si todas las semanas están igual de ocupadas no lo
 * detecta). Con un endpoint mensual del back esto desaparece.
 */
export async function getMonthAvailability(service, year, monthIndex) {
  const total = daysInMonth(year, monthIndex);
  const today = todayISO();
  const days = [];
  for (let d = 1; d <= total; d++) {
    const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push(iso);
  }

  const queryable = days.filter(
    (iso) =>
      iso >= today &&
      withinMaxNotice(iso) &&
      (!service.startDate || iso >= service.startDate) &&
      (!service.endDate || iso <= service.endDate)
  );

  const fetched = await inBatches(queryable, 6, (iso) => fetchDay(service, iso));
  const byDate = {};
  queryable.forEach((iso, i) => (byDate[iso] = fetched[i]));

  const maxByWeekday = {};
  for (const iso of queryable) {
    const wd = isoWeekday(iso);
    const { slots, status } = byDate[iso];
    if (!status) maxByWeekday[wd] = Math.max(maxByWeekday[wd] || 0, byDate[iso].rawCount, slots.length);
  }

  const result = {};
  for (const iso of days) {
    const info = byDate[iso];
    if (!info) {
      result[iso] = { status: DAY_STATUS.DISABLED, slots: [] };
      continue;
    }
    let status = info.status;
    if (!status) {
      status =
        info.slots.length < (maxByWeekday[isoWeekday(iso)] || 0)
          ? DAY_STATUS.PARTIAL
          : DAY_STATUS.AVAILABLE;
    }
    result[iso] = { status, slots: info.slots };
  }
  return result;
}


/**
 * HU-020 · Horarios de un día concreto (siempre consulta al back, sin caché, para no
 * ofrecer un horario que otro cliente acaba de tomar).
 * reason: "NO_SERVICE" (no se presta ese día) | "EMPTY" (sin horarios) | null
 */
export async function getDaySlots(service, date) {
  cache.delete(`${service.id}|${date}`);
  const info = await fetchDay(service, date);
  if (info.slots.length === 0) {
    const noService = info.rawCount === 0 && info.status === DAY_STATUS.DISABLED;
    return { slots: [], reason: noService ? "NO_SERVICE" : "EMPTY" };
  }
  return { slots: info.slots, reason: null };
}
