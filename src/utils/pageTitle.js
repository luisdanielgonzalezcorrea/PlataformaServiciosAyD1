const SUFFIX = "agenda.co";
const TITLES = [
  [/^\/$/, "Catálogo de servicios"],
  [/^\/registro/, "Crear cuenta de proveedor"],
  [/^\/verificar-correo/, "Verifica tu correo"],
  [/^\/login/, "Iniciar sesión"],
  [/^\/olvide|^\/forgot|^\/recuperar-contrasena/, "Recuperar contraseña"],
  [/^\/reset-password|^\/restablecer/, "Nueva contraseña"],
  [/^\/negocio/, "Mi negocio"],
  [/^\/servicio\/[^/]+\/reservar/, "Reservar servicio"],
  [/^\/servicio\/[^/]+\/confirmada|^\/reserva-confirmada|^\/confirmacion/, "Reserva confirmada"],
  [/^\/servicio\//, "Detalle del servicio"],
  [/^\/mis-reservas\/[^/]+/, "Detalle de la reserva"],
  [/^\/mis-reservas/, "Mis reservas"],
  [/^\/mis-datos/, "Mis datos de contacto"],
  [/^\/agenda|^\/bloqueos/, "Mi agenda"],
  [/^\/mis-servicios/, "Mis servicios"],
  [/^\/reservas/, "Reservas de mis servicios"],
  [/^\/reportes/, "Reportes"],
  [/^\/admin\/proveedores/, "Proveedores"],
  [/^\/admin/, "Panel de administración"],
];

export function titleFor(pathname) {
  const hit = TITLES.find(([re]) => re.test(pathname));
  return hit ? `${hit[1]} · ${SUFFIX}` : `Página no encontrada · ${SUFFIX}`;
}
