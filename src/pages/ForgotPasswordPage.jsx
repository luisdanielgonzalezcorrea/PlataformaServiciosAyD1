import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/accountService";
import { validateEmail } from "../utils/validation";

/** HU-006 · Pide el correo y manda el enlace de restablecimiento. Mensaje igual exista o no la cuenta. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const bad = validateEmail(email);
    if (bad) return setError(bad);
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.status === 429 ? "Hiciste muchos intentos. Espera unos minutos e inténtalo de nuevo." : err.friendlyMessage || "No pudimos procesar la solicitud.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1>Recuperar contraseña</h1>
        {sent ? (
          <div className="alert alert--success">Si la cuenta existe, te enviamos las instrucciones por correo. El enlace dura 30 minutos.</div>
        ) : (
          <>
            <p className="muted">Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.</p>
            {error && <div className="alert alert--error">{error}</div>}
            <label className="field"><span>Correo electrónico</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
            <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Enviando…" : "Enviar enlace"}</button>
          </>
        )}
        <p className="muted center"><Link to="/login">Volver a iniciar sesión</Link></p>
      </form>
    </div>
  );
}
