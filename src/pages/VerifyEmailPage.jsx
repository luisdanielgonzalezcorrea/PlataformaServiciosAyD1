import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { verifyEmail, resendVerificationCode } from "../api/authService";

const MAX_ATTEMPTS = 3;

export default function VerifyEmailPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const email = state?.email;

  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!email) {
      // Si llegan directo a esta ruta sin haberse registrado, los devolvemos.
      navigate("/registro", { replace: true });
    }
  }, [email, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!code.trim()) {
      setError("Ingresa el código de verificación.");
      return;
    }

    setSubmitting(true);
    try {
      await verifyEmail({ email, otpCode: code });
      setSuccess("Cuenta verificada correctamente. Ya puedes iniciar sesión.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setAttemptsLeft((prev) => Math.max(prev - 1, 0));
      setError(err.friendlyMessage || "El código ingresado no es válido.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setSuccess(null);
    setResending(true);
    try {
      await resendVerificationCode(email);
      setAttemptsLeft(MAX_ATTEMPTS);
      setCode("");
      setSuccess("Enviamos un nuevo código a tu correo.");
    } catch (err) {
      setError(err.friendlyMessage || "No se pudo reenviar el código.");
    } finally {
      setResending(false);
    }
  }

  const blocked = attemptsLeft <= 0;

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>Verifica tu correo</h1>
        <p className="muted">
          Enviamos un código de verificación a <strong>{email}</strong>.
        </p>

        {error && <div className="alert alert--error">{error}</div>}
        {success && <div className="alert alert--success">{success}</div>}

        <label className="field">
          <span>Código de verificación</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            placeholder="000000"
            disabled={blocked}
            inputMode="numeric"
          />
        </label>

        <p className="muted small">
          Intentos restantes: {attemptsLeft} de {MAX_ATTEMPTS}
        </p>

        <button className="btn btn--primary" type="submit" disabled={submitting || blocked}>
          {submitting ? "Verificando..." : "Verificar cuenta"}
        </button>

        <button
          type="button"
          className="btn btn--ghost"
          onClick={handleResend}
          disabled={resending}
        >
          {resending ? "Enviando..." : "Reenviar código"}
        </button>
      </form>
    </div>
  );
}
