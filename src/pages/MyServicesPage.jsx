import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listMyServices, setServiceActive } from "../api/providerService";
import { filterServices, paginate } from "../utils/sprint3";

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

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await listMyServices();
      setServices(data);
    } catch (err) {
      setServices([]);
      setError(err.friendlyMessage || "No pudimos cargar tus servicios.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => filterServices(services, { status, search }), [services, status, search]);
  const view = paginate(filtered, page);

  async function toggle(s) {
    setBusyId(s.id);
    setNotice(null);
    try {
      await setServiceActive(s.id, !s.isActive);
      setServices((list) => list.map((x) => (x.id === s.id ? { ...x, isActive: !s.isActive } : x)));
      setNotice({ type: "success", text: s.isActive
        ? `“${s.name}” quedó inactivo: ya no aparece en el catálogo ni se puede reservar.`
        : `“${s.name}” quedó activo otra vez.` });
    } catch (err) {
      setNotice({ type: "error", text: err.friendlyMessage || "No se pudo cambiar el estado." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page-wide">
      <div className="panel__head">
        <h1>Mis servicios</h1>
        <Link to="/negocio" className="btn btn--primary">Crear nuevo servicio</Link>
      </div>

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
                        <Link to="/agenda" className="link-btn">Horarios</Link>
                        <button type="button" className="link-btn" disabled={busyId === s.id} onClick={() => toggle(s)}
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
    </div>
  );
}
