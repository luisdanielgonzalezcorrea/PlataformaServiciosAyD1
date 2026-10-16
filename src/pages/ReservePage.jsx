import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getServiceById } from "../api/catalogService";
import {
  clearClientSession, confirmReservation, createReservation, getClientProfile,
  getClientSession,
} from "../api/reservationService";
import ActiveReservations from "../components/ActiveReservations";
import AvailabilityPicker from "../components/AvailabilityPicker";
import ClientVerification from "../components/ClientVerification";
import { formatLongDate, formatTime } from "../utils/dates";
import {
  DOCUMENT_TYPES, fieldsToErrors, validateClient, validateDocument,
} from "../utils/validation";

const STEPS = ["Fecha y hora", "Tus datos", "Verificación"];
const DRAFT_KEY = "servas_reservation_draft";
const EMPTY_CLIENT = {
  documentType: "CC", documentNumber: "", firstName: "", lastName: "", email: "", phone: "",
};

function readDraft(serviceId) {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
    return d?.serviceId === serviceId ? d : null;
  } catch {
    return null;
  }
}

/**
 * HU-021 a HU-029 · Proceso de reserva en 3 pasos.
 *
 * Con el back real la reserva se hace en dos llamadas:
 *   1) POST /reservations            -> queda PENDING (bloquea el horario 15 min) y llega un código al correo
 *   2) POST /reservations/{id}/confirm -> con ese código pasa a CONFIRMED
 * Por eso el paso 3 ("Verificación") tiene el resumen, el botón de confirmar y el campo del código.
 */
export default function ReservePage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [service, setService] = useState(location.state?.service || null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(!location.state?.service);

  const draft = useRef(readDraft(id)).current;
  const [step, setStep] = useState(draft?.step || 0);
  const [slot, setSlot] = useState(draft?.slot || null); // { date, startTime, endTime }
  const [client, setClient] = useState(draft?.client || EMPTY_CLIENT);
  const [errors, setErrors] = useState({});
  const [noDates, setNoDates] = useState(null);

  const [session, setSession] = useState(() => getClientSession());
  const [showVerify, setShowVerify] = useState(false);
  const [docChecked, setDocChecked] = useState(false);

  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState(null); // reserva PENDING creada, esperando el código
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [otp, setOtp] = useState("");
  const [banner, setBanner] = useState(null); // { type, text }

  // Carga del servicio si llegaron por URL directa (o falló la carga anterior). HU-021.7
  const loadService = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await getServiceById(id);
      setService(data);
    } catch (err) {
      setLoadError(err.friendlyMessage || "No pudimos abrir la reserva.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!service) loadService();
  }, [service, loadService]);

  // El borrador sobrevive a una recarga, pero nunca guardamos la reserva pendiente.
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ serviceId: id, step: Math.min(step, 2), slot, client }));
    } catch {
      /* sin storage no pasa nada */
    }
  }, [id, step, slot, client]);

  // Si ya había sesión de cliente, traemos sus datos una vez (HU-025.1)
  useEffect(() => {
    if (!session || draft?.client?.documentNumber) return;
    getClientProfile()
      .then(({ data }) => applyProfile(data))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuenta regresiva de la ventana de 15 min para el código
  useEffect(() => {
    if (!pending) return undefined;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((pending.expiresAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [pending]);

  function applyProfile(profile) {
    setClient({
      documentType: profile.documentType,
      documentNumber: profile.documentNumber,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone,
    });
    setDocChecked(true);
  }

  async function handleVerified(newSession) {
    setSession(newSession);
    setShowVerify(false);
    try {
      const { data } = await getClientProfile();
      applyProfile(data);
      setBanner({ type: "success", text: "Listo, traje tus datos guardados. Revísalos antes de continuar." });
    } catch (err) {
      setBanner({ type: "error", text: err.friendlyMessage || "No pudimos traer tus datos guardados." });
    }
  }

  const handleSessionExpired = useCallback(() => {
    clearClientSession();
    setSession(null);
  }, []);

  function updateClient(field, value) {
    setClient((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    // cambiar algo después de la reserva pendiente invalida ese código
    if (pending) setPending(null);
  }

  function leaveReservation() {
    // HU-021.8: salir sin registrar nada
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* nada */
    }
    navigate(`/servicio/${id}`);
  }

  function goBackToCalendar(text) {
    setSlot((s) => (s ? { date: s.date, startTime: null, endTime: null } : s));
    setPending(null);
    setOtp("");
    setAccepted(false);
    setStep(0);
    if (text) setBanner({ type: "error", text });
  }

  function nextFromStep2(e) {
    e.preventDefault();
    const found = validateClient(client);
    setErrors(found);
    if (Object.keys(found).length > 0) return; // HU-024.3
    setBanner(null);
    setStep(2);
  }

  /** HU-027 / HU-028 · Registrar la reserva (queda pendiente de código) */
  async function handleRegister() {
    if (submitting) return; // HU-027.4 / HU-028.6
    // HU-028.3: validamos otra vez por si algo quedó vacío
    const found = validateClient(client);
    if (!slot?.startTime || Object.keys(found).length > 0) {
      setErrors(found);
      setStep(slot?.startTime ? 1 : 0);
      setBanner({ type: "error", text: "Falta completar algún dato obligatorio antes de confirmar." });
      return;
    }
    if (!accepted) {
      setBanner({ type: "error", text: "Debes aceptar el tratamiento de tus datos para confirmar la reserva." });
      return;
    }
    // Ya existe una pendiente con estos mismos datos: no creamos otra, solo pedimos el código.
    if (pending) return;

    setSubmitting(true);
    setBanner(null);
    try {
      const { data } = await createReservation({
        service,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        client: { ...client, documentNumber: client.documentNumber.trim(), email: client.email.trim() },
      });
      setPending({ ...data, expiresAt: Date.now() + 15 * 60 * 1000 });
      setOtp("");
    } catch (err) {
      handleCreateError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCreateError(err) {
    switch (err.code) {
      case "SLOT_NOT_AVAILABLE":
        // HU-027.5 / HU-028.5: otro cliente tomó el horario
        goBackToCalendar("Ese horario ya no está disponible. Elige otro para continuar.");
        break;
      case "RESERVATION_TOO_SOON":
      case "RESERVATION_TOO_FAR":
      case "OUTSIDE_ATTENTION_HOURS":
      case "DATE_BLOCKED":
      case "DATE_OUT_OF_RANGE":
      case "SERVICE_INACTIVE":
        goBackToCalendar(err.friendlyMessage);
        break;
      case "VALIDATION_ERROR":
        setErrors(fieldsToErrors(err.fields));
        setStep(1);
        setBanner({ type: "error", text: err.friendlyMessage || "Revisa los datos marcados." });
        break;
      default:
        // HU-027.6 / HU-028.7: conservamos todo y dejamos reintentar
        setBanner({
          type: "error",
          text: err.network
            ? err.friendlyMessage
            : "No se pudo procesar la reserva, intente nuevamente.",
        });
    }
  }

  /** HU-029 · Confirmar con el código que llegó al correo */
  async function handleConfirmCode(e) {
    e.preventDefault();
    if (submitting) return;
    if (!/^\d{6}$/.test(otp)) {
      setBanner({ type: "error", text: "El código tiene 6 dígitos." });
      return;
    }
    setSubmitting(true);
    setBanner(null);
    try {
      const { data } = await confirmReservation(pending.id, otp);
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* nada */
      }
      navigate("/reserva-confirmada", {
        replace: true,
        state: { reservation: data, service, client },
      });
    } catch (err) {
      if (err.code === "RESERVATION_NOT_ACTIVE" || err.code === "OTP_ATTEMPTS_EXCEEDED") {
        goBackToCalendar(
          err.code === "OTP_ATTEMPTS_EXCEEDED"
            ? "Superaste los intentos del código. Empieza de nuevo y elige tu horario."
            : "La reserva expiró porque pasaron más de 15 minutos. Elige tu horario otra vez."
        );
      } else {
        setBanner({
          type: "error",
          text: err.code === "INVALID_OTP" ? "El código es incorrecto o ya expiró. Revísalo e inténtalo de nuevo." : err.friendlyMessage,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  /* --------------------------------- render -------------------------------- */

  if (loading) return <p className="center muted">Preparando tu reserva…</p>;
  if (loadError || !service) {
    return (
      <div className="card center">
        <div className="alert alert--error">{loadError || "No encontramos el servicio."}</div>
        <button className="btn btn--primary" onClick={loadService}>Intentar nuevamente</button>{" "}
        <Link className="btn btn--ghost" to={`/servicio/${id}`}>Volver al servicio</Link>
      </div>
    );
  }

  const doc = DOCUMENT_TYPES.find((d) => d.value === client.documentType);

  return (
    <div className="reserve">
      <ol className="stepper" aria-label="Progreso de la reserva">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`stepper__item ${i === step ? "is-current" : ""} ${i < step ? "is-done" : ""}`}
            aria-current={i === step ? "step" : undefined}
          >
            <span className="stepper__num">{i < step ? "✓" : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <aside className="card service-mini">
        <strong>{service.name}</strong>
        <span className="muted small">
          {service.companyName} · {service.durationMinutes} min · ${Number(service.cost).toLocaleString("es-CO")}
        </span>
      </aside>

      {banner && <div className={`alert alert--${banner.type === "error" ? "error" : banner.type === "success" ? "success" : "info"}`}>{banner.text}</div>}

      {/* ------------------------- Paso 1 · Fecha y hora ------------------------ */}
      {step === 0 && (
        <section className="card">
          <h2>Elige la fecha y la hora</h2>
          {noDates && (
            <div className="alert alert--info">
              Por ahora este servicio no tiene fechas disponibles. Vuelve a intentarlo más tarde.
            </div>
          )}
          <AvailabilityPicker
            service={service}
            value={slot}
            onChange={(v) => {
              setSlot(v);
              setBanner(null);
            }}
            onNoDates={setNoDates}
          />
          {slot?.startTime && (
            <p className="selection">
              Elegiste el <strong>{formatLongDate(slot.date)}</strong> a las <strong>{formatTime(slot.startTime)}</strong>
            </p>
          )}
          <div className="actions actions--between">
            <button type="button" className="btn btn--ghost" onClick={leaveReservation}>Volver</button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={!slot?.startTime || noDates === true}
              onClick={() => {
                setBanner(null);
                setStep(1);
              }}
            >
              Continuar
            </button>
          </div>
        </section>
      )}

      {/* --------------------------- Paso 2 · Tus datos -------------------------- */}
      {step === 1 && (
        <>
          {session ? (
            <ActiveReservations
              documentNumber={session.documentNumber}
              onSessionExpired={handleSessionExpired}
              compact
            />
          ) : showVerify ? (
            <ClientVerification
              initial={client}
              onVerified={handleVerified}
              onSkip={() => setShowVerify(false)}
            />
          ) : (
            <p className="muted small">
              ¿Ya reservaste antes?{" "}
              <button type="button" className="link-btn" onClick={() => setShowVerify(true)}>
                Valida tu documento
              </button>{" "}
              para traer tus datos y ver tus reservas activas.
            </p>
          )}

          <form className="card" onSubmit={nextFromStep2} noValidate>
            <h2>Tus datos</h2>
            <div className="form-grid">
              <label className="field">
                <span>Tipo de documento *</span>
                <select
                  value={client.documentType}
                  onChange={(e) => updateClient("documentType", e.target.value)}
                  disabled={Boolean(session)}
                >
                  {DOCUMENT_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Número de documento *</span>
                <input
                  value={client.documentNumber}
                  onChange={(e) => updateClient("documentNumber", e.target.value)}
                  onBlur={() => {
                    // HU-025.2: alerta de formato al salir del campo
                    const msg = client.documentNumber ? validateDocument(client.documentType, client.documentNumber) : null;
                    if (msg) setErrors((p) => ({ ...p, documentNumber: msg }));
                    else if (client.documentNumber) setDocChecked(true);
                  }}
                  readOnly={Boolean(session)}
                  aria-invalid={Boolean(errors.documentNumber)}
                />
                <small className="muted">{doc?.hint}</small>
                {errors.documentNumber && <span className="field__error">{errors.documentNumber}</span>}
                {docChecked && !errors.documentNumber && !session && client.documentNumber && (
                  <small className="ok">Formato correcto</small>
                )}
              </label>

              <label className="field">
                <span>Nombres *</span>
                <input
                  value={client.firstName}
                  onChange={(e) => updateClient("firstName", e.target.value)}
                  autoComplete="given-name"
                  aria-invalid={Boolean(errors.firstName)}
                />
                {errors.firstName && <span className="field__error">{errors.firstName}</span>}
              </label>

              <label className="field">
                <span>Apellidos *</span>
                <input
                  value={client.lastName}
                  onChange={(e) => updateClient("lastName", e.target.value)}
                  autoComplete="family-name"
                  aria-invalid={Boolean(errors.lastName)}
                />
                {errors.lastName && <span className="field__error">{errors.lastName}</span>}
              </label>

              <label className="field">
                <span>Correo electrónico *</span>
                <input
                  type="email"
                  value={client.email}
                  onChange={(e) => updateClient("email", e.target.value)}
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                />
                <small className="muted">Aquí te llega el código para confirmar la reserva.</small>
                {errors.email && <span className="field__error">{errors.email}</span>}
              </label>

              <label className="field">
                <span>Teléfono *</span>
                <input
                  value={client.phone}
                  onChange={(e) => updateClient("phone", e.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                  aria-invalid={Boolean(errors.phone)}
                />
                {errors.phone && <span className="field__error">{errors.phone}</span>}
              </label>
            </div>

            <div className="actions actions--between">
              <button type="button" className="btn btn--ghost" onClick={() => setStep(0)}>Volver</button>
              <button className="btn btn--primary">Continuar</button>
            </div>
          </form>
        </>
      )}

      {/* ------------------------- Paso 3 · Verificación ------------------------ */}
      {step === 2 && (
        <section className="card">
          <h2>Revisa y confirma tu reserva</h2>

          <dl className="summary">
            <div><dt>Servicio</dt><dd>{service.name}</dd></div>
            <div><dt>Proveedor</dt><dd>{service.companyName}</dd></div>
            <div><dt>Fecha</dt><dd>{formatLongDate(slot.date)}</dd></div>
            <div><dt>Hora</dt><dd>{formatTime(slot.startTime)} a {formatTime(slot.endTime)}</dd></div>
            <div><dt>Valor</dt><dd>${Number(service.cost).toLocaleString("es-CO")}</dd></div>
            <div><dt>Cliente</dt><dd>{client.firstName} {client.lastName}</dd></div>
            <div><dt>Documento</dt><dd>{client.documentType} {client.documentNumber}</dd></div>
            <div><dt>Correo</dt><dd>{client.email}</dd></div>
            <div><dt>Teléfono</dt><dd>{client.phone}</dd></div>
          </dl>

          {!pending ? (
            <>
              <label className="check">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                <span>Acepto el tratamiento de mis datos personales para gestionar esta reserva.</span>
              </label>
              <div className="actions actions--between">
                <button type="button" className="btn btn--ghost" onClick={() => setStep(1)} disabled={submitting}>
                  Volver
                </button>
                <button type="button" className="btn btn--primary" onClick={handleRegister} disabled={submitting}>
                  {submitting ? "Procesando…" : "Confirmar reserva"}
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleConfirmCode} className="otp-box">
              <div className="alert alert--info">
                Te enviamos un código de 6 dígitos a <strong>{client.email}</strong>. Mientras lo ingresas
                te guardamos el horario por{" "}
                <strong>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</strong> min.
              </div>
              <label className="field">
                <span>Código de confirmación</span>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                />
              </label>
              <div className="actions actions--between">
                <span />
                <button className="btn btn--primary" disabled={submitting || secondsLeft === 0}>
                  {submitting ? "Verificando…" : "Validar código"}
                </button>
              </div>
              {secondsLeft === 0 && (
                <p className="muted small">
                  El tiempo se agotó y el horario se liberó.{" "}
                  <button type="button" className="link-btn" onClick={() => goBackToCalendar("Elige tu horario otra vez.")}>
                    Empezar de nuevo
                  </button>
                </p>
              )}
            </form>
          )}
        </section>
      )}
    </div>
  );
}
