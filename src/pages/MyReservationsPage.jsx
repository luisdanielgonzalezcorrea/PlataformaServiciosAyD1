import { useCallback, useEffect, useState } from "react";
import { clearClientSession, closeClientSession, getClientSession } from "../api/reservationService";
import ActiveReservations from "../components/ActiveReservations";
import ClientVerification from "../components/ClientVerification";

/**
 * HU-026 · Consulta de reservas activas (fuera del flujo de reserva)
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
        <ClientVerification
          onVerified={(s) => {
            setExpired(false);
            setSession(s);
          }}
        />
      ) : (
        <>
          <p className="muted small">
            Sesión de {session.documentType} {session.documentNumber}.{" "}
            <button type="button" className="link-btn" onClick={logout}>Cerrar sesión</button>
          </p>
          <ActiveReservations documentNumber={session.documentNumber} onSessionExpired={handleExpired} />
        </>
      )}
    </div>
  );
}
