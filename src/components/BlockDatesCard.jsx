import { useToast } from "./Toast";
import { useEffect, useState } from "react";
import { blockDates, listBlockedDates, listProviderReservations, unblockDate } from "../api/providerService";
import DateRangeCalendar from "./DateRangeCalendar";
import { formatLongDate } from "../utils/dates";
import { conflictsFor, expandDateRange, validateBlockRange } from "../utils/sprint3";

/**
 * HU-017 · Bloquear fechas desde el calendario: un día o varios seguidos, para un servicio o todo el negocio.
 * Avisa si hay reservas activas en esas fechas. Los bloqueos vigentes se listan y se pueden quitar.
 */
export default function BlockDatesCard({ service, company }) {
  const [scope, setScope] = useState("service"); // service | company
  const [range, setRange] = useState({ from: null, to: null });
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [conflicts, setConflicts] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [removing, setRemoving] = useState(null);

  const scopeKey = scope === "company" ? `c_${company?.id}` : `s_${service.id}`;

  async function loadBlocks() {
    try {
      const { data } = await listBlockedDates({ companyId: company.id, serviceId: scope === "service" ? service.id : undefined });
      // "Todo mi negocio" = bloqueos sin servicio; el back los trae junto con los de cada servicio.
      setBlocks(scope === "company" ? data.filter((b) => !b.serviceId) : data);
    } catch { setBlocks([]); }
  }
  useEffect(() => { setRange({ from: null, to: null }); setResult(null); setConflicts(null); setBlocks([]); loadBlocks(); }, [scopeKey]);
  const marked = blocks.map((b) => b.blockDate);

  const toast = useToast();
  async function remove(b) {
    setRemoving(b.id); setError(null);
    try { await unblockDate(b.id, b.serviceId || service.id); await loadBlocks(); toast.success("Quitamos el bloqueo: esa fecha vuelve a estar disponible."); }
    catch (err) { setError(err.friendlyMessage || "No pudimos quitar el bloqueo."); }
    finally { setRemoving(null); }
  }

  const count = range.from ? expandDateRange(range.from, range.to).length : 0;
  const pick = (r) => { setRange(r); setError(null); setConflicts(null); setResult(null); };

  async function review() {
    const bad = validateBlockRange(range.from, range.to);
    if (bad) return setError(bad);
    setBusy(true);
    try {
      const dates = expandDateRange(range.from, range.to);
      const { data } = await listProviderReservations({
        serviceId: scope === "service" ? service.id : undefined, fromDate: dates[0], toDate: dates[dates.length - 1], size: 100,
      });
      const found = conflictsFor(data.items, dates);
      if (found.length) setConflicts(found); else await confirm();
    } catch (err) {
      setError(err.friendlyMessage || "No pudimos revisar las reservas de esas fechas.");
    } finally { setBusy(false); }
  }

  async function confirm() {
    setBusy(true);
    const out = await blockDates({
      companyId: company.id, serviceId: scope === "service" ? service.id : undefined,
      from: range.from, to: range.to, reason,
    });
    if (out.done.length) await loadBlocks();
    setResult(out); setConflicts(null); setRange({ from: null, to: null }); setBusy(false);
  }

  return (
    <section className="card block-card" aria-labelledby="block-title">
      <div className="block-card__head">
        <div>
          <h2 id="block-title">Bloquear fechas</h2>
          <p className="muted small">Elige en el calendario un día, o el primero y el último de varios días seguidos. Tus clientes no podrán reservar en esas fechas.</p>
        </div>
      </div>

      <div className="seg" role="radiogroup" aria-label="Aplicar a">
        <button type="button" role="radio" aria-checked={scope === "service"} className={scope === "service" ? "seg__opt seg__opt--on" : "seg__opt"} onClick={() => setScope("service")}>Solo “{service.name}”</button>
        <button type="button" role="radio" aria-checked={scope === "company"} className={scope === "company" ? "seg__opt seg__opt--on" : "seg__opt"} onClick={() => setScope("company")}>Todo mi negocio</button>
      </div>

      <div className="block-card__body">
        <DateRangeCalendar from={range.from} to={range.to} onChange={pick} marked={marked} />
        <div className="block-card__side">
          <div className="block-summary" aria-live="polite">
            {!range.from ? <p className="muted">Todavía no has elegido fechas.</p> : (
              <>
                <strong>{count === 1 ? "1 día" : `${count} días`}</strong>
                <span>{range.to ? `${formatLongDate(range.from)} al ${formatLongDate(range.to)}` : formatLongDate(range.from)}</span>
              </>
            )}
          </div>
          <label className="field"><span>Motivo (opcional)</span>
            <input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="Ej. vacaciones, festivo" /></label>
          {error && <div className="alert alert--error">{error}</div>}
          <button type="button" className="btn btn--primary" disabled={busy || !range.from} onClick={review}>
            {busy ? "Procesando…" : count > 1 ? `Bloquear ${count} días` : "Bloquear fecha"}
          </button>
        </div>
      </div>

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
          {result.done.length > 0 && <p>Bloqueaste {result.done.length === 1 ? "1 fecha" : `${result.done.length} fechas`}.</p>}
          {result.failed.map((f) => <p key={f.date}>{formatLongDate(f.date)}: {f.message}</p>)}
        </div>
      )}
      <div className="block-list">
        <h3>{scope === "company" ? "Fechas bloqueadas en todo tu negocio" : "Fechas bloqueadas en este servicio"}</h3>
        {blocks.length === 0 ? <p className="muted small">No hay fechas bloqueadas.</p> : (
          <ul>
            {blocks.map((b) => (
              <li key={b.id}>
                <span><strong>{formatLongDate(b.blockDate)}</strong>{b.reason ? <small className="muted"> · {b.reason}</small> : null}</span>
                <button type="button" className="btn btn--ghost" disabled={removing === b.id} onClick={() => remove(b)}>
                  {removing === b.id ? "Quitando…" : "Quitar bloqueo"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
