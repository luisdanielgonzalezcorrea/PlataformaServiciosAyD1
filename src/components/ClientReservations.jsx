import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listAllReservations } from "../api/reservationService";
import { getServiceById } from "../api/catalogService";
import { formatLongDate, formatTime } from "../utils/dates";
import { STATUS_TEXT, filterReservations, splitReservations } from "../utils/sprint3";

const BADGE = { PENDING: "badge--warn", CONFIRMED: "badge--ok", CANCELLED: "badge--off", COMPLETED: "badge--info" };

/**
 * HU-030 · Consultar las reservas del cliente por su documento (la sesión se abre con el OTP).
 * HU-031 · Listado separado en activas e historial, con filtros por estado, fechas y código.
 */
export default function ClientReservations({ documentNumber, onSessionExpired }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("active");
  const [filters, setFilters] = useState({ status: "ALL", from: "", to: "", code: "" });
  const [places, setPlaces] = useState({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await listAllReservations(documentNumber);
      setItems(data);
      const ids = [...new Set(data.map((r) => r.serviceId))];
      const found = await Promise.allSettled(ids.map((id) => getServiceById(id)));
      const map = {};
      found.forEach((res, i) => {
        if (res.status === "fulfilled") map[ids[i]] = res.value.data.comunaName || (res.value.data.modality === "VIRTUAL" ? "Virtual" : "");
      });
      setPlaces(map);
    } catch (err) {
      if (err.status === 401) return onSessionExpired?.();
      setItems([]);
      setError(err.friendlyMessage || "No pudimos consultar tus reservas.");
    }
  }, [documentNumber, onSessionExpired]);

  useEffect(() => { load(); }, [load]);

  const { active, history } = useMemo(() => splitReservations(items), [items]);
  const base = tab === "active" ? active : history;
  const shown = filterReservations(base, filters);
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <section className="panel">
      <div className="panel__head">
        <h3>Mis reservas</h3>
        <button type="button" className="link-btn" onClick={load}>Actualizar</button>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "active"} className={tab === "active" ? "tab tab--on" : "tab"} onClick={() => setTab("active")}>Activas ({active.length})</button>
        <button role="tab" aria-selected={tab === "history"} className={tab === "history" ? "tab tab--on" : "tab"} onClick={() => setTab("history")}>Historial ({history.length})</button>
      </div>

      <div className="toolbar">
        <label className="field"><span>Código</span><input value={filters.code} onChange={(e) => set("code", e.target.value)} placeholder="RSV-…" /></label>
        <label className="field"><span>Estado</span>
          <select value={filters.status} onChange={(e) => set("status", e.target.value)}>
            <option value="ALL">Todos</option>
            {tab === "active" ? (<><option value="CONFIRMED">Reservada</option><option value="PENDING">Pendiente</option></>)
              : (<><option value="COMPLETED">Finalizada</option><option value="CANCELLED">Cancelada</option><option value="CONFIRMED">Reservada (ya pasó)</option></>)}
          </select></label>
        <label className="field"><span>Desde</span><input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} /></label>
        <label className="field"><span>Hasta</span><input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} /></label>
      </div>

      {error && <div className="alert alert--error">{error} <button type="button" className="link-btn" onClick={load}>Reintentar</button></div>}
      {items === null && <p className="muted">Cargando tus reservas…</p>}
      {items && !error && items.length === 0 && <p className="muted">No encontramos reservas para este documento.</p>}
      {items?.length > 0 && shown.length === 0 && <p className="muted">{tab === "active" ? "No tienes reservas activas con estos filtros." : "No hay reservas en tu historial con estos filtros."}</p>}

      {shown.length > 0 && (
        <ul className="res-list">
          {shown.map((r) => (
            <li key={r.id} className="res-item">
              <Link to={`/mis-reservas/${r.id}`} className="res-item__summary">
                <strong>{r.serviceName}</strong>
                <span>{r.reservationCode}{places[r.serviceId] ? ` · ${places[r.serviceId]}` : ""}</span>
                <span>{formatLongDate(r.reservationDate)} · {formatTime(r.startTime)}</span>
                <span className={`badge ${BADGE[r.status] || ""}`}>{STATUS_TEXT[r.status] || r.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
