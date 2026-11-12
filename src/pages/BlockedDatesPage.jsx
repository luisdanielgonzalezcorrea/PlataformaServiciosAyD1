import { useEffect, useState } from "react";
import { blockDates, listMyServices, listProviderReservations } from "../api/providerService";
import { formatLongDate } from "../utils/dates";
import { conflictsFor, expandDateRange, validateBlockRange } from "../utils/sprint3";

/**
 * HU-017 · Bloqueo de fechas (un día o un rango, para todo el negocio o un servicio).
 * Antes de bloquear avisa si hay reservas activas en esas fechas.
 * Desbloquear: el back no tiene DELETE /blocked-dates todavía (ver PENDIENTES-BACK.md).
 */
export default function BlockedDatesPage() {
  const [company, setCompany] = useState(null);
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({ serviceId: "", from: "", to: "", reason: "" });
  const [error, setError] = useState(null);
  const [conflicts, setConflicts] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listMyServices().then((r) => { setServices(r.data); setCompany(r.company); }).catch((e) => setError(e.friendlyMessage));
  }, []);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setConflicts(null); setResult(null); setError(null); };

  async function review(e) {
    e.preventDefault();
    const bad = validateBlockRange(form.from, form.to);
    if (bad) return setError(bad);
    setBusy(true);
    try {
      const dates = expandDateRange(form.from, form.to);
      const { data } = await listProviderReservations({
        serviceId: form.serviceId || undefined, fromDate: dates[0], toDate: dates[dates.length - 1], size: 100,
      });
      const found = conflictsFor(data.items, dates);
      if (found.length) setConflicts(found);
      else await confirm();
    } catch (err) {
      setError(err.friendlyMessage || "No pudimos revisar las reservas de esas fechas.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!company) return setError("No encontramos tu negocio.");
    setBusy(true);
    const out = await blockDates({ companyId: company.id, serviceId: form.serviceId || undefined, from: form.from, to: form.to, reason: form.reason });
    setResult(out);
    setConflicts(null);
    setBusy(false);
  }

  return (
    <div className="narrow">
      <h1>Bloquear fechas</h1>
      <p className="muted">Los clientes no podrán reservar en las fechas bloqueadas.</p>
      <form className="card" onSubmit={review} noValidate>
        {error && <div className="alert alert--error">{error}</div>}
        <label className="field"><span>Aplicar a</span>
          <select value={form.serviceId} onChange={(e) => set("serviceId", e.target.value)}>
            <option value="">Todo mi negocio</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <div className="form-grid">
          <label className="field"><span>Desde</span><input type="date" value={form.from} onChange={(e) => set("from", e.target.value)} /></label>
          <label className="field"><span>Hasta (opcional)</span><input type="date" value={form.to} onChange={(e) => set("to", e.target.value)} /></label>
        </div>
        <label className="field"><span>Motivo</span>
          <input value={form.reason} maxLength={200} onChange={(e) => set("reason", e.target.value)} placeholder="Ej. vacaciones" /></label>
        <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Revisando…" : "Bloquear"}</button>
      </form>

      {conflicts && (
        <div className="alert alert--error" role="alert">
          <p><strong>Hay {conflicts.length} reserva(s) activa(s) en esas fechas.</strong> Si bloqueas, esas citas siguen vigentes y tendrás que gestionarlas con tus clientes.</p>
          <ul>{conflicts.map((r) => <li key={r.id}>{formatLongDate(r.reservationDate)} · {r.startTime} · {r.clientName}</li>)}</ul>
          <div className="actions">
            <button type="button" className="btn btn--danger" onClick={confirm} disabled={busy}>Bloquear de todos modos</button>
            <button type="button" className="btn btn--ghost" onClick={() => setConflicts(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {result && (
        <div className={`alert alert--${result.failed.length ? "info" : "success"}`}>
          {result.done.length > 0 && <p>Bloqueaste {result.done.length} fecha(s).</p>}
          {result.failed.map((f) => <p key={f.date}>{formatLongDate(f.date)}: {f.message}</p>)}
        </div>
      )}
      <p className="muted small">Para desbloquear una fecha comunícate con soporte: el sistema aún no permite quitar bloqueos desde aquí.</p>
    </div>
  );
}
