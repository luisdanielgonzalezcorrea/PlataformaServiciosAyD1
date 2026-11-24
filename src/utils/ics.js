/** Genera un evento de calendario (.ics) para una reserva, sin pasar por el back. */
const pad = (n) => String(n).padStart(2, "0");
const esc = (t = "") => String(t).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const local = (date, time) => `${date.replaceAll("-", "")}T${time.slice(0, 5).replace(":", "")}00`;
const stamp = (d = new Date()) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

export function buildIcs({ uid, title, description, location, date, startTime, endTime, now }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//agenda.co//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}@agenda.co`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${local(date, startTime)}`,
    `DTEND:${local(date, endTime)}`,
    `SUMMARY:${esc(title)}`,
    description ? `DESCRIPTION:${esc(description)}` : null,
    location ? `LOCATION:${esc(location)}` : null,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n") + "\r\n";
}

export function downloadIcs(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
