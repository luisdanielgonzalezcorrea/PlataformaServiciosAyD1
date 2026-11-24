/**
 * Gráfico de barras apiladas (SVG, sin librerías) de reservas por periodo.
 * series: [{ start: "YYYY-MM-DD", confirmed, pending, completed, cancelled, total }]
 */
const PARTS = [
  { key: "confirmed", label: "Confirmadas", color: "#5c1a33" },
  { key: "pending", label: "Pendientes", color: "#d1a94e" },
  { key: "completed", label: "Finalizadas", color: "#8a6420" },
  { key: "cancelled", label: "Canceladas", color: "#b9a99a" },
];

function label(start, period) {
  const d = new Date(`${start}T00:00:00`);
  if (period === "MONTH") return d.toLocaleDateString("es-CO", { month: "short" }).replace(".", "");
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" }).replace(".", "");
}

export default function ReservationsChart({ series = [], period = "MONTH" }) {
  const W = 640, H = 240, L = 34, R = 8, T = 10, B = 28;
  const max = Math.max(1, ...series.map((s) => s.total || 0));
  const top = Math.ceil(max / 4) * 4 || 4;
  const bw = series.length ? (W - L - R) / series.length : 0;
  const barW = Math.min(36, bw * 0.62);
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const ticks = [0, 1, 2, 3, 4].map((i) => Math.round((top / 4) * i));
  const step = series.length > 14 ? Math.ceil(series.length / 8) : 1;

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Reservas por periodo, apiladas por estado">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e2d6c0" strokeWidth="1" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6a5a60">{t}</text>
          </g>
        ))}
        {series.map((s, i) => {
          const x = L + bw * i + (bw - barW) / 2;
          let acc = 0;
          return (
            <g key={s.start}>
              <title>{`${label(s.start, period)}: ${s.total} reservas (${PARTS.map((p) => `${p.label.toLowerCase()} ${s[p.key] || 0}`).join(", ")})`}</title>
              {PARTS.map((p) => {
                const v = s[p.key] || 0;
                if (!v) return null;
                const y0 = y(acc), y1 = y(acc + v);
                acc += v;
                return <rect key={p.key} x={x} y={y1} width={barW} height={Math.max(1, y0 - y1)} fill={p.color} rx="2" />;
              })}
              {i % step === 0 && <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#6a5a60">{label(s.start, period)}</text>}
            </g>
          );
        })}
      </svg>
      <figcaption>
        <ul className="chart__legend">
          {PARTS.map((p) => <li key={p.key}><i style={{ background: p.color }} aria-hidden="true" />{p.label}</li>)}
        </ul>
      </figcaption>
    </figure>
  );
}
