import { useEffect, useState } from "react";
import { blockDates, listProviderReservations } from "../api/providerService";
import DateRangeCalendar from "./DateRangeCalendar";
import { formatLongDate } from "../utils/dates";
import { conflictsFor, expandDateRange, validateBlockRange } from "../utils/sprint3";

const KEY = (scope) => `servas_blocked_${scope}`;
const readMarked = (scope) => { try { return JSON.parse(localStorage.getItem(KEY(scope)) || "[]"); } catch { return []; } };
const writeMarked = (scope, list) => { try { localStorage.setItem(KEY(scope), JSON.stringify([...new Set(list)])); } catch { /* nada */ } };

/**
 * HU-017 · Bloquear fechas desde el calendario: un día o varios seguidos, para un servicio o todo el negocio.
 * Avisa si hay reservas activas en esas fechas. Quitar bloqueos aún no se puede (el back no tiene DELETE).
 */
export default function BlockDatesCard({ service, company }) {
  const [scope, setScope] = useState("service"); // service | company
  const [range, setRange] = useState({ from: null, to: null });
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [conflicts, setConflicts] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [marked, setMarked] = useState([]);

  const scopeKey = scope === "company" ? `c_${company?.id}` : `s_${service.id}`;
  useEffect(() => { setMarked(readMarked(scopeKey)); setRange({ from: null, to: null }); setResult(null); setConflicts(null); }, [scopeKey]);

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
    if (out.done.length) { const all = [...marked, ...out.done]; writeMarked(scopeKey, all); setMarked(all); }
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
      <p className="muted small">Por ahora el sistema no permite quitar un bloqueo desde aquí. Si te equivocas, avisa a soporte.</p>
    </section>
  );
}
