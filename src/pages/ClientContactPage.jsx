import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getClientProfile, requestContactCode, updateClientContact } from "../api/accountService";
import { clearClientSession, getClientSession } from "../api/reservationService";
import ClientVerification from "../components/ClientVerification";
import { validateEmail, validatePhone } from "../utils/validation";

const MSG = {
  EMAIL_UNCHANGED: "Ese ya es tu correo actual.",
  EMAIL_TAKEN: "Ese correo ya está registrado por otra persona.",
  INVALID_OTP: "El código es inválido o ya venció.",
  EMAIL_VERIFICATION_REQUIRED: "Confirma el correo nuevo con el código que te enviamos.",
};

/**
 * HU-041 · Actualizar correo o teléfono de contacto.
 * Si cambia el correo, el código llega al correo NUEVO y el back avisa al anterior.
 */
export default function ClientContactPage() {
  const [session, setSession] = useState(() => getClientSession());
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ phone: "", email: "" });
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    getClientProfile()
      .then(({ data }) => { setProfile(data); setForm({ phone: data.phone || "", email: data.email || "" }); })
      .catch((err) => {
        if (err.status === 401) { clearClientSession(); setSession(null); }
        else setNotice({ type: "error", text: err.friendlyMessage });
      });
  }, [session]);

  const emailChanged = profile && form.email.trim().toLowerCase() !== (profile.email || "").toLowerCase();
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); setCodeSent(false); setNotice(null); };

  function validate() {
    const e = { phone: validatePhone(form.phone), email: validateEmail(form.email) };
    setErrors(e);
    return !e.phone && !e.email;
  }

  async function sendCode() {
    if (!validate()) return;
    setBusy(true); setNotice(null);
    try {
      await requestContactCode(form.email.trim());
      setCodeSent(true);
      setNotice({ type: "info", text: `Enviamos un código a ${form.email.trim()}. Escríbelo para confirmar el cambio.` });
    } catch (err) {
      setNotice({ type: "error", text: MSG[err.code] || err.friendlyMessage || "No pudimos enviar el código." });
    } finally { setBusy(false); }
  }

  async function save(e) {
    e.preventDefault();
    if (!validate()) return;
    if (emailChanged && !codeSent) return sendCode();
    setBusy(true); setNotice(null);
    try {
      const { data } = await updateClientContact({
        firstName: profile.firstName, lastName: profile.lastName, phone: form.phone.trim(), email: form.email.trim(),
        verificationCode: emailChanged ? code.trim() : undefined,
      });
      setProfile(data); setCode(""); setCodeSent(false);
      setNotice({ type: "success", text: emailChanged ? "Actualizamos tu contacto. Avisamos a tu correo anterior del cambio." : "Actualizamos tu teléfono." });
    } catch (err) {
      setNotice({ type: "error", text: MSG[err.code] || err.friendlyMessage || "No pudimos actualizar tus datos." });
    } finally { setBusy(false); }
  }

  if (!session) {
    return (
      <div className="narrow">
        <h1>Mis datos de contacto</h1>
        <p className="muted">Valida tu documento para actualizar tu contacto.</p>
        <ClientVerification onVerified={setSession} />
        <p className="muted small center">¿Perdiste el acceso a tu correo? <Link to="/recuperar-correo">Recupéralo aquí</Link></p>
      </div>
    );
  }
  if (!profile) return <p className="state muted">Cargando tus datos…</p>;

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={save} noValidate>
        <h1>Mis datos de contacto</h1>
        <p className="muted">{profile.firstName} {profile.lastName} · {profile.documentType} {profile.documentNumber}</p>
        {notice && <div className={`alert alert--${notice.type === "error" ? "error" : notice.type === "success" ? "success" : "info"}`}>{notice.text}</div>}
        <label className="field"><span>Correo electrónico</span>
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!errors.email} />
          {errors.email && <small className="field__error">{errors.email}</small>}</label>
        <label className="field"><span>Teléfono</span>
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={!!errors.phone} />
          {errors.phone && <small className="field__error">{errors.phone}</small>}</label>
        {emailChanged && codeSent && (
          <label className="field"><span>Código enviado al correo nuevo</span>
            <input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></label>
        )}
        <button className="btn btn--primary" type="submit" disabled={busy || (emailChanged && codeSent && code.length < 6)}>
          {busy ? "Procesando…" : emailChanged && !codeSent ? "Enviar código al correo nuevo" : "Guardar cambios"}
        </button>
        <p className="muted center"><Link to="/mis-reservas">Volver a mis reservas</Link></p>
      </form>
    </div>
  );
}
