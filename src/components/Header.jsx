import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { getMyCompany } from "../api/companyService";
import { useAuth } from "../context/AuthContext";
import { LogoMark } from "./Icons";

const navClass = ({ isActive }) => `header__link${isActive ? " header__link--on" : ""}`;

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h5v-6h4v6h5V10" />
    </svg>
  );
}

export default function Header() {
  const { isAuthenticated, isAdmin, provider, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [businessName, setBusinessName] = useState(null);

  // Nombre del negocio del proveedor (se vuelve a pedir al cambiar de pantalla, por si lo editó).
  useEffect(() => {
    if (!isAuthenticated || isAdmin) { setBusinessName(null); return undefined; }
    let alive = true;
    getMyCompany().then((r) => { if (alive) setBusinessName(r.data?.name || null); }).catch(() => { if (alive) setBusinessName(null); });
    return () => { alive = false; };
  }, [isAuthenticated, isAdmin, pathname]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="header">
      <Link to="/" className="header__brand">
        <LogoMark size={30} />
        <span className="header__name">
          agenda<span className="header__tld">.co</span>
        </span>
      </Link>

      <nav className="header__actions" aria-label="Principal">
        <NavLink to="/" end className={navClass}><HomeIcon /> Inicio</NavLink>
        {isAuthenticated ? (
          <>
            {isAdmin ? (
              <>
                <NavLink to="/admin" className={navClass}>Panel</NavLink>
                <NavLink to="/admin/proveedores" className={navClass}>Proveedores</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/negocio" className={navClass}>Mi negocio</NavLink>
                <NavLink to="/mis-servicios" className={navClass}>Mis servicios</NavLink>
                <NavLink to="/agenda" className={navClass}>Mi agenda</NavLink>
                <NavLink to="/reservas" className={navClass}>Reservas</NavLink>
                <NavLink to="/reportes" className={navClass}>Reportes</NavLink>
              </>
            )}
            <span className="header__provider">
              <strong>{isAdmin ? "Administrador" : businessName || "Mi cuenta"}</strong>
              <small>{provider?.email}</small>
            </span>
            <button className="btn btn--ghost" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <NavLink to="/mis-reservas" className={navClass}>
              Mis reservas
            </NavLink>
            <Link to="/login" className="btn btn--ghost">
              Portal proveedores
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
