import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ServicePage from "./ServicePage";
import { getComunas } from "../api/catalogService";
import { getMyCompany, createCompany } from "../api/companyService"; // Importamos createCompany

export default function CompanyPage() {
  const [companyId, setCompanyId] = useState(null);
  const [company, setCompany] = useState(null);
  const [comunas, setComunas] = useState([]);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Estado para registrar la Empresa
  const [companyData, setCompanyData] = useState({
    name: "",
    nit: "",
    phone: "",
    address: "",
  });

  // Carga automática al montar el componente
  useEffect(() => {
    async function loadInitialData() {
      setLoadingCompany(true);
      setError(null);
      try {
        const [comunasRes, companyRes] = await Promise.all([
          getComunas().catch(() => ({ data: [] })),
          getMyCompany().catch(() => null),
        ]);

        if (comunasRes?.data) setComunas(comunasRes.data);

        // Extrae el ID adecuadamente del backend
        const fetchedCompanyId = companyRes?.data?.id || companyRes?.id;
        if (fetchedCompanyId) {
          setCompanyId(fetchedCompanyId);
          setCompany(companyRes?.data || null);
        }
      } catch (err) {
        console.error("Error al cargar datos iniciales:", err);
      } finally {
        setLoadingCompany(false);
      }
    }
    loadInitialData();
  }, []);

  // Manejador para crear la Empresa
  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    setLoadingSubmit(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await createCompany(companyData);
      const createdCompanyId = res?.data?.id || res?.id;

      if (createdCompanyId) {
        setCompanyId(createdCompanyId);
        setSuccessMsg("¡Empresa registrada exitosamente! Ahora puedes agregar tus servicios.");
      } else {
        // En caso de que la respuesta sea un 200/201 simple, reconsultamos la empresa
        const companyRes = await getMyCompany();
        const refetchedId = companyRes?.data?.id || companyRes?.id;
        if (refetchedId) {
          setCompanyId(refetchedId);
          setSuccessMsg("¡Empresa registrada exitosamente!");
        } else {
          setError("Se creó la empresa pero no se pudo obtener su identificador.");
        }
      }
    } catch (err) {
      console.error("Error al crear la empresa:", err);
      setError(err?.friendlyMessage || "Error al intentar registrar la empresa.");
    } finally {
      setLoadingSubmit(false);
    }
  };

  if (loadingCompany) {
    return <p className="state muted">Cargando información del negocio…</p>;
  }

  // VISTA 1: SI NO TIENE EMPRESA CREADA
  if (!companyId) {
    return (
      <div className="auth-page">
        <form className="card form-card" onSubmit={handleCompanySubmit}>
          <h1>Registra tu negocio</h1>
          <p className="muted">
            Antes de agregar servicios al catálogo, cuéntanos los datos principales de tu empresa.
          </p>

          {error && <div className="alert alert--error">{error}</div>}
          {successMsg && <div className="alert alert--success">{successMsg}</div>}

          <div className="form-grid">
            <label className="field field--full">
              <span>Nombre de la empresa</span>
              <input
                type="text"
                required
                placeholder="Ej. Mi Negocio S.A.S."
                value={companyData.name}
                onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
              />
            </label>

            <label className="field">
              <span>NIT / RUT</span>
              <input
                type="text"
                required
                placeholder="Ej. 900123456-1"
                value={companyData.nit}
                onChange={(e) => setCompanyData({ ...companyData, nit: e.target.value })}
              />
            </label>

            <label className="field">
              <span>Teléfono de contacto</span>
              <input
                type="text"
                placeholder="Ej. 3001234567"
                value={companyData.phone}
                onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
              />
            </label>

            <label className="field field--full">
              <span>Dirección</span>
              <input
                type="text"
                placeholder="Ej. Calle 10 # 40-20"
                value={companyData.address}
                onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
              />
            </label>
          </div>

          <button type="submit" className="btn btn--primary" disabled={loadingSubmit}>
            {loadingSubmit ? "Registrando..." : "Registrar empresa"}
          </button>
        </form>
      </div>
    );
  }

  // VISTA 2: SI YA TIENE EMPRESA CREADA
  return <>
    <section className="biz-hero" aria-label="Mi negocio">
      <span className="biz-hero__mark" aria-hidden="true">{(company?.name || "N").trim().charAt(0).toUpperCase()}</span>
      <div className="biz-hero__info">
        <h1>{company?.name || "Mi negocio"}</h1>
        <p>{[company?.nit && `NIT ${company.nit}`, company?.address].filter(Boolean).join(" · ") || "Administra los datos de tu negocio."}</p>
      </div>
      <Link to="/negocio/editar" className="btn btn--primary biz-hero__cta">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        Editar datos del negocio
      </Link>
    </section>
    <ServicePage
    companyId={companyId}
    comunas={comunas}
    error={error}
    loadingSubmit={loadingSubmit}
    setLoadingSubmit={setLoadingSubmit}
    setError={setError}
    setSuccessMsg={setSuccessMsg}
    successMsg={successMsg}
  />
  </>;
}
