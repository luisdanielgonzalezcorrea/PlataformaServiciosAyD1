import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { watchInactivity } from "../utils/inactivity";

/** Cierra la sesión del proveedor/admin tras 3 minutos sin actividad y lo manda a /login. */
export default function InactivityGuard() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    return watchInactivity(async () => {
      try { await logout(); } catch { /* la sesión local se limpia igual */ }
      navigate("/login?inactive=1", { replace: true });
    });
  }, [isAuthenticated, logout, navigate]);

  return null;
}
