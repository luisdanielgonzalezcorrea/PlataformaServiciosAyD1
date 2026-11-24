import { Link } from "react-router-dom";

/**
 * Pie de página: qué es el sitio, enlaces útiles y datos del proyecto académico.
 * Para poner el nombre del docente, edita SUPERVISION.
 */
const SUPERVISION = "docentes de CodeF@ctory, Universidad de Antioquia";

const NAV = [
  ["Catálogo de servicios", "/"],
  ["Mis reservas", "/mis-reservas"],
  ["Mis datos de contacto", "/mis-datos"],
];
const PROVIDERS = [
  ["Portal proveedores", "/login"],
  ["Crear cuenta de proveedor", "/registro"],
  ["Recuperar contraseña", "/olvide-contrasena"],
  ["Verificar correo", "/verificar-correo"],
];

export default function Footer() {
  return (
    <footer className="footer" aria-label="Información de la plataforma">
      <div className="footer__inner">
        <div className="footer__brand">
          <p className="footer__logo">agenda<span>.co</span></p>
          <p className="footer__text">
            Plataforma de reservas de servicios: encuentra un servicio en tu comuna, mira los horarios libres y agenda en minutos.
          </p>
          <p className="footer__badge">Proyecto académico</p>
        </div>

        <nav className="footer__col" aria-label="Para clientes">
          <h2>Clientes</h2>
          <ul>{NAV.map(([t, to]) => <li key={to}><Link to={to}>{t}</Link></li>)}</ul>
        </nav>

        <nav className="footer__col" aria-label="Para proveedores">
          <h2>Proveedores</h2>
          <ul>{PROVIDERS.map(([t, to]) => <li key={to}><Link to={to}>{t}</Link></li>)}</ul>
        </nav>

        <div className="footer__col">
          <h2>Sobre el proyecto</h2>
          <p className="footer__text">
            Caso 14 · Fábrica escuela, nivel básico. Proyecto conjunto de tres cursos de{" "}
            <strong>Ingeniería de Sistemas</strong> de la Universidad de Antioquia:
          </p>
          <ul className="footer__courses">
            <li>Análisis y Diseño de Sistemas 1</li>
            <li>Análisis y Diseño de Sistemas 2</li>
            <li>Gestión de Proyectos</li>
          </ul>
          <p className="footer__text"><strong>Supervisado por</strong> {SUPERVISION}.</p>
        </div>
      </div>

      <div className="footer__legal">
        <p>
          © {new Date().getFullYear()} agenda.co · Proyecto con fines educativos, sin fines comerciales. No presta servicios reales:
          los negocios y las reservas son de práctica. Te recomendamos no ingresar datos personales reales.
        </p>
      </div>
    </footer>
  );
}
