import { httpClient, USE_MOCKS } from "./httpClient";

// Estado en memoria para simular el backend cuando VITE_USE_MOCKS=true.
const mockState = {
  registeredEmails: new Set(),
  pendingOtp: {}, // email -> { code, attempts, expiresAt }
  verifiedEmails: new Set(),
};

function wait(ms = 500) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * HU-001 · Registro de proveedor
 * POST /auth/register
 * body: { email, password, document_type, document_number, first_name, last_name, phone, birth_date? }
 */
export async function registerProvider(payload) {
  if (USE_MOCKS) {
    await wait();
    if (mockState.registeredEmails.has(payload.email)) {
      const err = new Error("El correo electrónico ya está registrado.");
      err.friendlyMessage = err.message;
      throw err;
    }
    mockState.registeredEmails.add(payload.email);
    mockState.pendingOtp[payload.email] = {
      code: "123456",
      attempts: 0,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    return { status: 201, data: { message: "Proveedor registrado exitosamente." } };
  }

  const body = {
    email: payload.email,
    password: payload.password,
    document_type: payload.documentType,
    document_number: payload.documentNumber,
    first_name: payload.firstName,
    last_name: payload.lastName,
    phone: payload.phone,
  };
  if (payload.birthDate) body.birth_date = payload.birthDate;

  const { data } = await httpClient.post("/auth/register", body);
  return { status: 201, data };
}

/**
 * HU-002 · Verificación del correo electrónico
 * POST /auth/verify-email
 * body: { email, otp_code }
 */
export async function verifyEmail({ email, otpCode }) {
  if (USE_MOCKS) {
    await wait();
    const record = mockState.pendingOtp[email];
    if (!record) {
      throw { friendlyMessage: "No hay un código pendiente para este correo." };
    }
    if (Date.now() > record.expiresAt) {
      throw { friendlyMessage: "El código de verificación ha expirado. Solicita uno nuevo." };
    }
    if (record.attempts >= 3) {
      throw { friendlyMessage: "Superaste el número máximo de intentos (3)." };
    }
    if (record.code !== otpCode) {
      record.attempts += 1;
      throw {
        friendlyMessage: `Código inválido. Intentos restantes: ${3 - record.attempts}.`,
      };
    }
    mockState.verifiedEmails.add(email);
    delete mockState.pendingOtp[email];
    return { status: 200, data: { message: "Cuenta verificada exitosamente." } };
  }

  const { data } = await httpClient.post("/auth/verify-email", { email, otp_code: otpCode });
  return { status: 200, data };
}

/**
 * HU-002 · Solicitar nuevo código de verificación
 * POST /auth/verify-email/resend
 */
export async function resendVerificationCode(email) {
  if (USE_MOCKS) {
    await wait();
    mockState.pendingOtp[email] = {
      code: "123456",
      attempts: 0,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    return { status: 200, data: { message: "Nuevo código enviado al correo." } };
  }

  const { data } = await httpClient.post("/auth/verify-email/resend", { email });
  return { status: 200, data };
}

/**
 * HU-004 · Inicio de sesión
 * POST /auth/login
 * body: { email, password }
 */
export async function login({ email, password }) {
  if (USE_MOCKS) {
    await wait();
    if (!mockState.verifiedEmails.has(email) && email !== "demo@agenda.co") {
      throw { friendlyMessage: "Debes verificar tu correo antes de iniciar sesión.", code: "EMAIL_NOT_VERIFIED" };
    }
    if (password.length < 8) {
      throw { friendlyMessage: "Correo o contraseña incorrectos." };
    }
    const fakeToken = `mock.${btoa(email)}.token`;
    return {
      status: 200,
      data: { token: fakeToken, role: "PROVIDER", provider: { email, first_name: "Proveedor" } },
    };
  }

  // El back responde { token, userId, email, role: PROVIDER|ADMIN }; el resto del front espera { token, role, provider }.
  const { data } = await httpClient.post("/auth/login", { email, password });
  return {
    status: 200,
    data: { token: data.token, role: data.role, provider: { id: data.userId, email: data.email } },
  };
}

/**
 * HU-005 · Cierre de sesión
 * POST /auth/logout (Bearer JWT)
 */
export async function logout() {
  if (USE_MOCKS) {
    await wait(200);
    return { status: 200, data: { message: "Sesión cerrada." } };
  }

  const { data } = await httpClient.post("/auth/logout");
  return { status: 200, data };
}
