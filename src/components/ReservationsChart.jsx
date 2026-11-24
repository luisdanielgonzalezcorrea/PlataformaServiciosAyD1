import { useEffect, useState } from "react";

/**
 * Barras simples: una barra por periodo con el total de reservas.
 * Eje con líneas guía, fechas en dos renglones (sin traslapes) y, al pasar el mouse,
 * enfocar o tocar una barra, el desglose por estado debajo.
 * series: [{ start: "YYYY-MM-DD", confirmed, pending, completed, cancelled, total }]
 */
const PARTS = [
  ["confirmed", "confirmadas"],
  ["pending", "pendientes"],
  ["completed", "finalizadas"],
  ["cancelled", "canceladas"],
];

const date = (iso) => new Date(`${iso}T00:00:00`);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mon = (d) => d.toLocaleDateString("es-CO", { month: "short" }).replace(".", "");
const monLong = (d) => d.toLocaleDateString("es-CO", { month: "long" });
const wd = (d) => d.toLocaleDateString("es-CO", { weekday: "short" }).replace(".", "");

/** Dos renglones para el eje: [arriba, abajo]. */
function tick(s, i, period) {
  const d = date(s.start);
  if (period === "MONTH") return [mon(d), String(d.getFullYear())];
  if (period === "WEEK") {
    const e = addDays(d, 6);
    const sameMonth = d.getMonth() === e.getMonth();
    return [`${d.getDate()}–${e.getDate()}`, sameMonth ? mon(d) : `${mon(d)}–${mon(e)}`];
  }
  return [String(d.getDate()), wd(d)];
}

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** Texto largo para el recuadro de detalle. */
function longLabel(s, period) {
  return cap(rawLabel(s, period));
}
function rawLabel(s, period) {
  const d = date(s.start);
  if (period === "MONTH") return `${monLong(d)} de ${d.getFullYear()}`;
  if (period === "WEEK") {
    const e = addDays(d, 6);
    return d.getMonth() === e.getMonth()
      ? `Semana del ${d.getDate()} al ${e.getDate()} de ${monLong(e)}`
      : `Semana del ${d.getDate()} de ${monLong(d)} al ${e.getDate()} de ${monLong(e)}`;
  }
  return d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
}

function niceTop(max) {
  const step = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : 10;
  const top = Math.ceil(max / step) * step;
  return { top, lines: Array.from({ length: top / step + 1 }, (_, i) => i * step) };
}

export default function ReservationsChart({ series = [], period = "MONTH" }) {
  const peakIndex = series.reduce((best, s, i) => ((s.total || 0) > (series[best]?.total || 0) ? i : best), 0);
  const [sel, setSel] = useState(peakIndex);
  useEffect(() => { setSel(peakIndex); }, [period, series.length, peakIndex]);

  if (!series.length) return <p className="muted">Todavía no hay reservas para mostrar en este periodo.</p>;

  const grandTotal = series.reduce((a, s) => a + (s.total || 0), 0);
  const max = Math.max(1, ...series.map((s) => s.total || 0));
  const { top, lines } = niceTop(max);
  const dense = series.length > 14;
  const cur = series[Math.min(sel, series.length - 1)];
  const unit = { DAY: "por día", WEEK: "por semana", MONTH: "por mes" }[period];

  return (
    <figure className="chart">
      <p className="chart__summary">
        <strong>{grandTotal}</strong> reservas en total · el pico es de <strong>{max}</strong> {unit}
      </p>
      <div className="chart__wrap">
        <div className="chart__grid" aria-hidden="true">
          {lines.map((v) => (
            <span key={v} className={v === 0 ? "is-zero" : ""} style={{ bottom: `${(v / top) * 100}%` }}><em>{v}</em></span>
          ))}
        </div>
        <div className={`chart__bars${dense ? " chart__bars--dense" : ""}`} role="list" aria-label={`Reservas ${unit}`}>
          {series.map((s, i) => {
            const total = s.total || 0;
            const [t1, t2] = tick(s, i, period);
            return (
              <button
                key={s.start}
                type="button"
                role="listitem"
                className={`chart__col${i === sel ? " is-on" : ""}${i === peakIndex ? " is-peak" : ""}`}
                onMouseEnter={() => setSel(i)}
                onFocus={() => setSel(i)}
                onClick={() => setSel(i)}
                aria-label={`${longLabel(s, period)}: ${total} reservas`}
              >
                <span className="chart__val">{!dense || i === sel ? total : ""}</span>
                <span className="chart__track"><span className="chart__bar" style={{ height: `${total ? Math.max(3, (total / top) * 100) : 0}%` }} /></span>
                <span className="chart__tick"><b>{t1}</b><small>{t2}</small></span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="chart__detail" aria-live="polite">
        <strong>{longLabel(cur, period)}</strong>: {cur.total || 0} reservas
        {(cur.total || 0) > 0 && <> — {PARTS.filter(([k]) => cur[k]).map(([k, t]) => `${cur[k]} ${t}`).join(", ")}</>}
      </p>
    </figure>
  );
}
