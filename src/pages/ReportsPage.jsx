import { Fragment, useCallback, useEffect, useState } from "react";
import { getDemandReport, getOccupancyReport, getReservationsReport, listMyServices } from "../api/providerService";
import { STATUS_TEXT, classifyOccupancy, pct, validateReportRange } from "../utils/sprint3";

/**
 * HU-038 · Reporte de reservas (por rango de fechas y servicio, con detalle por estado).
 * HU-039 · Reporte de ocupación (porcentaje, espacios libres, sin ocupación y completos) + demanda.
 */
const DAYS = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 7: "Domingo" };

export default function ReportsPage() {
  const [filters, setFilters] = useState({ serviceId: "", fromDate: "", toDate: "" });
  const [services, setServices] = useState([]);
  const [reservations, setReservations] = useState(null);
  const [occupancy, setOccupancy] = useState(null);
  const [openSlots, setOpenSlots] = useState(null);
  const [demand, setDemand] = useState(null);
  const [error, setError] = useState(null);
  const [rangeError, setRangeError] = useState(null);

  useEffect(() => { listMyServices().then((r) => setServices(r.data)).catch(() => {}); }, []);

  const load = useCallback(async () => {
    const bad = validateReportRange(filters.fromDate, filters.toDate);
    setRangeError(bad);
    if (bad) return;
    setError(null);
    try {
      const [a, b, c] = await Promise.all([
        getReservationsReport(filters), getOccupancyReport(filters), getDemandReport({ ...filters, order: "DESC", limit: 5 }),
      ]);
      setReservations(a.data); setOccupancy(b.data); setDemand(c.data);
    } catch (err) {
      setError(err.friendlyMessage || "No pudimos generar el reporte.");
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const occ = occupancy ? classifyOccupancy(occupancy.services) : null;

  return (
    <div className="page-wide">
      <h1>Reportes</h1>
      <div className="toolbar">
        <label className="field"><span>Servicio</span>
          <select value={filters.serviceId} onChange={(e) => set("serviceId", e.target.value)}>
            <option value="">Todos</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="field"><span>Desde</span><input type="date" value={filters.fromDate} onChange={(e) => set("fromDate", e.target.value)} /></label>
        <label className="field"><span>Hasta</span><input type="date" value={filters.toDate} onChange={(e) => set("toDate", e.target.value)} /></label>
      </div>
      {rangeError && <div className="alert alert--error">{rangeError}</div>}
      {error && <div className="alert alert--error">{error} <button type="button" className="link-btn" onClick={load}>Reintentar</button></div>}

      {reservations && (
        <section className="panel" aria-labelledby="rep-res">
          <h3 id="rep-res">Reservas realizadas</h3>
          {reservations.total === 0 ? (
            <p className="muted">No encontramos reservas con estos filtros.</p>
          ) : (
            <>
              <p><strong>{reservations.total}</strong> reservas en total</p>
              <ul className="stat-list">
                {Object.entries(reservations.byStatus || {}).map(([k, v]) => (
                  <li key={k}><span>{STATUS_TEXT[k] || k}</span><strong>{v}</strong></li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {occ && (
        <section className="panel" aria-labelledby="rep-occ">
          <h3 id="rep-occ">Ocupación</h3>
          {occ.rows.length === 0 ? (
            <p className="muted">No hay información de ocupación para estos filtros.</p>
          ) : (
            <>
              <p>Ocupación general: <strong>{pct(occupancy.overallPercent)}</strong></p>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Servicio</th><th>Reservados</th><th>Libres</th><th>Capacidad</th><th>Ocupación</th></tr></thead>
                  <tbody>
                    {occ.rows.map((r) => (
                      <Fragment key={r.serviceId}>
                      <tr>
                        <td>{r.name}{r.slots?.length > 0 && (
                          <button type="button" className="link-btn" style={{ marginLeft: 8 }} onClick={() => setOpenSlots((o) => (o === r.serviceId ? null : r.serviceId))} aria-expanded={openSlots === r.serviceId}>
                            {openSlots === r.serviceId ? "Ocultar horarios" : "Ver horarios"}
                          </button>
                        )}</td><td>{r.booked}</td><td>{r.free}</td><td>{r.capacity}</td>
                        <td>
                          <div className="meter" role="img" aria-label={`${pct(r.occupancyPercent)} de ocupación`}>
                            <span style={{ width: `${Math.min(100, r.occupancyPercent)}%` }} />
                          </div>
                          {pct(r.occupancyPercent)}
                          {r.level === "FULL" && <span className="badge badge--off"> Completo</span>}
                          {r.level === "EMPTY" && <span className="badge"> Sin ocupación</span>}
                        </td>
                      </tr>
                      {openSlots === r.serviceId && (
                        <tr className="row-detail"><td colSpan={5}>
                          <table className="table table--inner">
                            <thead><tr><th>Día</th><th>Franja</th><th>Cupo</th><th>Ocupados</th><th>Disponibles</th><th>Ocupación</th></tr></thead>
                            <tbody>
                              {r.slots.map((sl) => (
                                <tr key={`${sl.dayOfWeek}-${sl.startTime}`}>
                                  <td>{DAYS[sl.dayOfWeek]}</td><td>{sl.startTime} – {sl.endTime}</td><td>{sl.capacity}</td><td>{sl.booked}</td><td>{sl.available}</td>
                                  <td>{pct(sl.capacity ? (sl.booked / sl.capacity) * 100 : 0)}{sl.booked === 0 && <span className="badge"> Sin ocupación</span>}{sl.capacity > 0 && sl.booked >= sl.capacity && <span className="badge badge--off"> Completo</span>}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td></tr>
                      )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted small">
                Sin ocupación (0 %): {occ.empty.length} · Completamente ocupados (100 %): {occ.full.length} · Con espacios libres: {occ.partial.length + occ.empty.length}
              </p>
            </>
          )}
        </section>
      )}

      {demand && (
        <section className="panel" aria-labelledby="rep-dem">
          <h3 id="rep-dem">Servicios más solicitados</h3>
          {demand.length === 0 ? <p className="muted">Sin información de demanda.</p> : (
            <ol className="stat-list">
              {demand.map((d) => <li key={d.serviceId}><span>{d.serviceName}</span><strong>{d.reservations}</strong></li>)}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
