import { useCallback, useEffect, useState } from "react";
import { clearClientSession, closeClientSession, getClientSession } from "../api/reservationService";
import { Link } from "react-router-dom";
import ClientReservations from "../components/ClientReservations";
import ClientVerification from "../components/ClientVerification";

/**
 * HU-030 / HU-031 · Consulta de reservas del cliente (fuera del flujo de reserva)
 * Necesita la sesión corta del cliente (código por correo, dura 30 min).
 */
export default function MyReservationsPage() {
  const [session, setSession] = useState(() => getClientSession());
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setSession(getClientSession());
  }, []);

  const handleExpired = useCallback(() => {
    clearClientSession();
    setSession(null);
    setExpired(true);
  }, []);

  async function logout() {
    await closeClientSession().catch(() => {});
    setSession(null);
  }

  return (
    <div className="narrow">
      <h1>Mis reservas</h1>
      {expired && (
        <div className="alert alert--info">Tu sesión expiró. Valida tu documento otra vez para continuar.</div>
      )}

      {!session ? (
        <>
        <ClientVerification
          onVerified={(s) => {
            setExpired(false);
            setSession(s);
          }}
        />
        <p className="muted small center">¿Ya no tienes acceso a ese correo? <Link to="/recuperar-correo">Recupéralo aquí</Link></p>
        </>
      ) : (
        <>
          <p className="muted small">
            Sesión de {session.documentType} {session.documentNumber}.{" "}
            <button type="button" className="link-btn" onClick={logout}>Cerrar sesión</button>
          </p>
          <div className="contact-card">
            <div>
              <strong>Tus datos de contacto</strong>
              <span>Aquí te llegan los códigos y confirmaciones. Mantén tu correo y teléfono al día.</span>
            </div>
            <Link to="/mis-datos" className="btn btn--primary">Actualizar correo y teléfono</Link>
          </div>
          <ClientReservations documentNumber={session.documentNumber} onSessionExpired={handleExpired} />
        </>
      )}
    </div>
  );
}
