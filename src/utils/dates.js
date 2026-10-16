// Utilidades de fecha. Todo se maneja como "YYYY-MM-DD" en hora local para
// no tener sorpresas con la zona horaria (toISOString() convierte a UTC).

export const MIN_NOTICE_HOURS = Number(import.meta.env.VITE_MIN_NOTICE_HOURS ?? 24);
export const MAX_NOTICE_DAYS = Number(import.meta.env.VITE_MAX_NOTICE_DAYS ?? 30);

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export const WEEK_DAYS = [
  { value: 1, label: "Lunes", short: "Lun" },
  { value: 2, label: "Martes", short: "Mar" },
  { value: 3, label: "Miércoles", short: "Mié" },
  { value: 4, label: "Jueves", short: "Jue" },
  { value: 5, label: "Viernes", short: "Vie" },
  { value: 6, label: "Sábado", short: "Sáb" },
  { value: 7, label: "Domingo", short: "Dom" },
];

const pad = (n) => String(n).padStart(2, "0");

export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseISODate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  return toISODate(new Date());
}

export function addDays(iso, n) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

// 1 = lunes ... 7 = domingo (igual que el back / java.time.DayOfWeek)
export function isoWeekday(iso) {
  const js = parseISODate(iso).getDay();
  return js === 0 ? 7 : js;
}

export function monthName(monthIndex) {
  return MONTHS[monthIndex];
}

export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function formatLongDate(iso) {
  const d = parseISODate(iso);
  return `${DAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
}

// "08:00" -> "8:00 a. m."
export function formatTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "p. m." : "a. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

export function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total) {
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

// Momento en el que empieza un horario, para compararlo con "ahora".
export function slotStart(iso, hhmm) {
  const [y, m, d] = iso.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, h, min);
}

// La regla de antelación mínima (24 h) la valida el back al reservar; la replicamos
// para no ofrecer horarios que sabemos que va a rechazar.
export function respectsMinNotice(iso, hhmm, now = new Date()) {
  const limit = new Date(now.getTime() + MIN_NOTICE_HOURS * 3600 * 1000);
  return slotStart(iso, hhmm) >= limit;
}

export function withinMaxNotice(iso, now = new Date()) {
  return parseISODate(iso) <= new Date(now.getTime() + MAX_NOTICE_DAYS * 86400 * 1000);
}
