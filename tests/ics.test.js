import { describe, expect, it } from "vitest";
import { buildIcs } from "../src/utils/ics";

describe("Evento de calendario (.ics) de la reserva", () => {
  const ics = buildIcs({
    uid: "RSV-ABC123", title: "Consulta; psicología, 1ª vez", description: "Reserva RSV-ABC123\nNegocio Mente Clara",
    location: "Medellín", date: "2026-12-03", startTime: "09:30:00", endTime: "10:30",
    now: new Date("2026-11-23T12:00:00Z"),
  });
  it("tiene la estructura básica y fechas locales", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261203T093000");
    expect(ics).toContain("DTEND:20261203T103000");
    expect(ics).toContain("DTSTAMP:20261123T120000Z");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });
  it("escapa comas, punto y coma y saltos de línea", () => {
    expect(ics).toContain("SUMMARY:Consulta\; psicología\\, 1ª vez");
    expect(ics).toContain("DESCRIPTION:Reserva RSV-ABC123\\nNegocio Mente Clara");
  });
});
