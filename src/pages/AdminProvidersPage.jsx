import { useEffect, useMemo, useState } from "react";
import { adminResetProviderPassword, adminUpdateProviderContact, listAdminProviders } from "../api/accountService";

/**
 * HU-043 · Listado de proveedores con búsqueda y filtro por estado, y detalle.
 * HU-044 · Restablecer contraseña y editar contacto (con justificación) desde el detalle.
 * El back entrega nombre, correo, teléfono, verificado y número de negocios.
 * Diseño: lista a la izquierda y detalle a la derecha (fijo al hacer scroll), para gestionar sin perder la lista.
 */
export default function AdminProvidersPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState(null);
  const [contact, setContact] = useState({ email: "", phone: "", justification: "" });
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [askReset, setAskReset] = useState(false);

  useEffect(() => { listAdminProviders().then((r) => setItems(r.data.items)).catch((e) => { setItems([]); setError(e.friendlyMessage || "No pudimos cargar los proveedores."); }); }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items || []).filter((p) => {
      if (status === "VERIFIED" && !p.verified) return false;
      if (status === "PENDING" && p.verified) return false;
      return !q || `${p.firstName} ${p.lastName} ${p.email}`.toLowerCase().includes(q);
    });
  }, [items, search, status]);

  function open(p) {
    setSelected(p); setContact({ email: p.email || "", phone: p.phone || "", justification: "" });
    setNotice(null); setAskReset(false);
  }

  async function reset() {
    setBusy(true); setAskReset(false);
    try {
      const { data } = await adminResetProviderPassword(selected.id);
      setNotice({ type: "success", text: `Enviamos el enlace de restablecimiento a ${data?.email || selected.email}. Vence en 30 minutos.` });
    } catch (err) { setNotice({ type: "error", text: err.friendlyMessage || "No se pudo restablecer." }); }
    finally { setBusy(false); }
  }

  async function saveContact(e) {
    e.preventDefault();
    const changes = {};
    if (contact.email.trim() && contact.email.trim() !== (selected.email || "")) changes.email = contact.email.trim();
    if (contact.phone.trim() && contact.phone.trim() !== (selected.phone || "")) changes.phone = contact.phone.trim();
    if (!changes.email && !changes.phone) return setNotice({ type: "error", text: "Cambia el correo o el teléfono para guardar." });
    if (!contact.justification.trim()) return setNotice({ type: "error", text: "Escribe la justificación del cambio." });
    setBusy(true);
    try {
      const { data } = await adminUpdateProviderContact(selected.id, { ...changes, justification: contact.justification.trim() });
      const updated = { ...selected, ...changes, ...(data && data.id ? data : {}) };
      setSelected(updated);
      setItems((list) => list.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
      setContact({ email: updated.email || "", phone: updated.phone || "", justification: "" });
      setNotice({ type: "success", text: "Actualizamos el contacto. Avisamos al proveedor por correo." });
    } catch (err) { setNotice({ type: "error", text: err.friendlyMessage || "No se pudo actualizar." }); }
    finally { setBusy(false); }
  }

  return (
    <div className="page-wide">
      <h1>Proveedores</h1>
      {error && <div className="alert alert--error">{error}</div>}
      <div className={selected ? "admin-split admin-split--open" : "admin-split"}>
        <div className="admin-split__list">
          <div className="toolbar">
            <label className="field"><span>Buscar por nombre o correo</span><input value={search} onChange={(e) => setSearch(e.target.value)} /></label>
            <label className="field"><span>Estado</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="ALL">Todos</option><option value="VERIFIED">Verificados</option><option value="PENDING">Pendientes de verificar</option></select></label>
          </div>
          {items === null && <p className="state muted">Cargando…</p>}
          {items && shown.length === 0 && <p className="muted">No hay proveedores con esos filtros.</p>}
          {shown.length > 0 && (
            <div className="table-wrap">
              <table className="table table--select">
                <thead><tr><th>Proveedor</th><th>Correo</th><th>Negocios</th><th>Estado</th></tr></thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id} className={selected?.id === p.id ? "is-selected" : ""} onClick={() => open(p)}>
                      <td><button type="button" className="row-link" onClick={(e) => { e.stopPropagation(); open(p); }} aria-pressed={selected?.id === p.id}>{p.firstName} {p.lastName}</button></td>
                      <td>{p.email}</td><td>{p.companies}</td>
                      <td><span className={`badge ${p.verified ? "badge--ok" : "badge--warn"}`}>{p.verified ? "Verificado" : "Pendiente"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected && (
          <aside className="panel admin-detail" aria-label="Detalle del proveedor">
            <div className="panel__head">
              <h3>{selected.firstName} {selected.lastName}</h3>
              <button type="button" className="link-btn" onClick={() => setSelected(null)} aria-label="Cerrar detalle">Cerrar</button>
            </div>
            <p className="admin-detail__meta">
              <span className={`badge ${selected.verified ? "badge--ok" : "badge--warn"}`}>{selected.verified ? "Verificado" : "Pendiente"}</span>
              <span className="muted">{selected.companies} negocio(s)</span>
            </p>
            {notice && <div className={`alert alert--${notice.type === "error" ? "error" : "success"}`} role="status">{notice.text}</div>}

            <h4>Contraseña</h4>
            {!askReset ? (
              <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setAskReset(true)}>Restablecer contraseña</button>
            ) : (
              <div className="admin-detail__confirm">
                <p>Le enviaremos un enlace a <strong>{selected.email}</strong>. Tú no verás la contraseña.</p>
                <div className="actions">
                  <button type="button" className="btn btn--primary" disabled={busy} onClick={reset}>{busy ? "Enviando…" : "Enviar enlace"}</button>
                  <button type="button" className="btn btn--ghost" onClick={() => setAskReset(false)}>Cancelar</button>
                </div>
              </div>
            )}

            <h4>Datos de contacto</h4>
            <form onSubmit={saveContact} className="admin-detail__form">
              <label className="field"><span>Correo</span><input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></label>
              <label className="field"><span>Teléfono</span><input value={contact.phone} placeholder="+573001234567" onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></label>
              <label className="field"><span>Justificación (obligatoria)</span><textarea rows={3} maxLength={500} value={contact.justification} onChange={(e) => setContact({ ...contact, justification: e.target.value })} placeholder="Ej. el proveedor perdió acceso a su correo" /></label>
              <button className="btn btn--primary" type="submit" disabled={busy}>Guardar contacto</button>
            </form>
          </aside>
        )}
      </div>
    </div>
  );
}
