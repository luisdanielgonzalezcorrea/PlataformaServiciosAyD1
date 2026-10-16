import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogoMark } from "./Icons";

export default function Header() {
  const { isAuthenticated, provider, logout } = useAuth();
  const navigate = useNavigate();

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

      <nav className="header__actions">
        {isAuthenticated ? (
          <>
            <Link to="/negocio" className="header__link">
              Mi negocio
            </Link>
            <Link to="/agenda" className="header__link">
              Mi agenda
            </Link>
            <span className="header__provider">{provider?.email}</span>
            <button className="btn btn--ghost" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <Link to="/mis-reservas" className="header__link">
              Mis reservas
            </Link>
            <Link to="/login" className="btn btn--ghost">
              Portal proveedores
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
