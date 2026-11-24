import { useState } from "react";
import { resendVerificationCode } from "../api/authService";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const expired = params.get("expired") === "1";
  const inactive = params.get("inactive") === "1";

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await login({ email, password });
      navigate(data.isAdmin ? "/admin" : "/negocio");
    } catch (err) {
      // HU-004 · Inicio de sesión fallido
      if (err.code === "EMAIL_NOT_VERIFIED") {
        // Credenciales correctas pero sin verificar: se envía un código nuevo y se abre la pantalla para escribirlo.
        try { await resendVerificationCode(email); } catch { /* en esa pantalla puede pedir otro */ }
        navigate("/verificar-correo", { state: { email, notice: "Tu correo aún no estaba verificado. Te enviamos un código nuevo; escríbelo para activar tu cuenta." } });
        return;
      }
      setError(err.friendlyMessage || "Correo o contraseña incorrectos.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>Portal proveedores</h1>
        <p className="muted">Inicia sesión para administrar tus servicios y reservas.</p>

        {expired && !error && <div className="alert alert--info" role="status">Tu sesión venció. Inicia sesión de nuevo para continuar.</div>}
        {inactive && !error && <div className="alert alert--info" role="status">Cerramos tu sesión tras 3 minutos sin actividad. Inicia sesión de nuevo para continuar.</div>}
        {error && <div className="alert alert--error">{error}</div>}

        <label className="field">
          <span>Correo electrónico</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? "Ingresando..." : "Iniciar sesión"}
        </button>

        <p className="muted center"><Link to="/olvide-contrasena">¿Olvidó su contraseña?</Link></p>

        <p className="muted center">
          ¿Aún no tienes cuenta? <Link to="/registro">Regístrate</Link>
        </p>
        <p className="muted small center">
          ¿Te enviaron un código de verificación? <Link to="/verificar-correo">Verifica tu correo</Link>
        </p>
      </form>
    </div>
  );
}
