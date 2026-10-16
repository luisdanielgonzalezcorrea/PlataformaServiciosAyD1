import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createService, getCategories } from "../api/catalogService";
import { fieldsToErrors, validateDateRange } from "../utils/validation";

const EMPTY = {
  name: "",
  description: "",
  recommendations: "",
  cost: "",
  durationMinutes: 30,
  capacity: 1,
  modality: "PRESENCIAL",
  category: "",
  comunaId: "",
  startDate: "",
  endDate: "",
};

/**
 * HU-005 · Crear servicio
 * HU-013 · La vigencia (fecha inicio/fin) se puede definir desde acá o después en "Mi agenda"
 */
const ServicePage = ({
  companyId,
  comunas,
  error,
  loadingSubmit,
  setError,
  setLoadingSubmit,
  setSuccessMsg,
  successMsg,
}) => {
  const [serviceData, setServiceData] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [createdId, setCreatedId] = useState(null);

  useEffect(() => {
    getCategories()
      .then((res) => setCategories(res.data))
      .catch(() => setCategories([]));
  }, []);

  function set(field, value) {
    setServiceData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  const handleServiceSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setCreatedId(null);

    const local = {};
    if (!serviceData.category) local.category = "Selecciona una categoría.";
    if (serviceData.modality === "PRESENCIAL" && !serviceData.comunaId) {
      local.comunaId = "Selecciona la comuna donde se presta el servicio.";
    }
    const rangeError = validateDateRange(serviceData.startDate, serviceData.endDate);
    if (rangeError) local.endDate = rangeError;
    if (Object.keys(local).length > 0) {
      setFieldErrors(local);
      return;
    }

    setLoadingSubmit(true);
    try {
      const payload = {
        company_id: companyId,
        comuna_id: serviceData.modality === "PRESENCIAL" ? Number(serviceData.comunaId) : null,
        name: serviceData.name.trim(),
        modality: serviceData.modality,
        category: serviceData.category,
        cost: Number(serviceData.cost),
        duration_minutes: Number(serviceData.durationMinutes),
        capacity: Number(serviceData.capacity),
        description: serviceData.description || null,
        recommendations: serviceData.recommendations || null,
        start_date: serviceData.startDate || null,
        end_date: serviceData.endDate || null,
      };

      const res = await createService(payload);
      setCreatedId(res.data?.id || null);
      setSuccessMsg("¡Servicio creado! Ahora define sus días y horarios de atención.");
      setServiceData(EMPTY);
      setFieldErrors({});
    } catch (err) {
      setFieldErrors(fieldsToErrors(err.fields));
      setError(err.friendlyMessage || "Error al intentar crear el servicio en el servidor.");
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="narrow">
      <h2>Configuración del negocio y catálogo</h2>
      <p className="muted">
        Agrega los servicios que ofreces. Después de crearlos, define cuándo los atiendes en{" "}
        <Link to="/agenda">Mi agenda</Link>.
      </p>

      <hr className="sep" />

      <h3>+ Registrar nuevo servicio</h3>

      {error && <div className="alert alert--error">{error}</div>}
      {successMsg && (
        <div className="alert alert--success">
          {successMsg}{" "}
          {createdId && <Link to={`/agenda?servicio=${createdId}`}>Configurar agenda</Link>}
        </div>
      )}

      <form className="card" onSubmit={handleServiceSubmit}>
        <div className="form-grid">
          <label className="field field--full">
            <span>Nombre del servicio *</span>
            <input
              required
              maxLength={100}
              placeholder="Ej. Peluquería canina, Asesoría legal"
              value={serviceData.name}
              onChange={(e) => set("name", e.target.value)}
            />
            {fieldErrors.name && <span className="field__error">{fieldErrors.name}</span>}
          </label>

          <label className="field field--full">
            <span>Descripción</span>
            <textarea
              rows="3"
              placeholder="Describe qué incluye este servicio..."
              value={serviceData.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </label>

          <label className="field field--full">
            <span>Recomendaciones (opcional)</span>
            <input
              placeholder="Ej. Llegar 10 minutos antes..."
              value={serviceData.recommendations}
              onChange={(e) => set("recommendations", e.target.value)}
            />
          </label>

          <label className="field">
            <span>Categoría *</span>
            <select value={serviceData.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">Selecciona…</option>
              {categories.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            {fieldErrors.category && <span className="field__error">{fieldErrors.category}</span>}
          </label>

          <label className="field">
            <span>Modalidad *</span>
            <select value={serviceData.modality} onChange={(e) => set("modality", e.target.value)}>
              <option value="PRESENCIAL">Presencial</option>
              <option value="VIRTUAL">Virtual</option>
            </select>
          </label>

          {serviceData.modality === "PRESENCIAL" && (
            <label className="field field--full">
              <span>Comuna *</span>
              <select value={serviceData.comunaId} onChange={(e) => set("comunaId", e.target.value)}>
                <option value="">Selecciona comuna…</option>
                {comunas.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {fieldErrors.comunaId && <span className="field__error">{fieldErrors.comunaId}</span>}
            </label>
          )}

          <label className="field">
            <span>Precio (COP) *</span>
            <input
              type="number"
              required
              min="0"
              placeholder="70000"
              value={serviceData.cost}
              onChange={(e) => set("cost", e.target.value)}
            />
            {fieldErrors.cost && <span className="field__error">{fieldErrors.cost}</span>}
          </label>

          <label className="field">
            <span>Duración (minutos) *</span>
            <input
              type="number"
              required
              min="5"
              max="480"
              value={serviceData.durationMinutes}
              onChange={(e) => set("durationMinutes", e.target.value)}
            />
            {fieldErrors.durationMinutes && <span className="field__error">{fieldErrors.durationMinutes}</span>}
          </label>

          <label className="field">
            <span>Capacidad por horario *</span>
            <input
              type="number"
              required
              min="1"
              max="100"
              value={serviceData.capacity}
              onChange={(e) => set("capacity", e.target.value)}
            />
            <small className="muted">Cuántas personas puedes atender a la misma hora.</small>
            {fieldErrors.capacity && <span className="field__error">{fieldErrors.capacity}</span>}
          </label>

          <span />

          <label className="field">
            <span>Disponible desde (opcional)</span>
            <input type="date" value={serviceData.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </label>

          <label className="field">
            <span>Disponible hasta (opcional)</span>
            <input type="date" value={serviceData.endDate} onChange={(e) => set("endDate", e.target.value)} />
            {fieldErrors.endDate && <span className="field__error">{fieldErrors.endDate}</span>}
          </label>
        </div>

        <button type="submit" className="btn btn--primary" disabled={loadingSubmit}>
          {loadingSubmit ? "Guardando servicio…" : "Guardar servicio en catálogo"}
        </button>
      </form>
    </div>
  );
};

export default ServicePage;
