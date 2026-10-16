import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { login as loginRequest, logout as logoutRequest } from "../api/authService";

const AuthContext = createContext(null);

const TOKEN_KEY = "servas_token";
const PROVIDER_KEY = "servas_provider";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [provider, setProvider] = useState(() => {
    const raw = localStorage.getItem(PROVIDER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
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
      setToken(data.token);
      setProvider(data.provider ?? null);
      return data;
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
    }
  }, []);

  const value = {
    token,
    provider,
    isAuthenticated: Boolean(token),
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
