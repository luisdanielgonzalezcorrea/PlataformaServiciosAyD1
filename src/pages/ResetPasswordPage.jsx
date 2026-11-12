import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api/accountService";
import { validateNewPassword } from "../utils/sprint3";

/** HU-006 · Nueva contraseña con el token del correo (/reset-password?token=…). El token es de un solo uso. */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = useRef(params.get("token") || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [tokenBad, setTokenBad] = useState(!token.current);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // El token no debe quedar en la barra de direcciones ni en el historial.
  useEffect(() => {
    if (token.current) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function submit(e) {
    e.preventDefault();
    const bad = validateNewPassword(password, confirm);
    if (bad) return setError(bad);
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token.current, password);
      setDone(true);
    } catch (err) {
      if (err.code === "RESET_TOKEN_INVALID") setTokenBad(true);
      else setError(err.status === 429 ? "Demasiados intentos. Espera unos minutos." : err.friendlyMessage || "No pudimos cambiar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1>Nueva contraseña</h1>
        {done ? (
          <>
            <div className="alert alert--success">Cambiaste tu contraseña. Ya puedes iniciar sesión.</div>
            <Link to="/login" className="btn btn--primary">Iniciar sesión</Link>
          </>
        ) : tokenBad ? (
          <>
            <div className="alert alert--error">El enlace es inválido, venció o ya se usó.</div>
            <Link to="/olvide-contrasena" className="btn btn--primary">Pedir un enlace nuevo</Link>
          </>
        ) : (
          <>
            {error && <div className="alert alert--error">{error}</div>}
            <label className="field"><span>Contraseña nueva</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
            <label className="field"><span>Confirma la contraseña</span>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></label>
            <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Guardando…" : "Cambiar contraseña"}</button>
          </>
        )}
      </form>
    </div>
  );
}
