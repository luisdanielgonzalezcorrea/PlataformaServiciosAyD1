import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyCompany, updateCompany, validateLogoFile } from "../api/companyService";

const isUrl = (v) => !v || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v.trim());

/**
 * HU-040 · Editar datos del negocio.
 * El NIT se muestra pero no se edita: PUT /companies/{id} no lo acepta (ver PENDIENTES-BACK.md).
 */
export default function EditCompanyPage() {
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", address: "", social_media: "", logo: null });
  const [errors, setErrors] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyCompany()
      .then(({ data: c }) => {
        setCompany(c);
        setForm({ name: c.name || "", description: c.description || "", address: c.address || "", social_media: c.socialMedia || c.social_media || "", logo: null });
      })
      .catch((err) => setLoadError(err.friendlyMessage || "No pudimos cargar tu negocio."));
  }, []);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); setOk(false); };

  async function submit(e) {
    e.preventDefault();
    const local = {};
    if (!form.name.trim()) local.name = "Escribe el nombre del negocio.";
    if (!form.address.trim()) local.address = "Escribe la dirección.";
    if (!isUrl(form.social_media)) local.social_media = "Escribe un enlace válido que empiece por http:// o https://.";
    const logoErr = validateLogoFile(form.logo);
    if (logoErr) local.logo = logoErr;
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await updateCompany(company.id, form);
      setCompany((c) => ({ ...c, ...data }));
      setOk(true);
    } catch (err) {
      setError(err.friendlyMessage || "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <div className="narrow"><div className="alert alert--error">{loadError}</div></div>;
  if (!company) return <p className="state muted">Cargando tu negocio…</p>;
  const err = (f) => errors[f] && <small className="field__error">{errors[f]}</small>;

  return (
    <div className="auth-page">
      <form className="card form-card" onSubmit={submit} noValidate>
        <h1>Editar negocio</h1>
        {error && <div className="alert alert--error">{error}</div>}
        {ok && <div className="alert alert--success">Guardamos los datos de tu negocio.</div>}
        <div className="form-grid">
          <label className="field"><span>NIT</span><input value={company.nit || ""} readOnly /><small>El NIT no se puede cambiar desde aquí.</small></label>
          <label className="field"><span>Nombre del negocio</span>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} />{err("name")}</label>
          <label className="field field--full"><span>Descripción</span>
            <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} /></label>
          <label className="field field--full"><span>Ubicación</span>
            <input value={form.address} onChange={(e) => set("address", e.target.value)} aria-invalid={!!errors.address} />{err("address")}</label>
          <label className="field field--full"><span>Enlace de redes sociales</span>
            <input value={form.social_media} onChange={(e) => set("social_media", e.target.value)} placeholder="https://instagram.com/mi-negocio" aria-invalid={!!errors.social_media} />{err("social_media")}</label>
          <label className="field field--full"><span>Reemplazar logo (PNG, JPG o WEBP, máx. 2 MB)</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => set("logo", e.target.files?.[0] || null)} />{err("logo")}</label>
        </div>
        <div className="actions actions--between">
          <Link to="/negocio" className="btn btn--ghost">Volver</Link>
          <button className="btn btn--primary" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
        </div>
      </form>
    </div>
  );
}
