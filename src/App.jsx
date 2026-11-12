import { Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";
import CatalogPage from "./pages/CatalogPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import LoginPage from "./pages/LoginPage";
import CompanyPage from "./pages/CompanyPage";
import ServiceDetailPage from "./pages/ServiceDetailPage";
import ReservePage from "./pages/ReservePage";
import ReservationConfirmedPage from "./pages/ReservationConfirmedPage";
import MyReservationsPage from "./pages/MyReservationsPage";
import AgendaPage from "./pages/AgendaPage";
import MyServicesPage from "./pages/MyServicesPage";
import EditServicePage from "./pages/EditServicePage";
import ProviderReservationsPage from "./pages/ProviderReservationsPage";
import ReportsPage from "./pages/ReportsPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import EditCompanyPage from "./pages/EditCompanyPage";
import ReservationDetailPage from "./pages/ReservationDetailPage";
import ClientContactPage from "./pages/ClientContactPage";
import RecoverEmailPage from "./pages/RecoverEmailPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminProvidersPage from "./pages/AdminProvidersPage";

export default function App() {
  return (
    <div className="app">
      <Header />
      <main className="app__main">
        <Routes>
          {/* HU-008 / HU-009 · Catálogo y detalle de servicio */}
          <Route path="/" element={<CatalogPage />} />

          {/* HU-001 · Registro de proveedor */}
          <Route path="/registro" element={<RegisterPage />} />

          {/* HU-002 · Verificación del correo electrónico */}
          <Route path="/verificar-correo" element={<VerifyEmailPage />} />

          {/* HU-004 · Inicio de sesión */}
          <Route path="/login" element={<LoginPage />} />

          {/* HU-003 · Datos de compañía (requiere sesión) */}
          <Route
            path="/negocio"
            element={
              <ProtectedRoute>
                <CompanyPage />
              </ProtectedRoute>
            }
          />

          {/* HU-009 / HU-018 / HU-019 / HU-020 · Detalle del servicio con calendario */}
          <Route path="/servicio/:id" element={<ServiceDetailPage />} />

          {/* HU-021 a HU-028 · Proceso de reserva (Fecha y hora · Tus datos · Verificación) */}
          <Route path="/servicio/:id/reservar" element={<ReservePage />} />

          {/* HU-029 · Confirmación de la reserva */}
          <Route path="/reserva-confirmada" element={<ReservationConfirmedPage />} />

          {/* HU-025 / HU-026 · Reservas activas del cliente */}
          <Route path="/mis-reservas" element={<MyReservationsPage />} />

          {/* HU-013 / HU-014 · Agenda del proveedor (requiere sesión) */}
          <Route
            path="/agenda"
            element={
              <ProtectedRoute>
                <AgendaPage />
              </ProtectedRoute>
            }
          />

          {/* Sprint 3 · Recuperación de contraseña (HU-006) */}
          <Route path="/olvide-contrasena" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Sprint 3 · Proveedor */}
          <Route path="/negocio/editar" element={<ProtectedRoute><EditCompanyPage /></ProtectedRoute>} />
          <Route path="/mis-servicios" element={<ProtectedRoute><MyServicesPage /></ProtectedRoute>} />
          <Route path="/mis-servicios/:id/editar" element={<ProtectedRoute><EditServicePage /></ProtectedRoute>} />
          <Route path="/reservas" element={<ProtectedRoute><ProviderReservationsPage /></ProtectedRoute>} />
          <Route path="/reportes" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/bloqueos" element={<Navigate to="/agenda" replace />} />

          {/* Sprint 3 · Cliente (030 a 034, 041, 045) */}
          <Route path="/mis-reservas/:id" element={<ReservationDetailPage />} />
          <Route path="/mis-datos" element={<ClientContactPage />} />
          <Route path="/recuperar-correo" element={<RecoverEmailPage />} />

          {/* Sprint 3 · Administración (042 a 044) */}
          <Route path="/admin" element={<ProtectedRoute admin><AdminDashboardPage /></ProtectedRoute>} />
          <Route path="/admin/proveedores" element={<ProtectedRoute admin><AdminProvidersPage /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}
