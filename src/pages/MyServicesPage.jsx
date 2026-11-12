import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deactivateService, listMyServices, setServiceActive } from "../api/providerService";
import { filterServices, paginate, planDeactivation } from "../utils/sprint3";
import { addDays, formatLongDate, todayISO } from "../utils/dates";

const MODALITY = { VIRTUAL: "Virtual", PRESENCIAL: "Presencial" };
const money = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(n) || 0);

/**
 * HU-010 · Listado de mis servicios (filtro por estado, búsqueda por nombre, paginación).
 * HU-012 · Activar / desactivar desde la lista.
 */
export default function MyServicesPage() {
  const [services, setServices] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [company, setCompany] = useState(null);
  const [dialog, setDialog] = useState(null); // { service, mode, from, to, error }

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, company: mine } = await listMyServices();
      setServices(data);
      setCompany(mine);
    } catch (err) {
      setServices([]);
      setError(err.friendlyMessage || "No pudimos cargar tus servicios.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => filterServices(services, { status, search }), [services, status, search]);
  const view = paginate(filtered, page);

  async function activate(s) {
    setBusyId(s.id);
    setNotice(null);
    try {
      await setServiceActive(s.id, true);
      setServices((list) => list.map((x) => (x.id === s.id ? { ...x, isActive: true } : x)));
      setNotice({ type: "success", text: `“${s.name}” quedó activo otra vez.` });
    } catch (err) {
      setNotice({ type: "error", text: err.friendlyMessage || "No se pudo cambiar el estado." });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDeactivate() {
    const { service, mode, from, to } = dialog;
    const { plan, error: bad } = planDeactivation({ mode, from, to, startDate: service.startDate });
    if (bad) return setDialog({ ...dialog, error: bad });
    setBusyId(service.id);
    setNotice(null);
    try {
      const out = await deactivateService(service, plan, company?.id);
      if (out.kind === "now") {
        setServices((list) => list.map((x) => (x.id === service.id ? { ...x, isActive: false } : x)));
        setNotice({ type: "success", text: `“${service.name}” quedó inactivo: ya no aparece en el catálogo ni se puede reservar.` });
      } else if (out.kind === "block") {
        setNotice(out.failed.length
          ? { type: "error", text: `Se programaron ${out.done.length} día(s), pero ${out.failed.length} fallaron: ${out.failed[0].message}` }
          : { type: "success", text: `Programado: “${service.name}” no se podrá reservar del ${formatLongDate(plan.from)} al ${formatLongDate(plan.to)}.` });
      } else {
        setServices((list) => list.map((x) => (x.id === service.id ? { ...x, endDate: out.endDate } : x)));
        setNotice({ type: "success", text: `Programado: “${service.name}” deja de poder reservarse desde el ${formatLongDate(plan.from)}. Para reabrirlo, cambia la fecha de fin en Mi agenda.` });
      }
      setDialog(null);
    } catch (err) {
      setDialog({ ...dialog, error: err.friendlyMessage || "No se pudo desactivar el servicio." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page-wide">
      <header className="page-hero page-hero--row">
        <div>
          <h1>Mis servicios</h1>
          <p>Edita, programa horarios y controla qué ven tus clientes.</p>
        </div>
        <Link to="/negocio" className="btn btn--primary">+ Crear nuevo servicio</Link>
      </header>

      {notice && <div className={`alert alert--${notice.type === "error" ? "error" : "success"}`}>{notice.text}</div>}
      {error && <div className="alert alert--error">{error} <button type="button" className="link-btn" onClick={load}>Reintentar</button></div>}
      {services === null && <p className="state muted">Cargando tus servicios…</p>}

      {services !== null && services.length === 0 && !error && (
        <div className="panel center">
          <p>Todavía no tienes servicios publicados.</p>
          <Link to="/negocio" className="btn btn--primary">Crear nuevo servicio</Link>
        </div>
      )}

      {services?.length > 0 && (
        <>
          <div className="toolbar">
            <label className="field">
              <span>Buscar por nombre</span>
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Ej. consulta" />
            </label>
            <label className="field">
              <span>Estado</span>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
                <option value="ALL">Todos</option>
                <option value="ACTIVE">Activos</option>
                <option value="INACTIVE">Inactivos</option>
              </select>
            </label>
          </div>

          {filtered.length === 0 ? (
            <p className="muted">Ningún servicio coincide con la búsqueda.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Nombre</th><th>Modalidad</th><th>Costo</th><th>Estado</th><th>Gestionar</th></tr>
                </thead>
                <tbody>
                  {view.items.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{MODALITY[s.modality] || s.modality}</td>
                      <td>{money(s.cost)}</td>
                      <td><span className={`badge ${s.isActive ? "badge--ok" : "badge--off"}`}>{s.isActive ? "Activo" : "Inactivo"}</span></td>
                      <td className="table__actions">
                        <Link to={`/mis-servicios/${s.id}/editar`} className="link-btn">Editar</Link>
                        <Link to={`/agenda?servicio=${s.id}`} className="link-btn">Horarios</Link>
                        <button type="button" className="link-btn" disabled={busyId === s.id}
                          onClick={() => (s.isActive ? setDialog({ service: s, mode: "now", from: addDays(todayISO(), 1), to: "" }) : activate(s))}
                          aria-label={`${s.isActive ? "Desactivar" : "Activar"} ${s.name}`}>
                          {s.isActive ? "Desactivar" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view.totalPages > 1 && (
            <div className="actions actions--center">
              <button type="button" className="btn btn--ghost" disabled={view.page === 0} onClick={() => setPage(view.page - 1)}>Anterior</button>
              <span className="muted small">Página {view.page + 1} de {view.totalPages}</span>
              <button type="button" className="btn btn--ghost" disabled={view.page >= view.totalPages - 1} onClick={() => setPage(view.page + 1)}>Siguiente</button>
            </div>
          )}
          <p className="muted small">Si desactivas un servicio con reservas futuras, esas reservas siguen vigentes. Al reactivarlo vuelve al catálogo si tiene horarios configurados.</p>
        </>
      )}

      {dialog && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="deact-title">
          <div className="modal__box">
            <h2 id="deact-title">Desactivar “{dialog.service.name}”</h2>
            <p className="muted">¿Cuándo quieres que deje de poder reservarse?</p>
            <div className="choice-list">
              <label className={`choice ${dialog.mode === "now" ? "choice--on" : ""}`}>
                <input type="radio" name="when" checked={dialog.mode === "now"} onChange={() => setDialog({ ...dialog, mode: "now", error: null })} />
                <span><strong>De inmediato</strong><small>Desaparece del catálogo ahora. Las reservas que ya existen siguen vigentes.</small></span>
              </label>
              <label className={`choice ${dialog.mode === "later" ? "choice--on" : ""}`}>
                <input type="radio" name="when" checked={dialog.mode === "later"} onChange={() => setDialog({ ...dialog, mode: "later", error: null })} />
                <span><strong>Programarlo para una fecha</strong><small>Sigue activo hasta la fecha que elijas.</small></span>
              </label>
            </div>
            {dialog.mode === "later" && (
              <div className="form-grid">
                <label className="field"><span>Desde</span>
                  <input type="date" min={addDays(todayISO(), 1)} value={dialog.from} onChange={(e) => setDialog({ ...dialog, from: e.target.value, error: null })} /></label>
                <label className="field"><span>Hasta (opcional)</span>
                  <input type="date" min={dialog.from || undefined} value={dialog.to} onChange={(e) => setDialog({ ...dialog, to: e.target.value, error: null })} />
                  <small>Si lo dejas vacío, queda sin fecha de regreso.</small></label>
              </div>
            )}
            {dialog.error && <div className="alert alert--error">{dialog.error}</div>}
            <div className="actions actions--between">
              <button type="button" className="btn btn--ghost" onClick={() => setDialog(null)}>Cancelar</button>
              <button type="button" className="btn btn--danger" disabled={busyId === dialog.service.id} onClick={confirmDeactivate}>
                {dialog.mode === "now" ? "Desactivar ahora" : "Programar desactivación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
