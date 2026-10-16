import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cancelReservation, listActiveReservations, reservationCode } from "../api/reservationService";
import { getServiceById } from "../api/catalogService";
import { formatLongDate, formatTime } from "../utils/dates";

const STATUS_TEXT = { CONFIRMED: "Confirmada", PENDING: "Pendiente de confirmar" };

/**
 * HU-026 · Consulta de reservas activas
 * Se vuelve a pedir al back cada vez que se monta, así siempre queda actualizada (criterio 4).
 */
export default function ActiveReservations({ documentNumber, onSessionExpired, compact = false }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await listActiveReservations(documentNumber);
      // ReservationView del back trae serviceName pero no el proveedor (HU-026 lo pide):
      // lo resolvemos con el detalle del servicio, una vez por servicio.
      const ids = [...new Set(data.map((r) => r.serviceId))];
      const found = await Promise.allSettled(ids.map((id) => getServiceById(id)));
      const names = {};
      found.forEach((res, i) => {
        if (res.status === "fulfilled") names[ids[i]] = res.value.data.companyName;
      });
      setItems(data.map((r) => ({ ...r, companyName: r.companyName || names[r.serviceId] })));
    } catch (err) {
      if (err.status === 401) {
        onSessionExpired?.();
        return;
      }
      setError(err.friendlyMessage || "No pudimos consultar tus reservas.");
    } finally {
      setLoading(false);
    }
  }, [documentNumber, onSessionExpired]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCancel(r) {
    setCancelling(true);
    setNotice(null);
    try {
      await cancelReservation(r.id, reason.trim());
      setNotice({ type: "success", text: "Cancelaste la reserva. El horario quedó libre otra vez." });
      setOpenId(null);
      setReason("");
      await load();
    } catch (err) {
      setNotice({ type: "error", text: err.friendlyMessage || "No se pudo cancelar la reserva." });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <h3>Mis reservas activas</h3>
        <button type="button" className="link-btn" onClick={load} disabled={loading}>Actualizar</button>
      </div>

      {notice && <div className={`alert alert--${notice.type === "error" ? "error" : "success"}`}>{notice.text}</div>}
      {loading && <p className="muted">Cargando tus reservas…</p>}
      {error && (
        <div className="alert alert--error">
          {error} <button type="button" className="link-btn" onClick={load}>Reintentar</button>
        </div>
      )}

      {!loading && !error && items?.length === 0 && (
        <p className="muted">No tienes reservas activas en este momento.</p>
      )}

      {!loading && !error && items?.length > 0 && (
        <ul className="res-list">
          {items.map((r) => {
            const open = openId === r.id;
            return (
              <li key={r.id} className={`res-item ${open ? "res-item--open" : ""}`}>
                <button
                  type="button"
                  className="res-item__summary"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : r.id)}
                >
                  <strong>{r.serviceName}</strong>
                  <span>
                    {formatLongDate(r.reservationDate)} · {formatTime(r.startTime)}
                  </span>
                  <span className="badge">{STATUS_TEXT[r.status] || r.status}</span>
                </button>

                {open && (
                  <div className="res-item__detail">
                    <dl className="summary">
                      <div><dt>Proveedor</dt><dd>{r.companyName || "—"}</dd></div>
                      <div><dt>Código</dt><dd>{reservationCode(r.id)}</dd></div>
                      <div><dt>Horario</dt><dd>{formatTime(r.startTime)} a {formatTime(r.endTime)}</dd></div>
                    </dl>
                    {!compact && (
                      <div className="res-item__actions">
                        <Link to={`/servicio/${r.serviceId}`} className="btn btn--ghost">Ver servicio</Link>
                      </div>
                    )}
                    <label className="field">
                      <span>Motivo de cancelación (opcional)</span>
                      <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
                    </label>
                    <button
                      type="button"
                      className="btn btn--danger"
                      disabled={cancelling}
                      onClick={() => {
                        if (window.confirm("¿Seguro que quieres cancelar esta reserva?")) handleCancel(r);
                      }}
                    >
                      {cancelling ? "Cancelando…" : "Cancelar reserva"}
                    </button>
                    <p className="muted small">Se puede cancelar hasta 2 horas antes de la cita.</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
