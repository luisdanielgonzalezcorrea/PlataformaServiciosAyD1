import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminOverview } from "../api/accountService";

/**
 * HU-042 · Panel de administración con métricas globales.
 * El back entrega totales (no series por día/semana/mes): las tendencias quedan pendientes (PENDIENTES-BACK.md).
 */
export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { getAdminOverview().then((r) => setData(r.data)).catch((e) => setError(e.friendlyMessage || "No pudimos cargar el panel.")); }, []);

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
