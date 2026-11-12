import { useState } from "react";
import { Link } from "react-router-dom";
import { confirmEmailRecovery, requestEmailRecovery } from "../api/accountService";
import { DOCUMENT_TYPES, validateDocument, validateEmail, validateName, validatePhone } from "../utils/validation";

/**
 * HU-045 · Cambiar el correo cuando ya no se tiene acceso a él.
 * Pide datos que solo el cliente conoce (nombre, teléfono y un código de reserva) y manda el
 * código de confirmación al correo NUEVO. Las respuestas son neutras: nunca dicen si el documento existe.
 * Necesita endpoints nuevos en el back (ver PENDIENTES-BACK.md).
 */
export default function RecoverEmailPage() {
  const [form, setForm] = useState({ documentType: "CC", documentNumber: "", firstName: "", phone: "", reservationCode: "", newEmail: "" });
  const [stage, setStage] = useState("form");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); setError(null); };
  const doc = DOCUMENT_TYPES.find((d) => d.value === form.documentType);

  async function send(e) {
    e.preventDefault();
    const next = {
      documentNumber: validateDocument(form.documentType, form.documentNumber),
      firstName: validateName(form.firstName, "Tu nombre"),
      phone: validatePhone(form.phone),
      reservationCode: /^RSV-[A-Za-z0-9]{8}$/.test(form.reservationCode.trim()) ? null : "Escribe el código de una de tus reservas (ej. RSV-1A2B3C4D).",
      newEmail: validateEmail(form.newEmail),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setBusy(true);
    try {
      await requestEmailRecovery({ ...form, reservationCode: form.reservationCode.trim().toUpperCase() });
      setStage("code");
    } catch (err) {
      setError(err.status === 429 ? "Hiciste muchos intentos. Espera unos minutos." : err.friendlyMessage || "No pudimos procesar la solicitud.");
    } finally { setBusy(false); }
  }

  async function confirm(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await confirmEmailRecovery({ ...form, reservationCode: form.reservationCode.trim().toUpperCase(), otpCode: code.trim() });
      setStage("done");
    } catch (err) {
      setError(err.code === "INVALID_OTP" ? "El código es inválido o venció." : err.friendlyMessage || "No pudimos confirmar el cambio.");
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-page">
      <form className="card form-card" onSubmit={stage === "form" ? send : confirm} noValidate>
        <h1>Recuperar mi correo</h1>
        {error && <div className="alert alert--error">{error}</div>}

        {stage === "form" && (
          <>
            <p className="muted">Confirma quién eres con datos de tu reserva. Te enviaremos un código al correo nuevo.</p>
            <div className="form-grid">
              <label className="field"><span>Tipo de documento</span>
                <select value={form.documentType} onChange={(e) => set("documentType", e.target.value)}>
                  {DOCUMENT_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></label>
              <label className="field"><span>Número de documento</span>
                <input value={form.documentNumber} onChange={(e) => set("documentNumber", e.target.value)} aria-invalid={!!errors.documentNumber} />
                <small>{errors.documentNumber || doc?.hint}</small></label>
              <label className="field"><span>Tu nombre</span>
                <input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} aria-invalid={!!errors.firstName} />
                {errors.firstName && <small className="field__error">{errors.firstName}</small>}</label>
              <label className="field"><span>Teléfono registrado</span>
                <input value={form.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={!!errors.phone} />
                {errors.phone && <small className="field__error">{errors.phone}</small>}</label>
              <label className="field field--full"><span>Código de una reserva tuya</span>
                <input value={form.reservationCode} onChange={(e) => set("reservationCode", e.target.value)} placeholder="RSV-1A2B3C4D" aria-invalid={!!errors.reservationCode} />
                {errors.reservationCode && <small className="field__error">{errors.reservationCode}</small>}</label>
              <label className="field field--full"><span>Correo nuevo</span>
                <input type="email" value={form.newEmail} onChange={(e) => set("newEmail", e.target.value)} aria-invalid={!!errors.newEmail} />
                {errors.newEmail && <small className="field__error">{errors.newEmail}</small>}</label>
            </div>
            <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Enviando…" : "Enviar código al correo nuevo"}</button>
          </>
        )}

        {stage === "code" && (
          <>
            <div className="alert alert--info">Si los datos coinciden, enviamos un código a {form.newEmail.trim()}. Escríbelo aquí.</div>
            <label className="field"><span>Código</span><input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></label>
            <button className="btn btn--primary" type="submit" disabled={busy || code.length < 6}>{busy ? "Confirmando…" : "Confirmar cambio"}</button>
          </>
        )}

        {stage === "done" && (
          <>
            <div className="alert alert--success">Listo. Si los datos coincidían, tu correo quedó actualizado y cerramos tus sesiones anteriores. Avisamos al correo anterior del cambio.</div>
            <Link to="/mis-reservas" className="btn btn--primary">Ir a mis reservas</Link>
          </>
        )}
        <p className="muted center"><Link to="/mis-reservas">Volver</Link></p>
      </form>
    </div>
  );
}
