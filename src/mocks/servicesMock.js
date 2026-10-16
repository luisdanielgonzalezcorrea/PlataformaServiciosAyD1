// Datos de ejemplo con la misma forma que devuelve el back (ServiceView, camelCase).
// Sirven para correr el front sin backend (VITE_USE_MOCKS=true).

export const mockServices = [
  {
    id: "b1a1c2d3-0001-0000-0000-000000000001",
    companyId: "c-001",
    companyName: "Mente Clara",
    comunaId: null,
    comunaName: null,
    name: "Consulta psicológica",
    modality: "VIRTUAL",
    category: "SALUD",
    cost: 85000,
    durationMinutes: 60,
    capacity: 1,
    description:
      "Espacio de escucha profesional para trabajar ansiedad, estrés y bienestar emocional.",
    recommendations: "Ideal para mayores de 18 años. No necesitas experiencia previa.",
    startDate: null,
    endDate: null,
    isActive: true,
  },
  {
    id: "b1a1c2d3-0002-0000-0000-000000000002",
    companyId: "c-002",
    companyName: "Estudio Norte",
    comunaId: 12,
    comunaName: "El Poblado",
    name: "Asesoría legal laboral",
    modality: "PRESENCIAL",
    category: "PROFESIONALES",
    cost: 120000,
    durationMinutes: 60,
    capacity: 1,
    description:
      "Orientación legal personalizada sobre contratos, liquidaciones y derechos laborales.",
    recommendations: "Trae contigo el contrato o documento relacionado con tu caso.",
    startDate: null,
    endDate: null,
    isActive: true,
  },
  {
    // Este no tiene agenda configurada: sirve para probar HU-021 (Reservar deshabilitado).
    id: "b1a1c2d3-0003-0000-0000-000000000003",
    companyId: "c-003",
    companyName: "Casa Respira",
    comunaId: 13,
    comunaName: "Envigado",
    name: "Clase de yoga personalizada",
    modality: "PRESENCIAL",
    category: "BELLEZA_BIENESTAR",
    cost: 65000,
    durationMinutes: 60,
    capacity: 1,
    description: "Sesión individual adaptada a tu nivel y objetivos de bienestar físico.",
    recommendations: "Usa ropa cómoda. Trae tu propio tapete si tienes uno.",
    startDate: null,
    endDate: null,
    isActive: true,
  },
  {
    id: "b1a1c2d3-0004-0000-0000-000000000004",
    companyId: "c-004",
    companyName: "Taller Croma",
    comunaId: null,
    comunaName: null,
    name: "Diseño de identidad visual",
    modality: "VIRTUAL",
    category: "TECNOLOGIA",
    cost: 250000,
    durationMinutes: 90,
    capacity: 1,
    description:
      "Sesión de trabajo para definir logo, paleta de color y lineamientos básicos de marca.",
    recommendations: null,
    startDate: null,
    endDate: null,
    isActive: true,
  },
];

export const mockComunas = [
  { id: 11, name: "Laureles" },
  { id: 12, name: "El Poblado" },
  { id: 13, name: "Envigado" },
  { id: 14, name: "Belén" },
];

export const mockCategories = [
  { code: "SALUD", label: "Salud" },
  { code: "BELLEZA_BIENESTAR", label: "Belleza y bienestar" },
  { code: "EDUCACION", label: "Educación" },
  { code: "HOGAR", label: "Hogar" },
  { code: "VEHICULOS", label: "Vehículos" },
  { code: "PROFESIONALES", label: "Profesionales" },
  { code: "EVENTOS", label: "Eventos" },
  { code: "MASCOTAS", label: "Mascotas" },
  { code: "TECNOLOGIA", label: "Tecnología" },
  { code: "OTRO", label: "Otro" },
];

export function findMockServiceById(id) {
  return mockServices.find((service) => service.id === id) || null;
}
