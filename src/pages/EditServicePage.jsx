import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getCategories, getComunas, getServiceById } from "../api/catalogService";
import { updateService } from "../api/providerService";
import { fieldsToErrors } from "../utils/validation";
import { validateServiceForm } from "../utils/sprint3";

/** HU-011 · Editar servicio (formulario precargado). */
export default function EditServicePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [categories, setCategories] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [errors, setErrors] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getServiceById(id)
      .then(({ data: s }) => setForm({
        name: s.name || "", cost: s.cost ?? "", description: s.description || "", modality: s.modality || "PRESENCIAL",
        recommendations: s.recommendations || "", comunaId: s.comunaId ?? "", category: s.category || "",
        durationMinutes: s.durationMinutes ?? 30, capacity: s.capacity ?? 1,
      }))
      .catch((err) => setLoadError(err.friendlyMessage || "No pudimos cargar el servicio."));
    getCategories().then((r) => setCategories(r.data)).catch(() => {});
    getComunas().then((r) => setComunas(r.data)).catch(() => {});
  }, [id]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setOk(false);
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setOk(false);
    const local = validateServiceForm(form);
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      await updateService(id, form);
      setOk(true);
    } catch (err) {
      setErrors(fieldsToErrors(err.fields));
      setError(err.friendlyMessage || "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <div className="narrow"><div className="alert alert--error">{loadError}</div><Link to="/mis-servicios">Volver a mis servicios</Link></div>;
  if (!form) return <p className="state muted">Cargando servicio…</p>;

  const err = (f) => errors[f] && <small className="field__error">{errors[f]}</small>;
  return (
    <div className="auth-page">
      <form className="card form-card" onSubmit={submit} noValidate>
        <h1>Editar servicio</h1>
        {error && <div className="alert alert--error">{error}</div>}
        {ok && <div className="alert alert--success">Cambios guardados. Ya los ven tus clientes en el catálogo.</div>}
        <div className="form-grid">
          <label className="field field--full"><span>Título</span>
            <input value={form.name} maxLength={100} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} />{err("name")}</label>
          <label className="field"><span>Costo (COP)</span>
            <input type="number" min="0" value={form.cost} onChange={(e) => set("cost", e.target.value)} aria-invalid={!!errors.cost} />{err("cost")}</label>
          <label className="field"><span>Modalidad</span>
            <select value={form.modality} onChange={(e) => set("modality", e.target.value)}>
              <option value="PRESENCIAL">Presencial</option><option value="VIRTUAL">Virtual</option></select>{err("modality")}</label>
          {form.modality === "PRESENCIAL" && (
            <label className="field"><span>Comuna</span>
              <select value={form.comunaId} onChange={(e) => set("comunaId", e.target.value)} aria-invalid={!!errors.comunaId}>
                <option value="">Selecciona…</option>
                {comunas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{err("comunaId")}</label>
          )}
          <label className="field"><span>Categoría</span>
            <select value={form.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">Sin cambios</option>
              {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select></label>
          <label className="field"><span>Duración (min)</span>
            <input type="number" min="1" max="480" value={form.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)} />{err("durationMinutes")}</label>
          <label className="field"><span>Capacidad</span>
            <input type="number" min="1" max="100" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} />{err("capacity")}</label>
          <label className="field field--full"><span>Descripción</span>
            <textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} aria-invalid={!!errors.description} />{err("description")}</label>
          <label className="field field--full"><span>Recomendaciones</span>
            <textarea rows={3} value={form.recommendations} onChange={(e) => set("recommendations", e.target.value)} /></label>
        </div>
        <div className="actions actions--between">
          <button type="button" className="btn btn--ghost" onClick={() => navigate("/mis-servicios")}>Volver</button>
          <button className="btn btn--primary" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
        </div>
      </form>
    </div>
  );
}
