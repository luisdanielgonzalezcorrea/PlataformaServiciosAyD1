import { httpClient, USE_MOCKS } from "./httpClient";

function wait(ms = 500) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_LOGO_SIZE_MB = 2;

export function validateLogoFile(file) {
  if (!file) return null; // el logo es opcional
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return "Formato no permitido. Usa PNG, JPG o WEBP.";
  }
  if (file.size > MAX_LOGO_SIZE_MB * 1024 * 1024) {
    return `El archivo supera el tamaño máximo permitido (${MAX_LOGO_SIZE_MB}MB).`;
  }
  return null;
}

// El NIT solo se envía al crear: el contrato de PUT /companies/{id} no lo admite (no se edita).
function buildCompanyFormData(company, { includeNit = true } = {}) {
  const formData = new FormData();
  if (includeNit) formData.append("nit", company.nit);
  formData.append("name", company.name);
  if (company.description) formData.append("description", company.description);
  formData.append("address", company.address);
  if (company.social_media) formData.append("social_media", company.social_media);
  if (company.logo instanceof File) formData.append("logo", company.logo);
  return formData;
}

/**
 * HU-003 · Obtener empresa asociada al usuario autenticado
 * El back no tiene /companies/me: GET /companies devuelve la lista de negocios
 * del proveedor logueado y nosotros tomamos el primero.
 */
export async function getMyCompany() {
  if (USE_MOCKS) {
    await wait();
    return {
      status: 200,
      data: { id: "c-001", name: "Empresa Mock" },
    };
  }

  const { data } = await httpClient.get("/companies");
  const first = Array.isArray(data) ? data[0] : null;
  if (!first) throw { friendlyMessage: "Aún no tienes un negocio registrado.", status: 404 };
  return { status: 200, data: first };
}

/**
 * HU-003 · Registrar negocio
 * POST /companies (multipart/form-data)
 * requiere: nit, name, address. opcionales: description, social_media, logo
 */
export async function createCompany(company) {
  const logoError = validateLogoFile(company.logo);
  if (logoError) throw { friendlyMessage: logoError };

  if (USE_MOCKS) {
    await wait();
    if (!company.nit || !company.name || !company.address) {
      throw { friendlyMessage: "Completa los campos obligatorios del negocio." };
    }
    return {
      status: 201,
      data: { id: "c-001", ...company, logo: company.logo?.name ?? null },
    };
  }

  const formData = buildCompanyFormData(company);
  const { data } = await httpClient.post("/companies", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return { status: 201, data };
}

/**
 * HU-003 · Editar datos del negocio
 * PUT /companies/{id} (multipart/form-data)
 */
export async function updateCompany(id, company) {
  const logoError = validateLogoFile(company.logo);
  if (logoError) throw { friendlyMessage: logoError };

  if (USE_MOCKS) {
    await wait();
    return { status: 200, data: { id, ...company, logo: company.logo?.name ?? null } };
  }

  const formData = buildCompanyFormData(company, { includeNit: false });
  const { data } = await httpClient.put(`/companies/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return { status: 200, data };
}
