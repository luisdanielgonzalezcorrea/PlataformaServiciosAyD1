import { useCallback, useEffect, useState } from "react";
import { listMyServices, listProviderReservations } from "../api/providerService";
import { formatLongDate, formatTime } from "../utils/dates";
import { STATUS_TEXT, displayStatus, validateReportRange } from "../utils/sprint3";

const BADGE = { PENDING: "badge--warn", CONFIRMED: "badge--ok", CANCELLED: "badge--off", COMPLETED: "badge--info" };
const POLL_MS = 60000;

/**
 * HU-035 · Reservas del proveedor (lista cronológica con filtros por rango y servicio).
 * HU-036 · Estado de cada reserva (Reservada, Cancelada, Finalizada) y filtro por estado.
 */
export default function ProviderReservationsPage() {
  const [filters, setFilters] = useState({ status: "", serviceId: "", fromDate: "", toDate: "" });
  const [services, setServices] = useState([]);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState(null);
  const [rangeError, setRangeError] = useState(null);

  useEffect(() => { listMyServices().then((r) => setServices(r.data)).catch(() => {}); }, []);

  const load = useCallback(async () => {
    const bad = validateReportRange(filters.fromDate, filters.toDate);
    setRangeError(bad);
    if (bad) return;
    setError(null);
    try {
      const { data: d } = await listProviderReservations({ ...filters, page });
      setData(d);
    } catch (err) {
      setError(err.friendlyMessage || "No pudimos cargar las reservas.");
    }
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);
  // Las cancelaciones y los cambios deben verse sin recargar a mano.
  useEffect(() => {
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const set = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(0); };

  return (
    <div className="page-wide">
      <div className="panel__head">
        <h1>Reservas de mis servicios</h1>
        <button type="button" className="link-btn" onClick={load}>Actualizar</button>
      </div>

      <div className="toolbar">
        <label className="field"><span>Servicio</span>
          <select value={filters.serviceId} onChange={(e) => set("serviceId", e.target.value)}>
            <option value="">Todos</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="field"><span>Estado</span>
          <select value={filters.status} onChange={(e) => set("status", e.target.value)}>
            <option value="">Todos</option>
            <option value="CONFIRMED">Reservada</option>
            <option value="PENDING">Pendiente de confirmar</option>
            <option value="COMPLETED">Finalizada</option>
            <option value="CANCELLED">Cancelada</option></select></label>
        <label className="field"><span>Desde</span><input type="date" value={filters.fromDate} onChange={(e) => set("fromDate", e.target.value)} /></label>
        <label className="field"><span>Hasta</span><input type="date" value={filters.toDate} onChange={(e) => set("toDate", e.target.value)} /></label>
      </div>

      {rangeError && <div className="alert alert--error">{rangeError}</div>}
      {error && <div className="alert alert--error">{error} <button type="button" className="link-btn" onClick={load}>Reintentar</button></div>}
      {!data && !error && !rangeError && <p className="state muted">Cargando reservas…</p>}

      {data && data.items.length === 0 && <div className="panel center"><p>No hay reservas para estos filtros.</p></div>}

      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Código</th><th>Servicio</th><th>Fecha y hora</th><th>Cliente</th><th>Estado</th></tr></thead>
              <tbody>
                {data.items.map((r) => {
                  const st = displayStatus(r);
                  return (
                    <tr key={r.id}>
                      <td>{r.reservationCode}</td>
                      <td>{r.serviceName}</td>
                      <td>{formatLongDate(r.reservationDate)}<br /><span className="muted small">{formatTime(r.startTime)} a {formatTime(r.endTime)}</span></td>
                      <td>{r.clientName}<br /><span className="muted small">{r.clientDocumentType} {r.clientDocumentNumber}</span></td>
                      <td>
                        <span className={`badge ${BADGE[st] || ""}`}>{STATUS_TEXT[st] || st}</span>
                        {st === "CANCELLED" && <span className="muted small"><br />{r.cancelledBy === "SYSTEM" ? "Por el sistema" : "Por el cliente"}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.totalPages > 1 && (
            <div className="actions actions--center">
              <button type="button" className="btn btn--ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button>
              <span className="muted small">Página {page + 1} de {data.totalPages}</span>
              <button type="button" className="btn btn--ghost" disabled={page >= data.totalPages - 1} onClick={() => setPage(page + 1)}>Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
