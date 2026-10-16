import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getServiceById } from "../api/catalogService";
import AvailabilityPicker from "../components/AvailabilityPicker";
import { ClockIcon } from "../components/Icons";

/**
 * HU-009 · Detalle del servicio
 * HU-018 / 019 / 020 · Calendario con estados y horarios debajo
 * HU-021 · Botón "Reservar" (inicio de reserva)
 */
export default function ServiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [browse, setBrowse] = useState(null); // fecha que está mirando
  const [noDates, setNoDates] = useState(null); // null = todavía no sabemos
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getServiceById(id);
      setService(data);
    } catch (err) {
      setError(err.friendlyMessage || "No pudimos cargar el servicio.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function startReservation() {
    if (starting) return; // HU-021.6: evita iniciar dos procesos
    setStarting(true);
    // El servicio viaja en el state para no pedirlo otra vez (HU-021.2)
    navigate(`/servicio/${service.id}/reservar`, { state: { service } });
  }

  if (loading) return <p className="center muted">Cargando servicio…</p>;
  if (error) {
    return (
      <div className="card center">
        <div className="alert alert--error">{error}</div>
        <button className="btn btn--ghost" onClick={load}>Reintentar</button>{" "}
        <Link className="btn btn--ghost" to="/">Volver al catálogo</Link>
      </div>
    );
  }

  const unavailable = !service.isActive || noDates === true;

  return (
    <div className="detail">
      <Link to="/" className="link-btn">← Volver al catálogo</Link>

      <header className="detail__head card">
        <span className={`tag tag--${service.modality === "VIRTUAL" ? "virtual" : "presencial"}`}>
          {service.modality === "VIRTUAL" ? "Virtual" : "Presencial"}
        </span>
        <h1>{service.name}</h1>
        <p className="muted">
          Ofrecido por <strong>{service.companyName}</strong>
          {service.comunaName ? ` · ${service.comunaName}` : ""}
        </p>
        {service.description && <p>{service.description}</p>}
        {service.recommendations && (
          <p className="muted small"><strong>Recomendaciones:</strong> {service.recommendations}</p>
        )}
        <div className="detail__meta">
          <span className="detail__price">${Number(service.cost).toLocaleString("es-CO")}</span>
          <span className="detail__duration"><ClockIcon /> {service.durationMinutes} min</span>
        </div>
        <div className="detail__cta">
          <button
            type="button"
            className="btn btn--primary"
            onClick={startReservation}
            disabled={unavailable || starting}
          >
            {starting ? "Abriendo…" : "Reservar"}
          </button>
          {unavailable && (
            <span className="muted small">
              Este servicio no está disponible por el momento.
            </span>
          )}
        </div>
      </header>

      <section className="card">
        <h2>Disponibilidad</h2>
        <p className="muted small">
          Elige un día para ver los horarios. Para reservar usa el botón “Reservar”.
        </p>
        <AvailabilityPicker
          service={service}
          value={browse ? { date: browse } : null}
          onChange={(v) => setBrowse(v.date)}
          selectableSlots={false}
          onNoDates={setNoDates}
        />
      </section>
    </div>
  );
}
