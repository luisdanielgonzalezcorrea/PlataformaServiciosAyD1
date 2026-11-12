import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Rutas del proveedor. `admin` limita la ruta al rol administrador (HU-042 a HU-044):
 * quien entra por URL directa sin el rol vuelve a su propio portal.
 */
export default function ProtectedRoute({ children, admin = false }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (admin && !isAdmin) return <Navigate to="/negocio" replace />;
  if (!admin && isAdmin) return <Navigate to="/admin" replace />;
  return children;
}
