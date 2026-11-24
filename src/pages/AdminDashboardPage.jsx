import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminOverview } from "../api/accountService";
import ReservationsChart from "../components/ReservationsChart";

/**
 * HU-042 · Panel de administración con métricas globales.
 * Totales + serie de reservas por día, semana o mes (GET /admin/overview?period=).
 */
const PERIODS = [["DAY", "Diario"], ["WEEK", "Semanal"], ["MONTH", "Mensual"]];

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("MONTH");
  const [loadingSeries, setLoadingSeries] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoadingSeries(true);
    getAdminOverview(period)
      .then((r) => { if (alive) { setData(r.data); setError(null); } })
      .catch((e) => { if (alive) setError(e.friendlyMessage || "No pudimos cargar el panel."); })
      .finally(() => { if (alive) setLoadingSeries(false); });
    return () => { alive = false; };
  }, [period]);

  if (error) return <div className="narrow"><div className="alert alert--error">{error}</div></div>;
  if (!data) return <p className="state muted">Cargando panel…</p>;

  const res = data.reservations || {};
  const cards = [
    { label: "Proveedores", value: data.providers, to: "/admin/proveedores" },
    { label: "Negocios", value: data.companies },
    { label: "Servicios publicados", value: data.activeServices, sub: `de ${data.services} en total` },
    { label: "Clientes", value: data.clients },
    { label: "Reservas totales", value: res.total },
  ];
  const bars = [["Confirmadas", res.confirmed], ["Pendientes", res.pending], ["Finalizadas", res.completed], ["Canceladas", res.cancelled]];
  const max = Math.max(1, ...bars.map(([, v]) => v || 0));

  return (
    <div className="page-wide">
      <h1>Panel de administración</h1>
      <div className="stat-grid">
        {cards.map((c) => {
          const body = (<><strong>{c.value ?? 0}</strong><span>{c.label}</span>{c.sub && <small className="muted">{c.sub}</small>}</>);
          return c.to ? <Link key={c.label} to={c.to} className="stat-card">{body}</Link> : <div key={c.label} className="stat-card">{body}</div>;
        })}
      </div>
      <section className="panel" aria-labelledby="adm-trend">
        <div className="panel__head">
          <h3 id="adm-trend">Reservas por periodo</h3>
          <div className="seg" role="group" aria-label="Periodo">
            {PERIODS.map(([v, t]) => (
              <button key={v} type="button" className={`seg__opt${period === v ? " seg__opt--on" : ""}`} aria-pressed={period === v} onClick={() => setPeriod(v)}>{t}</button>
            ))}
          </div>
        </div>
        {loadingSeries && !data.series ? <p className="muted">Cargando…</p> : <ReservationsChart series={data.series || []} period={period} />}
      </section>
      <section className="panel">
        <h3>Reservas por estado</h3>
        <ul className="bars">
          {bars.map(([label, v]) => (
            <li key={label}><span>{label}</span><div className="meter"><span style={{ width: `${((v || 0) / max) * 100}%` }} /></div><strong>{v || 0}</strong></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
