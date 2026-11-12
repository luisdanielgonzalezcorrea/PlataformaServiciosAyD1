import { useEffect, useMemo, useState } from "react";
import { adminResetProviderPassword, adminUpdateProviderContact, listAdminProviders } from "../api/accountService";

/**
 * HU-043 · Listado de proveedores con búsqueda y filtro por estado, y detalle.
 * HU-044 · Restablecer contraseña y editar contacto (con justificación) desde el detalle.
 * El back entrega nombre, correo, verificado y número de negocios. Razón social, NIT, categoría y
 * comuna requieren ampliar el endpoint (PENDIENTES-BACK.md). HU-044 necesita endpoints nuevos.
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

  useEffect(() => { listAdminProviders().then((r) => setItems(r.data.items)).catch((e) => { setItems([]); setError(e.friendlyMessage || "No pudimos cargar los proveedores."); }); }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items || []).filter((p) => {
      if (status === "VERIFIED" && !p.verified) return false;
      if (status === "PENDING" && p.verified) return false;
      return !q || `${p.firstName} ${p.lastName} ${p.email}`.toLowerCase().includes(q);
    });
  }, [items, search, status]);

  function open(p) { setSelected(p); setContact({ email: p.email, phone: "", justification: "" }); setNotice(null); }

  async function reset() {
    if (!window.confirm(`¿Restablecer la contraseña de ${selected.email}? Le llegará un enlace por correo.`)) return;
    setBusy(true);
    try { await adminResetProviderPassword(selected.id); setNotice({ type: "success", text: "Enviamos el enlace de restablecimiento al correo del proveedor." }); }
    catch (err) { setNotice({ type: "error", text: err.status === 404 ? "El back aún no tiene esta función (pendiente de AyD2)." : err.friendlyMessage || "No se pudo restablecer." }); }
    finally { setBusy(false); }
  }

  async function saveContact(e) {
    e.preventDefault();
    if (!contact.justification.trim()) return setNotice({ type: "error", text: "Escribe la justificación del cambio." });
    setBusy(true);
    try {
      await adminUpdateProviderContact(selected.id, contact);
      setNotice({ type: "success", text: "Actualizamos el contacto y quedó registrada la justificación." });
    } catch (err) { setNotice({ type: "error", text: err.status === 404 ? "El back aún no tiene esta función (pendiente de AyD2)." : err.friendlyMessage || "No se pudo actualizar." }); }
    finally { setBusy(false); }
  }

  return (
    <div className="page-wide">
      <h1>Proveedores</h1>
      {error && <div className="alert alert--error">{error}</div>}
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
          <table className="table">
            <thead><tr><th>Proveedor</th><th>Correo</th><th>Negocios</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td>{p.firstName} {p.lastName}</td><td>{p.email}</td><td>{p.companies}</td>
                  <td><span className={`badge ${p.verified ? "badge--ok" : "badge--warn"}`}>{p.verified ? "Verificado" : "Pendiente"}</span></td>
                  <td><button type="button" className="link-btn" onClick={() => open(p)}>Ver detalle</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <section className="panel" aria-label="Detalle del proveedor">
          <div className="panel__head"><h3>{selected.firstName} {selected.lastName}</h3><button type="button" className="link-btn" onClick={() => setSelected(null)}>Cerrar</button></div>
          {notice && <div className={`alert alert--${notice.type === "error" ? "error" : "success"}`}>{notice.text}</div>}
          <p className="muted">{selected.email} · {selected.companies} negocio(s)</p>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={reset}>Restablecer contraseña</button>
          <form onSubmit={saveContact} className="form-grid">
            <label className="field"><span>Correo</span><input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></label>
            <label className="field"><span>Teléfono</span><input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></label>
            <label className="field field--full"><span>Justificación (obligatoria)</span><input value={contact.justification} onChange={(e) => setContact({ ...contact, justification: e.target.value })} /></label>
            <button className="btn btn--primary" type="submit" disabled={busy}>Guardar contacto</button>
          </form>
        </section>
      )}
    </div>
  );
}
