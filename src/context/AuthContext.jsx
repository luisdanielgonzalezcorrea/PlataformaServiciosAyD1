import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { login as loginRequest, logout as logoutRequest } from "../api/authService";
import { checkIsAdmin } from "../api/accountService";

const AuthContext = createContext(null);

const TOKEN_KEY = "servas_token";
const PROVIDER_KEY = "servas_provider";
const ADMIN_KEY = "servas_is_admin";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [provider, setProvider] = useState(() => {
    const raw = localStorage.getItem(PROVIDER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem(ADMIN_KEY) === "1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  useEffect(() => {
    if (provider) localStorage.setItem(PROVIDER_KEY, JSON.stringify(provider));
    else localStorage.removeItem(PROVIDER_KEY);
  }, [provider]);

  // HU-004 · Inicio de sesión
  const login = useCallback(async (credentials) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await loginRequest(credentials);
      // El token debe estar guardado antes de preguntar el rol (el interceptor lo lee de localStorage).
      localStorage.setItem(TOKEN_KEY, data.token);
      // HU-042: el login no informa el rol; se detecta probando /admin/overview.
      const admin = await checkIsAdmin();
      localStorage.setItem(ADMIN_KEY, admin ? "1" : "0");
      setIsAdmin(admin);
      setToken(data.token);
      setProvider(data.provider ?? null);
      return { ...data, isAdmin: admin };
    } catch (err) {
      setError(err.friendlyMessage || "No se pudo iniciar sesión.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // HU-005 · Cierre de sesión
  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setToken(null);
      setProvider(null);
      setIsAdmin(false);
      localStorage.removeItem(ADMIN_KEY);
    }
  }, []);

  const value = {
    token,
    provider,
    isAuthenticated: Boolean(token),
    isAdmin: Boolean(token) && isAdmin,
    loading,
    error,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
