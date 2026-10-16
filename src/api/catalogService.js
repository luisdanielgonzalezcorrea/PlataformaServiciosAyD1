import { httpClient, USE_MOCKS, wait, apiError } from "./httpClient";
import {
  mockServices, mockComunas, mockCategories, findMockServiceById,
} from "../mocks/servicesMock";

/**
 * HU-005 · Crear un nuevo servicio
 * POST /services (snake_case en el body; la respuesta viene en camelCase)
 * Campos obligatorios en el back: company_id, name, modality, category, cost,
 * duration_minutes, capacity.
 */
export async function createService(serviceData) {
  if (USE_MOCKS) {
    await wait(300);
    const created = {
      id: `mock-svc-${Date.now()}`,
      companyId: serviceData.company_id,
      companyName: "Mi negocio",
      comunaId: serviceData.comuna_id ?? null,
      comunaName: null,
      name: serviceData.name,
      modality: serviceData.modality,
      category: serviceData.category,
      cost: serviceData.cost,
      durationMinutes: serviceData.duration_minutes,
      capacity: serviceData.capacity,
      description: serviceData.description,
      recommendations: serviceData.recommendations,
      startDate: serviceData.start_date ?? null,
      endDate: serviceData.end_date ?? null,
      isActive: true,
    };
    mockServices.push(created);
    return { status: 201, data: created };
  }

  const { data } = await httpClient.post("/services", serviceData);
  return { status: 201, data };
}

/**
 * HU-013 · Editar la vigencia del servicio (fecha inicio / fin)
 * PUT /services/{id} con start_date y end_date. El resto de campos son opcionales
 * en el back, así que mandamos solo lo que cambia.
 */
export async function updateServiceRange(id, { startDate, endDate }) {
  if (USE_MOCKS) {
    await wait(300);
    const svc = findMockServiceById(id);
    if (!svc) throw apiError("SERVICE_NOT_FOUND", "Servicio no encontrado.", 404);
    svc.startDate = startDate || null;
    svc.endDate = endDate || null;
    return { status: 200, data: { ...svc } };
  }

  const { data } = await httpClient.put(`/services/${id}`, {
    start_date: startDate || null,
    end_date: endDate || null,
  });
  return { status: 200, data };
}

/**
 * HU-008 · Selección de servicio (catálogo)
 * GET /services?companyId&comunaId&modality&category&q&page&size
 * El back responde una página: { items, page, size, totalElements, totalPages }.
 * Acá devolvemos data = items (array) y pageInfo aparte, para no tocar las vistas.
 */
export async function getServices(filters = {}) {
  const { comunaId, modality, category, q, companyId, page = 0, size = 50 } = filters;

  if (USE_MOCKS) {
    await wait();
    let results = mockServices.filter((s) => s.isActive);
    if (companyId) results = results.filter((s) => s.companyId === companyId);
    if (comunaId) results = results.filter((s) => s.comunaId === Number(comunaId));
    if (modality) results = results.filter((s) => s.modality === modality);
    if (category) results = results.filter((s) => s.category === category);
    if (q) {
      const term = q.toLowerCase();
      results = results.filter(
        (s) => s.name.toLowerCase().includes(term) || s.companyName.toLowerCase().includes(term)
      );
    }
    return {
      status: 200,
      data: results,
      pageInfo: { page: 0, size: results.length, totalElements: results.length, totalPages: 1 },
    };
  }

  const params = { page, size };
  if (comunaId) params.comunaId = comunaId;
  if (modality) params.modality = modality;
  if (category) params.category = category;
  if (companyId) params.companyId = companyId;
  if (q) params.q = q;

  const { data } = await httpClient.get("/services", { params });
  const { items = [], ...pageInfo } = data;
  return { status: 200, data: items, pageInfo };
}

/**
 * HU-009 · Detalle del servicio
 * GET /services/{id}
 */
export async function getServiceById(id) {
  if (USE_MOCKS) {
    await wait(250);
    const service = findMockServiceById(id);
    if (!service) throw apiError("SERVICE_NOT_FOUND", "El servicio solicitado no existe.", 404);
    return { status: 200, data: { ...service } };
  }

  const { data } = await httpClient.get(`/services/${id}`);
  return { status: 200, data };
}

/**
 * Servicios del negocio del proveedor (para la pantalla de agenda).
 * No hay un endpoint "mis servicios", así que filtramos el catálogo por companyId.
 */
export async function getServicesByCompany(companyId) {
  return getServices({ companyId, size: 100 });
}

/**
 * Listado maestro de comunas de Medellín, usado como filtro del catálogo.
 * GET /comunas
 */
export async function getComunas() {
  if (USE_MOCKS) {
    await wait(150);
    return { status: 200, data: mockComunas };
  }

  const { data } = await httpClient.get("/comunas");
  return { status: 200, data };
}

/**
 * GET /categories -> [{ code, label }]
 */
export async function getCategories() {
  if (USE_MOCKS) {
    await wait(100);
    return { status: 200, data: mockCategories };
  }

  const { data } = await httpClient.get("/categories");
  return { status: 200, data };
}
