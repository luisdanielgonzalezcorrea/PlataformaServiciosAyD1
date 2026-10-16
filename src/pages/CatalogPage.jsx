import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getServices, getComunas } from "../api/catalogService";
import { ClockIcon } from "../components/Icons";

export default function CatalogPage() {
  const [services, setServices] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [selectedComuna, setSelectedComuna] = useState("");
  const [selectedModality, setSelectedModality] = useState("");

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const [servicesRes, comunasRes] = await Promise.all([
        getServices(filters),
        getComunas().catch(() => ({ data: [] })),
      ]);

      setServices(servicesRes?.data || []);
      if (comunasRes?.data) setComunas(comunasRes.data);
    } catch (err) {
      console.error("Error al cargar el catálogo:", err);
      setError("No se pudieron cargar los servicios en este momento.");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (comunaId, modality) => {
    const filters = {};
    if (comunaId) filters.comunaId = comunaId;
    if (modality) filters.modality = modality;
    fetchCatalog(filters);
  };

  return (
    <div className="catalog">
      <section className="hero">
        <div className="hero__inner">
          <h1>Reserva el servicio que necesitas, a la hora que te quede bien</h1>
          <p>Encuentra servicios en tu comuna, mira los horarios libres y agenda en minutos.</p>
        </div>
      </section>

      {/* Filtros de búsqueda */}
      <div className="filters">
        <label className="filters__item">
          <span>Comuna</span>
          <select
            value={selectedComuna}
            onChange={(e) => {
              setSelectedComuna(e.target.value);
              handleFilterChange(e.target.value, selectedModality);
            }}
          >
            <option value="">Todas las comunas</option>
            {comunas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="filters__item">
          <span>Modalidad</span>
          <select
            value={selectedModality}
            onChange={(e) => {
              setSelectedModality(e.target.value);
              handleFilterChange(selectedComuna, e.target.value);
            }}
          >
            <option value="">Todas las modalidades</option>
            <option value="PRESENCIAL">Presencial</option>
            <option value="VIRTUAL">Virtual</option>
          </select>
        </label>
      </div>

      {loading && <p className="state muted">Cargando catálogo…</p>}
      {error && <div className="alert alert--error">{error}</div>}

      {!loading && !error && (
        <>
          {services.length === 0 ? (
            <p className="state muted">No hay servicios disponibles con los filtros seleccionados.</p>
          ) : (
            <div className="svc-grid">
              {services.map((service) => (
                <article key={service.id} className="svc-card">
                  <div className="svc-card__top">
                    <span className={`tag tag--${service.modality === "VIRTUAL" ? "virtual" : "presencial"}`}>
                      {service.modality === "VIRTUAL" ? "Virtual" : "Presencial"}
                    </span>
                    <span className="svc-card__time">
                      <ClockIcon /> {service.durationMinutes} min
                    </span>
                  </div>

                  <h3 className="svc-card__name">{service.name}</h3>
                  <p className="svc-card__by">
                    Ofrecido por <strong>{service.companyName}</strong>
                  </p>

                  {service.description && <p className="svc-card__desc">{service.description}</p>}

                  <div className="svc-card__foot">
                    <span className="svc-card__price">${Number(service.cost).toLocaleString("es-CO")}</span>
                    <Link to={`/servicio/${service.id}`} className="btn btn--primary">
                      Ver horarios
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
