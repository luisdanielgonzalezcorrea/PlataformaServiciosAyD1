import { useEffect, useState } from "react";

/**
 * Barras simples: una barra por periodo con el total de reservas.
 * Al pasar el mouse, enfocar o tocar una barra se ve el desglose por estado debajo.
 * series: [{ start: "YYYY-MM-DD", confirmed, pending, completed, cancelled, total }]
 */
const PARTS = [
  ["confirmed", "confirmadas"],
  ["pending", "pendientes"],
  ["completed", "finalizadas"],
  ["cancelled", "canceladas"],
];

function label(start, period, long = false) {
  const d = new Date(`${start}T00:00:00`);
  if (period === "MONTH") {
    return d.toLocaleDateString("es-CO", long ? { month: "long", year: "numeric" } : { month: "short" }).replace(".", "");
  }
  const text = d.toLocaleDateString("es-CO", { day: "numeric", month: "short" }).replace(".", "");
  return period === "WEEK" && long ? `Semana del ${text}` : text;
}

export default function ReservationsChart({ series = [], period = "MONTH" }) {
  const peakIndex = series.reduce((best, s, i) => ((s.total || 0) > (series[best]?.total || 0) ? i : best), 0);
  const [sel, setSel] = useState(peakIndex);
  useEffect(() => { setSel(peakIndex); }, [period, series.length, peakIndex]);

  if (!series.length) return <p className="muted">Todavía no hay reservas para mostrar en este periodo.</p>;

  const grandTotal = series.reduce((a, s) => a + (s.total || 0), 0);
  const max = Math.max(1, ...series.map((s) => s.total || 0));
  const dense = series.length > 14;
  const labelEvery = dense ? Math.ceil(series.length / 7) : 1;
  const cur = series[Math.min(sel, series.length - 1)];
  const unit = { DAY: "por día", WEEK: "por semana", MONTH: "por mes" }[period];

  return (
    <figure className="chart">
      <p className="chart__summary">
        <strong>{grandTotal}</strong> reservas en total · el pico es de <strong>{max}</strong> {unit}
      </p>
      <div className={`chart__bars${dense ? " chart__bars--dense" : ""}`} role="list" aria-label={`Reservas ${unit}`}>
        {series.map((s, i) => {
          const total = s.total || 0;
          return (
            <button
              key={s.start}
              type="button"
              role="listitem"
              className={`chart__col${i === sel ? " is-on" : ""}${i === peakIndex ? " is-peak" : ""}`}
              onMouseEnter={() => setSel(i)}
              onFocus={() => setSel(i)}
              onClick={() => setSel(i)}
              aria-label={`${label(s.start, period, true)}: ${total} reservas`}
            >
              <span className="chart__val">{!dense || i === sel ? total : ""}</span>
              <span className="chart__track"><span className="chart__bar" style={{ height: `${total ? Math.max(4, (total / max) * 100) : 2}%` }} /></span>
              <span className="chart__tick">{i % labelEvery === 0 || i === sel ? label(s.start, period) : ""}</span>
            </button>
          );
        })}
      </div>
      <p className="chart__detail" aria-live="polite">
        <strong>{label(cur.start, period, true)}</strong>: {cur.total || 0} reservas
        {(cur.total || 0) > 0 && <> — {PARTS.filter(([k]) => cur[k]).map(([k, t]) => `${cur[k]} ${t}`).join(", ")}</>}
      </p>
    </figure>
  );
}
