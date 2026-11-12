// Lógica pura del Sprint 3 (sin red ni React) para poder probarla fácil.
import { addDays, todayISO } from "./dates";

/* ---------- HU-010 · Listado de mis servicios ---------- */
export const SERVICE_PAGE_SIZE = 8;

export function filterServices(list, { status = "ALL", search = "" } = {}) {
  const q = search.trim().toLowerCase();
  return (list || []).filter((s) => {
    if (status === "ACTIVE" && !s.isActive) return false;
    if (status === "INACTIVE" && s.isActive) return false;
    return !q || String(s.name || "").toLowerCase().includes(q);
  });
}

export function paginate(list, page, size = SERVICE_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(list.length / size));
  const current = Math.min(Math.max(0, page), totalPages - 1);
  return { items: list.slice(current * size, (current + 1) * size), page: current, totalPages };
}

/* ---------- HU-012 · Registro local de servicios conocidos ----------
   GET /services solo trae los activos. Guardamos los ids que el proveedor ya vio para poder
   seguir mostrando (y reactivar) los que desactive. Pendiente AyD2: endpoint con inactivos. */
const REGISTRY_KEY = (companyId) => `servas_my_services_${companyId}`;

export function readRegistry(companyId) {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY(companyId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeRegistry(companyId, ids) {
  try {
    localStorage.setItem(REGISTRY_KEY(companyId), JSON.stringify([...new Set(ids)]));
  } catch {
    /* sin almacenamiento: solo se verán los activos */
  }
}

/* ---------- HU-011 · Validación del formulario de edición ---------- */
export function validateServiceForm(f) {
  const e = {};
  if (!String(f.name || "").trim()) e.name = "Escribe el nombre del servicio.";
  else if (f.name.length > 100) e.name = "El nombre admite máximo 100 caracteres.";
  const cost = Number(f.cost);
  if (f.cost === "" || f.cost === null || Number.isNaN(cost) || cost < 0) e.cost = "Ingresa un costo válido (0 o más).";
  if (!String(f.description || "").trim()) e.description = "Escribe una descripción.";
  if (!f.modality) e.modality = "Selecciona la modalidad.";
  if (f.modality === "PRESENCIAL" && !f.comunaId) e.comunaId = "Selecciona la comuna.";
  const dur = Number(f.durationMinutes);
  if (!Number.isInteger(dur) || dur < 1 || dur > 480) e.durationMinutes = "La duración va de 1 a 480 minutos.";
  const cap = Number(f.capacity);
  if (!Number.isInteger(cap) || cap < 1 || cap > 100) e.capacity = "La capacidad va de 1 a 100.";
  return e;
}

export function serviceToBody(f) {
  const body = {
    name: f.name.trim(),
    modality: f.modality,
    category: f.category || undefined,
    cost: Number(f.cost),
    duration_minutes: Number(f.durationMinutes),
    capacity: Number(f.capacity),
    description: f.description.trim(),
    recommendations: (f.recommendations || "").trim() || undefined,
  };
  if (f.modality === "PRESENCIAL") body.comuna_id = Number(f.comunaId);
  return body;
}

/* ---------- HU-017 · Bloqueo de fechas ---------- */
export const MAX_BLOCK_DAYS = 31;

export function expandDateRange(from, to) {
  if (!from) return [];
  const end = to || from;
  if (end < from) return [];
  const out = [];
  for (let d = from; d <= end && out.length <= MAX_BLOCK_DAYS; d = addDays(d, 1)) out.push(d);
  return out;
}

export function validateBlockRange(from, to) {
  if (!from) return "Elige la fecha o la fecha de inicio.";
  if (from < todayISO()) return "No puedes bloquear fechas pasadas.";
  if (to && to < from) return "La fecha final no puede ser anterior a la inicial.";
  if (expandDateRange(from, to).length > MAX_BLOCK_DAYS) return `Puedes bloquear máximo ${MAX_BLOCK_DAYS} días por vez.`;
  return null;
}

/** Reservas activas que caen en las fechas a bloquear (aviso de conflicto, criterio 3). */
export function conflictsFor(reservations, dates) {
  const set = new Set(dates);
  return (reservations || []).filter(
    (r) => set.has(r.reservationDate) && (r.status === "PENDING" || r.status === "CONFIRMED")
  );
}

/* ---------- HU-031 / HU-030 · Reservas del cliente ---------- */
const ACTIVE = ["PENDING", "CONFIRMED"];

export function splitReservations(list, today = todayISO()) {
  const active = [];
  const history = [];
  (list || []).forEach((r) => {
    (ACTIVE.includes(r.status) && r.reservationDate >= today ? active : history).push(r);
  });
  const asc = (a, b) => `${a.reservationDate} ${a.startTime}`.localeCompare(`${b.reservationDate} ${b.startTime}`);
  return { active: active.sort(asc), history: history.sort((a, b) => asc(b, a)) };
}

export function filterReservations(list, { status = "ALL", from = "", to = "", code = "" } = {}) {
  const c = code.trim().toUpperCase();
  return (list || []).filter((r) => {
    if (status !== "ALL" && r.status !== status) return false;
    if (from && r.reservationDate < from) return false;
    if (to && r.reservationDate > to) return false;
    if (c && !String(r.reservationCode || "").toUpperCase().includes(c)) return false;
    return true;
  });
}

export const STATUS_TEXT = {
  PENDING: "Pendiente de confirmar",
  CONFIRMED: "Reservada",
  CANCELLED: "Cancelada",
  COMPLETED: "Finalizada",
};

/** HU-036 · Una reserva confirmada cuyo horario ya pasó se muestra como Finalizada. */
export function displayStatus(r, now = new Date()) {
  if (r.status === "CONFIRMED") {
    const end = new Date(`${r.reservationDate}T${r.endTime || r.startTime}:00`);
    if (end < now) return "COMPLETED";
  }
  return r.status;
}

/** HU-033 · El back deja modificar solo reservas activas; el front lo anticipa. */
export const canManage = (r) => ACTIVE.includes(r.status) && r.reservationDate >= todayISO();

/* ---------- HU-038 / HU-039 · Reportes ---------- */
export function validateReportRange(from, to) {
  if (from && to && to < from) return "La fecha final no puede ser anterior a la inicial.";
  return null;
}

export function classifyOccupancy(services) {
  const rows = (services || []).map((s) => ({
    ...s,
    free: Math.max(0, (s.capacity || 0) - (s.booked || 0)),
    level: !s.booked ? "EMPTY" : s.occupancyPercent >= 100 ? "FULL" : "PARTIAL",
  }));
  return {
    rows,
    empty: rows.filter((r) => r.level === "EMPTY"),
    full: rows.filter((r) => r.level === "FULL"),
    partial: rows.filter((r) => r.level === "PARTIAL"),
  };
}

export const pct = (n) => `${Math.round((Number(n) || 0) * 10) / 10} %`;

/* ---------- HU-006 / HU-045 · Contraseña ---------- */
export function validateNewPassword(password, confirm) {
  if (!password || password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (password.length > 72) return "La contraseña admite máximo 72 caracteres.";
  if (password !== confirm) return "Las contraseñas no coinciden.";
  return null;
}

/* ---------- Calendario de selección (HU-017) ---------- */

/** Celdas de un mes con semana de lunes a domingo; `null` son los huecos antes del día 1. */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const total = new Date(year, month + 1, 0).getDate();
  const pad = (n) => String(n).padStart(2, "0");
  const cells = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= total; d++) cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  return cells;
}

/** Un clic elige un día; un segundo clic cierra el rango; un tercero empieza de nuevo. */
export function nextRangeClick({ from, to }, iso) {
  if (!from || (from && to)) return { from: iso, to: null };
  if (iso === from) return { from, to: null };
  return iso < from ? { from: iso, to: from } : { from, to: iso };
}

export const inRange = (iso, from, to) => Boolean(from) && iso >= from && iso <= (to || from);

/* ---------- HU-012 · Desactivar ahora o programado ---------- */
/**
 * mode "now": se desactiva de inmediato.
 * mode "later": desde `from`, hasta `to` (opcional).
 *  - con `to`: se bloquean esas fechas (máx. 31 días); el servicio sigue activo.
 *  - sin `to`: se cierra la vigencia del servicio el día anterior a `from`.
 */
export function planDeactivation({ mode, from, to, startDate }) {
  if (mode !== "later") return { plan: { type: "now" } };
  if (!from) return { error: "Elige desde qué fecha se desactiva." };
  if (from <= todayISO()) return { error: "La fecha de inicio debe ser posterior a hoy. Para hoy usa “Desactivar ahora”." };
  if (to) {
    if (to < from) return { error: "La fecha final no puede ser anterior a la inicial." };
    const dates = expandDateRange(from, to);
    if (dates.length > MAX_BLOCK_DAYS) return { error: `Con fecha de regreso puedes programar máximo ${MAX_BLOCK_DAYS} días. Para más tiempo, deja “hasta” vacío o desactívalo ahora.` };
    return { plan: { type: "block", dates, from, to } };
  }
  const endDate = addDays(from, -1);
  if (startDate && endDate < startDate) return { error: "Esa fecha es anterior al inicio de la vigencia del servicio." };
  return { plan: { type: "until-further", endDate, from } };
}
