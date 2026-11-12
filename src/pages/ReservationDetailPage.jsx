import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { cancelReservation, clearClientSession, getClientSession, getReservation, modifyReservation } from "../api/reservationService";
import { getServiceById } from "../api/catalogService";
import AvailabilityPicker from "../components/AvailabilityPicker";
import ClientVerification from "../components/ClientVerification";
import { formatLongDate, formatTime } from "../utils/dates";
import { STATUS_TEXT, canManage } from "../utils/sprint3";

const money = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(n) || 0);
const ERRORS = {
  CANCELLATION_TOO_LATE: "Ya no es posible cancelar: faltan menos de 2 horas para la cita.",
  RESERVATION_NOT_ACTIVE: "Esta reserva ya no admite cambios.",
  SLOT_NOT_AVAILABLE: "Ese horario ya no está disponible. Elige otro.",
  RESERVATION_TOO_SOON: "Solo puedes mover la cita con al menos 24 horas de antelación.",
  DATE_BLOCKED: "El proveedor no atiende en esa fecha.",
};

/**
 * HU-032 · Detalle de la reserva (código, servicio, proveedor, lugar, fecha, hora, costo, contacto).
 * HU-033 · Modificar fecha y hora eligiendo de la agenda.
 * HU-034 · Cancelar con confirmación (el back rechaza si faltan menos de 2 h).
 */
export default function ReservationDetailPage() {
  const { id } = useParams();
  const [session, setSession] = useState(() => getClientSession());
  const [reservation, setReservation] = useState(null);
  const [service, setService] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [mode, setMode] = useState("view"); // view | modify | cancel
  const [slot, setSlot] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await getReservation(id);
      setReservation(data);
      getServiceById(data.serviceId).then((r) => setService(r.data)).catch(() => {});
    } catch (err) {
      if (err.status === 401) { clearClientSession(); setSession(null); return; }
      setError(err.status === 404 ? "No encontramos una reserva con ese código." : err.friendlyMessage || "No pudimos cargar la reserva.");
    }
  }, [id]);

  useEffect(() => { if (session) load(); }, [session, load]);

  async function doModify() {
    if (!slot?.startTime) return;
    setBusy(true); setNotice(null);
    try {
      const { data } = await modifyReservation(id, { date: slot.date, startTime: slot.startTime, endTime: slot.endTime });
      setReservation(data); setMode("view"); setSlot(null);
      setNotice({ type: "success", text: "Cambiaste tu reserva. El horario anterior quedó libre y te enviamos la confirmación por correo." });
    } catch (err) {
      setNotice({ type: "error", text: ERRORS[err.code] || err.friendlyMessage || "No se pudo modificar la reserva." });
    } finally { setBusy(false); }
  }

  async function doCancel() {
    setBusy(true); setNotice(null);
    try {
      const { data } = await cancelReservation(id, reason.trim());
      setReservation((r) => ({ ...r, ...data })); setMode("view");
      setNotice({ type: "success", text: "Cancelaste la reserva. El horario quedó libre y te enviamos un correo de confirmación." });
    } catch (err) {
      setNotice({ type: "error", text: ERRORS[err.code] || err.friendlyMessage || "No se pudo cancelar la reserva." });
    } finally { setBusy(false); }
  }

  if (!session) {
    return (
      <div className="narrow">
        <h1>Detalle de la reserva</h1>
        <p className="muted">Valida tu documento para ver esta reserva.</p>
        <ClientVerification onVerified={setSession} />
      </div>
    );
  }
  if (error) return <div className="narrow"><div className="alert alert--error">{error}</div><Link to="/mis-reservas">Volver a mis reservas</Link></div>;
  if (!reservation) return <p className="state muted">Cargando reserva…</p>;

  const r = reservation;
  return (
    <div className="narrow">
      <p><Link to="/mis-reservas">← Mis reservas</Link></p>
      <h1>Reserva {r.reservationCode}</h1>
      {notice && <div className={`alert alert--${notice.type === "error" ? "error" : "success"}`}>{notice.text}</div>}

      <section className="panel">
        <span className="badge">{STATUS_TEXT[r.status] || r.status}</span>
        <dl className="summary">
          <div><dt>Servicio</dt><dd>{r.serviceName}</dd></div>
          <div><dt>Proveedor</dt><dd>{service?.companyName || "—"}</dd></div>
          <div><dt>Lugar</dt><dd>{service ? (service.modality === "VIRTUAL" ? "Virtual" : service.comunaName || "Presencial") : "—"}</dd></div>
          <div><dt>Fecha</dt><dd>{formatLongDate(r.reservationDate)}</dd></div>
          <div><dt>Hora</dt><dd>{formatTime(r.startTime)} a {formatTime(r.endTime)}</dd></div>
          <div><dt>Costo</dt><dd>{service ? money(service.cost) : "—"}</dd></div>
          <div><dt>A nombre de</dt><dd>{r.clientName} · {r.clientDocumentType} {r.clientDocumentNumber}</dd></div>
          {r.status === "CANCELLED" && <div><dt>Cancelación</dt><dd>{r.cancelledBy === "SYSTEM" ? "Por el sistema" : "Por ti"}{r.cancellationReason ? ` · ${r.cancellationReason}` : ""}</dd></div>}
        </dl>
        <p className="muted small">Tus datos de contacto están en <Link to="/mis-datos">Mis datos</Link>.</p>

        {mode === "view" && canManage(r) && (
          <div className="actions">
            <button type="button" className="btn btn--primary" onClick={() => { setMode("modify"); setNotice(null); }}>Modificar fecha u hora</button>
            <button type="button" className="btn btn--danger" onClick={() => { setMode("cancel"); setNotice(null); }}>Cancelar reserva</button>
          </div>
        )}
      </section>

      {mode === "modify" && service && (
        <section className="panel">
          <h3>Elige el nuevo horario</h3>
          <AvailabilityPicker service={service} value={slot} onChange={setSlot} />
          <div className="actions">
            <button type="button" className="btn btn--primary" disabled={!slot?.startTime || busy} onClick={doModify}>{busy ? "Guardando…" : "Confirmar cambio"}</button>
            <button type="button" className="btn btn--ghost" onClick={() => { setMode("view"); setSlot(null); }}>Volver</button>
          </div>
          <p className="muted small">Solo puedes mover la cita con al menos 24 horas de antelación.</p>
        </section>
      )}

      {mode === "cancel" && (
        <section className="panel" role="alertdialog" aria-label="Confirmar cancelación">
          <h3>¿Cancelar esta reserva?</h3>
          <p>Se liberará el horario. Puedes cancelar hasta 2 horas antes de la cita.</p>
          <label className="field"><span>Motivo (opcional)</span><input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} /></label>
          <div className="actions">
            <button type="button" className="btn btn--danger" disabled={busy} onClick={doCancel}>{busy ? "Cancelando…" : "Sí, cancelar"}</button>
            <button type="button" className="btn btn--ghost" onClick={() => setMode("view")}>No, volver</button>
          </div>
        </section>
      )}
    </div>
  );
}
