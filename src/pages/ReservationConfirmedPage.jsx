import { useEffect } from "react";
import { CheckSeal } from "../components/Icons";
import { Link, Navigate, useLocation } from "react-router-dom";
import { reservationCode } from "../api/reservationService";
import { formatLongDate, formatTime } from "../utils/dates";

/**
 * HU-029 · Confirmación de registro
 * La pantalla solo se puede ver con la reserva en el state del router (no se puede abrir
 * pegando la URL), y bloqueamos el "atrás" para que no se pueda volver a los pasos
 * de la reserva ya registrada (criterio 7).
 */
export default function ReservationConfirmedPage() {
  const { state } = useLocation();

  useEffect(() => {
    // El ticket aparece arriba de todo, sin heredar el scroll del paso anterior.
    window.scrollTo(0, 0);
    window.history.pushState(null, "", window.location.href);
    const lock = () => window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", lock);
    return () => window.removeEventListener("popstate", lock);
  }, []);

  if (!state?.reservation) return <Navigate to="/" replace />;

  const { reservation, service, client } = state;
  const code = reservationCode(reservation);

  return (
    <div className="ticket">
      <div className="ticket__top">
        <CheckSeal />
        <h1>¡Reserva confirmada!</h1>
        <p className="muted">Guarda tu código de reserva, lo vas a necesitar si quieres consultarla o cancelarla.</p>
        <p className="confirmed__code" aria-label="Código de reserva">{code}</p>
      </div>

      <div className="ticket__tear" aria-hidden="true" />

      <div className="ticket__body">
        <dl className="summary">
          <div><dt>Servicio</dt><dd>{service.name}</dd></div>
          <div><dt>Proveedor</dt><dd>{service.companyName}</dd></div>
          <div><dt>Fecha</dt><dd>{formatLongDate(reservation.reservationDate)}</dd></div>
          <div><dt>Hora</dt><dd>{formatTime(reservation.startTime)} a {formatTime(reservation.endTime)}</dd></div>
          <div><dt>A nombre de</dt><dd>{client.firstName} {client.lastName}</dd></div>
          <div><dt>Correo</dt><dd>{client.email}</dd></div>
        </dl>

        <div className="alert alert--info">
          Verifica tu bandeja de entrada ({client.email}). Si no encuentras el correo, no pasa nada:
          tu reserva quedó registrada y la puedes ver en “Mis reservas”.
        </div>

        <div className="actions actions--center">
          <Link className="btn btn--primary" to="/mis-reservas">Ver mis reservas</Link>
          <Link className="btn btn--ghost" to="/">Volver al catálogo</Link>
        </div>
      </div>
    </div>
  );
}
