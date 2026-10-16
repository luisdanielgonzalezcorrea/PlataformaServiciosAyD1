import { useState } from "react";
import { openClientSession, requestClientOtp } from "../api/reservationService";
import { DOCUMENT_TYPES, validateDocument, validateEmail } from "../utils/validation";

/**
 * HU-025 · Validación de documento (identificarse con el código que llega al correo)
 *
 * Por privacidad el back nunca dice si un documento existe: /client/auth/otp responde
 * siempre lo mismo. Entonces el flujo es: pedir código -> si el cliente ya existía le
 * llega -> lo ingresa y abrimos sesión. Si no le llega, es cliente nuevo y sigue normal.
 */
export default function ClientVerification({ initial, onVerified, onSkip }) {
  const [form, setForm] = useState({
    documentType: initial?.documentType || "CC",
    documentNumber: initial?.documentNumber || "",
    email: initial?.email || "",
  });
  const [code, setCode] = useState("");
  const [stage, setStage] = useState("form"); // form | code
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [offline, setOffline] = useState(false);

  const doc = DOCUMENT_TYPES.find((d) => d.value === form.documentType);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function sendCode(e) {
    e?.preventDefault();
    const next = {
      documentNumber: validateDocument(form.documentType, form.documentNumber),
      email: validateEmail(form.email),
    };
    if (next.documentNumber || next.email) {
      setErrors(next);
      return;
    }
    setBusy(true);
    setError(null);
    setOffline(false);
    try {
      await requestClientOtp({
        documentType: form.documentType,
        documentNumber: form.documentNumber.trim(),
        email: form.email.trim(),
      });
      setStage("code");
      setMessage(
        "Si ese documento ya tiene reservas con ese correo, te enviamos un código. Si no te llega, eres cliente nuevo y puedes continuar sin verificar."
      );
    } catch (err) {
      setOffline(Boolean(err.network));
      setError(
        err.status === 429
          ? `Demasiados intentos. Espera ${err.retryAfter ? `${err.retryAfter} s` : "un momento"} e inténtalo de nuevo.`
          : err.friendlyMessage || "No pudimos validar el documento."
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    if (!code.trim()) {
      setError("Ingresa el código que te enviamos.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data } = await openClientSession({
        documentType: form.documentType,
        documentNumber: form.documentNumber.trim(),
        email: form.email.trim(),
        otpCode: code.trim(),
      });
      onVerified?.(data);
    } catch (err) {
      setError(err.friendlyMessage || "El código no es válido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h3>¿Ya reservaste antes?</h3>
      <p className="muted small">
        Valida tu documento para traer tus datos guardados y ver tus reservas activas.
      </p>

      {error && (
        <div className="alert alert--error">
          {error}
          {offline && (
            <>
              {" "}
              <button type="button" className="link-btn" onClick={sendCode}>Reintentar</button>
              {onSkip && (
                <>
                  {" · "}
                  <button type="button" className="link-btn" onClick={onSkip}>Continuar sin validar</button>
                </>
              )}
            </>
          )}
        </div>
      )}
      {message && stage === "code" && <div className="alert alert--info">{message}</div>}

      {stage === "form" ? (
        <form onSubmit={sendCode} noValidate>
          <div className="form-grid">
            <label className="field">
              <span>Tipo de documento</span>
              <select value={form.documentType} onChange={(e) => update("documentType", e.target.value)}>
                {DOCUMENT_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Número de documento</span>
              <input
                value={form.documentNumber}
                onChange={(e) => update("documentNumber", e.target.value)}
                inputMode="text"
                aria-invalid={Boolean(errors.documentNumber)}
              />
              <small className="muted">{doc?.hint}</small>
              {errors.documentNumber && <span className="field__error">{errors.documentNumber}</span>}
            </label>
            <label className="field field--full">
              <span>Correo con el que reservaste</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <span className="field__error">{errors.email}</span>}
            </label>
          </div>
          <div className="actions">
            <button className="btn btn--primary" disabled={busy}>
              {busy ? "Validando…" : "Enviarme un código"}
            </button>
            {onSkip && (
              <button type="button" className="btn btn--ghost" onClick={onSkip} disabled={busy}>
                Soy cliente nuevo
              </button>
            )}
          </div>
        </form>
      ) : (
        <form onSubmit={verify} noValidate>
          <label className="field">
            <span>Código de 6 dígitos</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
            />
          </label>
          <div className="actions">
            <button className="btn btn--primary" disabled={busy}>
              {busy ? "Verificando…" : "Validar código"}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => {
                setStage("form");
                setError(null);
                setCode("");
              }}
            >
              Cambiar datos
            </button>
            {onSkip && (
              <button type="button" className="btn btn--ghost" onClick={onSkip} disabled={busy}>
                No me llegó, soy cliente nuevo
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
