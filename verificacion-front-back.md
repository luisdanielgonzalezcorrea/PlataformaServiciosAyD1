# Verificación front contra back (Sprint 3) - 22 de noviembre de 2026

## Qué se comprobó y cómo
- **Contratos:** 34 pruebas de contrato (antes 24) llaman a cada función del front sin mocks y comparan ruta, método, query, cuerpo (snake_case), campos obligatorios y token contra el Swagger nuevo. Resultado: todas pasan. Total de pruebas: 73 de 73.
- **Endpoints:** el Swagger tiene 51 operaciones; el front usa 47. Ninguna llamada del front apunta a una ruta que no exista. Sin uso: `GET /companies/{id}`, `GET /uploads/logos/{file}` (se usa directo la URL del logo), `POST /reservations/{id}/resend` y `POST /services/{id}/schedules` (el front usa `PUT`, que reemplaza toda la agenda).
- **Nombres de parámetros contra el código Java** (no solo el Swagger): `/provider/services` recibe `companyId` (camelCase) y `/blocked-dates` recibe `company_id`, `service_id`, `from_date`, `to_date` (snake_case). El front manda exactamente eso.
- **No se pudo probar contra Render** desde el entorno de trabajo (sin salida a esa dirección). La prueba de punta a punta contra el back real la tiene que hacer Luis Daniel.

## Cambios hechos hoy
1. Login: el front usa el `role` (PROVIDER | ADMIN) que ya devuelve el back, en vez de probar `/admin/overview`. Si un back viejo no lo envía, usa la prueba anterior.
2. Mis servicios: usa `GET /provider/services` (activos e inactivos) y deja el registro local solo como respaldo si el endpoint no existe.
3. Bloqueo de fechas: lista las fechas bloqueadas (`GET /blocked-dates`) y permite quitarlas (`DELETE /blocked-dates/{id}`).
4. Logo del negocio: el back solo acepta PNG y JPEG (`LogoStorage`), así que el front dejó de ofrecer WEBP, que habría dado error 415.
5. Registro de proveedor: cuerpo en snake_case y fecha de nacimiento opcional.
6. Contratos del front actualizados con el Swagger nuevo.

## Estado por HU
| HU | Pantalla | Endpoint | Estado |
|---|---|---|---|
| 006 Recuperar contraseña | /olvide-contrasena, /reset-password | POST /auth/forgot-password, /auth/password/reset | Completa |
| 040 Editar negocio | /negocio/editar | PUT /companies/{id} | Completa |
| 045 Cambio de correo (pérdida) | /recuperar-correo | POST /client/auth/email-recovery y /confirm | Completa |
| 010 Mis servicios | /mis-servicios | GET /provider/services | Completa |
| 011 Editar servicio | /mis-servicios/:id/editar | PUT /services/{id} | Completa |
| 012 Activar/desactivar | /mis-servicios | PATCH /services/{id}/status | Completa (la desactivación programada se resuelve con bloqueo de fechas o cierre de vigencia) |
| 016 Modificar horarios | /agenda | PUT /services/{id}/schedules | Completa |
| 017 Bloqueo de fechas | /agenda | POST/GET/DELETE /blocked-dates | Completa |
| 030 Consultar por identificación | /mis-reservas | OTP de cliente + GET /reservations/client/{doc} | Completa |
| 031 Listado de mis reservas | /mis-reservas | GET /reservations/client/{doc} | Completa |
| 032 Detalle de reserva | /mis-reservas/:id | GET /reservations/{id} | Completa |
| 033 Modificar reserva | /mis-reservas/:id | PUT /reservations/{id} | Completa |
| 034 Cancelar reserva | /mis-reservas/:id | PATCH /reservations/{id}/cancel | Completa |
| 035 Reservas del proveedor | /reservas | GET /provider/reservations | Completa |
| 036 Estado de las reservas | /reservas | GET /provider/reservations?status | Completa |
| 037 Disponibilidad automática | selector de horarios | GET /services/{id}/availability | Completa (el selector se refresca cada 60 s) |
| 038 Reporte de reservas | /reportes | GET /reports/reservations | Completa |
| 039 Reporte de ocupación | /reportes | GET /reports/occupancy | **Parcial:** el back da la ocupación por servicio (reservados/capacidad/%), no por cada horario |
| 040 (demanda) Reporte de demanda | /reportes | GET /reports/demand | Completa |
| 041 Cambio de contacto del cliente | /mis-datos | POST /clients/me/contact/verification, PATCH /clients/me/contact | Completa |
| 042 Resumen de la plataforma | /admin | GET /admin/overview | **Parcial:** el back entrega totales; faltan las series por día/semana/mes para los gráficos |
| 043 Listado de proveedores | /admin/proveedores | GET /admin/providers | **Parcial:** el back no devuelve NIT, categoría ni comuna; búsqueda por nombre/correo y filtro por estado se hacen en el front; el detalle no lista los servicios del proveedor |
| 044 Restablecer contraseña y contacto | /admin/proveedores (detalle) | POST …/password-reset, PATCH …/contact | Completa |

Nota: en el PDF del Sprint 3 el reporte de demanda y el de reservas comparten numeración con otras HU; la tabla sigue los títulos del PDF.

## Pendientes para BACK
1. `PUT /companies/{id}`: aceptar WEBP en el logo (HU-040 criterio 2).
2. `/reports/occupancy`: devolver el detalle por horario con cupos ocupados y disponibles (HU-039).
3. `/admin/overview`: series de reservas por período (HU-042 criterio 2).
4. `/admin/providers`: agregar NIT, categoría y comuna, y un detalle con los servicios del proveedor (HU-043).
5. Swagger: documentar `POST /reservations/{id}/confirm`, las diferencias de nombres en `GET /services` y el formato real de `GET /services/{id}/availability`.