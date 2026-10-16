import axios from "axios";

// El back no usa context-path, así que la base es solo host:puerto.
// Si en algún despliegue lo ponen detrás de un proxy con prefijo (/api), se cambia en .env
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export const PROVIDER_TOKEN_KEY = "servas_token";
export const CLIENT_TOKEN_KEY = "servas_client_token";

export const httpClient = axios.create({
  baseURL: BASE_URL,
});

/**
 * Cada petición lleva uno de los dos tokens:
 *  - proveedor (servas_token): login del proveedor, 8 h
 *  - cliente (servas_client_token): sesión corta por OTP, 30 min
 * Las llamadas que son del cliente se marcan con { clientAuth: true }.
 */
httpClient.interceptors.request.use((config) => {
  const key = config.clientAuth ? CLIENT_TOKEN_KEY : PROVIDER_TOKEN_KEY;
  let token = null;
  try {
    token = (config.clientAuth ? sessionStorage : localStorage).getItem(key);
  } catch {
    token = null;
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// El back responde { code, message, fields?: [{field, message}] }.
// Dejamos todo eso en el error para que la UI pueda pintar mensajes por campo.
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error?.response?.data;
    const status = error?.response?.status;
    let message = data?.message || data?.error;
    if (!error.response) {
      message = "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
    } else if (!message) {
      message = `Ocurrió un error al comunicarse con el servidor (código ${status}).`;
    }
    return Promise.reject({
      friendlyMessage: message,
      code: data?.code,
      fields: data?.fields || [],
      status,
      network: !error.response,
      retryAfter: error?.response?.headers?.["retry-after"],
    });
  }
);

export function wait(ms = 400) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

// Crea un error con la misma forma que el de arriba (sirve para los mocks).
export function apiError(code, message, status = 400, extra = {}) {
  return { friendlyMessage: message, code, status, fields: [], network: false, ...extra };
}
