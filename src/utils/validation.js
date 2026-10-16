// Validaciones de formulario compartidas. Los mensajes están en el lenguaje de las HU.

export const DOCUMENT_TYPES = [
  { value: "CC", label: "Cédula de ciudadanía", hint: "Solo números, entre 6 y 10 dígitos", pattern: /^\d{6,10}$/ },
  { value: "TI", label: "Tarjeta de identidad", hint: "Solo números, entre 6 y 11 dígitos", pattern: /^\d{6,11}$/ },
  { value: "CE", label: "Cédula de extranjería", hint: "Letras y números, entre 6 y 12 caracteres", pattern: /^[A-Za-z0-9]{6,12}$/ },
  { value: "PASSPORT", label: "Pasaporte", hint: "Letras y números, entre 5 y 15 caracteres", pattern: /^[A-Za-z0-9]{5,15}$/ },
  { value: "OTRO", label: "Otro", hint: "Letras y números, entre 4 y 20 caracteres", pattern: /^[A-Za-z0-9]{4,20}$/ },
];

export function validateDocument(type, number) {
  const doc = DOCUMENT_TYPES.find((d) => d.value === type);
  const value = (number || "").trim();
  if (!value) return "Ingresa tu número de documento.";
  if (doc && !doc.pattern.test(value)) return `Formato inválido. ${doc.hint}.`;
  return null;
}

export function validateEmail(email) {
  const value = (email || "").trim();
  if (!value) return "Ingresa tu correo electrónico.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return "El correo electrónico no tiene un formato válido.";
  return null;
}

// El back acepta hasta 15 caracteres. Pedimos entre 7 y 15 dígitos (con + opcional).
export function validatePhone(phone) {
  const value = (phone || "").replace(/[\s-]/g, "");
  if (!value) return "Ingresa tu número de teléfono.";
  if (!/^\+?\d{7,15}$/.test(value)) return "El teléfono debe tener entre 7 y 15 dígitos (ej. 3001234567).";
  return null;
}

export function validateName(value, label) {
  const v = (value || "").trim();
  if (!v) return `Ingresa tus ${label}.`;
  if (v.length < 2) return `Tus ${label} son muy cortos.`;
  if (!/^[\p{L}][\p{L}\s'.-]*$/u.test(v)) return `Los ${label} solo pueden tener letras.`;
  return null;
}

// HU-013 · la fecha fin debe ser posterior a la de inicio (iguales tampoco vale)
export function validateDateRange(start, end) {
  if (start && end && end <= start) {
    return "La fecha de fin debe ser posterior a la fecha de inicio.";
  }
  return null;
}

export function validateClient(client) {
  const errors = {
    documentNumber: validateDocument(client.documentType, client.documentNumber),
    firstName: validateName(client.firstName, "nombres"),
    lastName: validateName(client.lastName, "apellidos"),
    email: validateEmail(client.email),
    phone: validatePhone(client.phone),
  };
  Object.keys(errors).forEach((k) => errors[k] === null && delete errors[k]);
  return errors;
}

// Convierte el arreglo fields[] del back ({field, message}) a { campo: mensaje }
export function fieldsToErrors(fields = []) {
  const out = {};
  fields.forEach((f) => {
    const key = String(f.field).split(".").pop();
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = f.message;
  });
  return out;
}
