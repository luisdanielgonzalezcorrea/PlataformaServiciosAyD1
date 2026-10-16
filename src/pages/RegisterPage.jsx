import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerProvider } from "../api/authService";

const DOCUMENT_TYPES = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "TI", label: "Tarjeta de identidad" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "PASSPORT", label: "Pasaporte" },
  { value: "OTRO", label: "Otro" },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initialForm = {
  email: "",
  password: "",
  documentType: "",
  documentNumber: "",
  firstName: "",
  lastName: "",
  phone: "",
  birthDate: "",
};

export default function RegisterPage() {
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function validate() {
    const errors = {};
    const required = [
      "email",
      "password",
      "documentType",
      "documentNumber",
      "firstName",
      "lastName",
      "phone",
    ];

    required.forEach((field) => {
      if (!form[field]?.trim()) {
        errors[field] = "Este campo es obligatorio.";
      }
    });

    if (form.email && !EMAIL_REGEX.test(form.email)) {
      errors.email = "Ingresa un correo electrónico válido (usuario@dominio.extensión).";
    }

    if (form.password && form.password.length < 8) {
      errors.password = "La contraseña debe tener mínimo 8 caracteres.";
    }

    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    console.log(form);

    setSubmitting(true);
    try {
      await registerProvider(form);
      // HU-002: tras registrar, el sistema envía el OTP y muestra la pantalla de verificación.
      navigate("/verificar-correo", { state: { email: form.email } });
    } catch (err) {
      setFormError(err.friendlyMessage || "No se pudo completar el registro.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit} noValidate>
        <h1>Regístrate como proveedor</h1>
        <p className="muted">Crea tu cuenta para ofrecer y administrar tus servicios.</p>

        {formError && <div className="alert alert--error">{formError}</div>}

        <div className="form-grid">
          <Field label="Nombres" error={fieldErrors.firstName}>
            <input
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              autoComplete="given-name"
            />
          </Field>

          <Field label="Apellidos" error={fieldErrors.lastName}>
            <input
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              autoComplete="family-name"
            />
          </Field>

          <Field label="Tipo de documento" error={fieldErrors.documentType}>
            <select name="documentType" value={form.documentType} onChange={handleChange}>
              <option value="">Selecciona...</option>
              {DOCUMENT_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Número de documento" error={fieldErrors.documentNumber}>
            <input
              name="documentNumber"
              value={form.documentNumber}
              onChange={handleChange}
            />
          </Field>

          <Field label="Teléfono" error={fieldErrors.phone}>
            <input name="phone" value={form.phone} onChange={handleChange} autoComplete="tel" />
          </Field>

          <Field label="Fecha de nacimiento (opcional)" error={fieldErrors.birthDate}>
            <input
              type="date"
              name="birthDate"
              value={form.birthDate}
              onChange={handleChange}
            />
          </Field>

          <Field label="Correo electrónico" error={fieldErrors.email} full>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              placeholder="usuario@dominio.com"
            />
          </Field>

          <Field label="Contraseña" error={fieldErrors.password} full>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
            />
          </Field>
        </div>

        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? "Creando cuenta..." : "Crear cuenta"}
        </button>

        <p className="muted center">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </form>
    </div>
  );
}

function Field({ label, error, children, full }) {
  return (
    <label className={`field ${full ? "field--full" : ""}`}>
      <span>{label}</span>
      {children}
      {error && <span className="field__error">{error}</span>}
    </label>
  );
}
