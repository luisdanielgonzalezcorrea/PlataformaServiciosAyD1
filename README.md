# Front - Plataforma de Reservas de Servicios (Sprint 2)

Front del Caso 14 hecho en React con Vite. En el Sprint 1 quedó el registro y login de
proveedores, el negocio y el catálogo. En este sprint agregamos lo de agendas y disponibilidad
(Épica 3) y el proceso de reserva del cliente (Épica 4). Lo hicimos encima del código que ya está
desplegado en GitHub.

## Historias de usuario del sprint

| HU | Título | Dónde está | Endpoint |
|----|--------|-----------|----------|
| 013 | Creación de agenda | `/agenda`, tarjeta "Vigencia del servicio" (también al crear el servicio) | `PUT /services/{id}` |
| 014 | Día y horario de atención | `/agenda`, "Días y horarios de atención" | `PUT /services/{id}/schedules` |
| 018 | Visualización de disponibilidad | `/servicio/:id` y paso 1 de la reserva | `GET /services/{id}/availability` |
| 019 | Estado de disponibilidad | Mismo calendario, con leyenda de colores | igual que la 018 |
| 020 | Horarios disponibles | Debajo del calendario | `GET /services/{id}/availability` |
| 021 | Inicio de reserva | Botón "Reservar" del detalle | `GET /services/{id}` |
| 022 | Selección de fecha | Paso 1, "Fecha y hora" | `GET /services/{id}/availability` |
| 023 | Selección de horario | Paso 1, "Fecha y hora" | `GET /services/{id}/availability` |
| 024 | Ingreso de datos del cliente | Paso 2, "Tus datos" | ninguno, se valida en el front |
| 025 | Validación de documento | Paso 2 y `/mis-reservas` | `POST /client/auth/otp`, `POST /client/auth/session`, `GET /clients/me` |
| 026 | Consulta de reservas activas | Paso 2 y `/mis-reservas` | `GET /reservations/client/{documento}`, `PATCH /reservations/{id}/cancel` |
| 027 | Confirmación de datos | Paso 3, "Verificación" (resumen) | ninguno |
| 028 | Registro de reserva | Paso 3, "Verificación" | `POST /reservations` |
| 029 | Confirmación de registro | Código por correo y pantalla `/reserva-confirmada` | `POST /reservations/{id}/confirm` |

Cada página o servicio tiene un comentario arriba con la HU que implementa.

## Cómo correrlo

Necesitan Node.js (versión LTS). Después:

```bash
npm install
cp .env.example .env
npm run dev
```

En Windows, en vez de `cp` es `copy .env.example .env`. Abre en http://localhost:5173.

## Mocks o back real

En `src/api` cada llamada tiene una versión simulada, así se puede probar el front sin el back.
Se cambia en el `.env`:

- `VITE_USE_MOCKS=true`: datos en memoria. El código OTP siempre es `123456`. Para entrar como
  proveedor sirve `demo@agenda.co` con cualquier clave de 8 o más caracteres. Para ver reservas
  como cliente: documento `1234567890` (CC) y correo `cliente@demo.co`.
- `VITE_USE_MOCKS=false`: usa el back de verdad en `VITE_API_BASE_URL`, que por defecto es
  `http://localhost:8080` (sin `/api`, el back no lo usa).

En los mocks "Clase de yoga personalizada" no tiene agenda, para ver el botón Reservar
deshabilitado. "Consulta psicológica" tiene un día agotado y otro a medias.

### Con el back

1. En la carpeta del back: `docker compose up -d`.
2. Poner `VITE_USE_MOCKS=false` en el `.env` del front y reiniciar.
3. Los códigos que se mandan por correo (registro, confirmación de reserva, sesión del cliente)
   se leen en Mailpit: http://localhost:8025.
4. Si el front corre en un origen distinto de `localhost:5173` o `localhost:3000`, hay que
   agregarlo en `CORS_ALLOWED_ORIGINS` del back.

Ojo: lo probamos completo en modo mock. Contra el back leímos los controladores para armar las
rutas y los cuerpos, pero falta una prueba de punta a punta con todo levantado.

## Cómo funciona la reserva con el back

La reserva se hace en dos llamadas. Primero `POST /reservations` la crea como `PENDING`, bloquea
el horario 15 minutos y manda un código de 6 dígitos al correo. Después
`POST /reservations/{id}/confirm` con ese código la deja `CONFIRMED`.

Por eso en el paso 3 ("Verificación") está el resumen con el botón "Confirmar reserva" y, cuando
se registra, aparece el campo del código con el tiempo que queda. Si se acaba el tiempo, el back
libera el horario y el front devuelve al cliente al calendario.

El cliente tiene una sesión corta aparte del proveedor (30 minutos, con código al correo y
documento). La usamos para traer sus datos, ver sus reservas activas y cancelar. Se guarda en
`sessionStorage`.

## Qué cambiamos del Sprint 1 al revisar el back

- La URL base tenía `/api` y el back no lo usa.
- El catálogo mandaba `comuna_id` y esperaba un arreglo. El back usa `comunaId`, `q`, `category`
  y responde paginado (`items`, `page`, `size`, `totalElements`, `totalPages`).
- El login del back devuelve `{ token, userId, email }`, no `provider`.
- La verificación del correo manda `otp_code`, no `otpCode`.
- No existe `GET /companies/me`, usamos `GET /companies` y tomamos la primera.
- `ServicePage` llamaba funciones que no existían y no mandaba `category` ni `capacity`, que el
  back pide. Ya quedó y le agregamos las fechas de vigencia.
- Los mocks del catálogo ahora tienen la misma forma que responde el back.

## Pendientes con el back

Más detalle en `PENDIENTES-BACK.md`.

1. El back solo da disponibilidad por día, no por mes. Para pintar el calendario hacemos una
   consulta por cada día del mes (con caché). "Parcialmente ocupado" lo sacamos comparando con
   el día de la semana que más horarios libres tenga, porque no sabemos cuántos cupos tenía el día.
2. No hay GET de los horarios ya guardados, así que el proveedor no ve lo que configuró antes.
3. El back solo manda el correo con el código. La HU-029 pide un correo de confirmación con el
   código de reserva, el servicio, la fecha y la hora.
4. No hay código de reserva aparte. Mostramos `RSV-` más los primeros 8 caracteres del id.
5. La reserva no trae el nombre del proveedor, lo sacamos del detalle del servicio.
6. No hay forma de reenviar el código de la reserva.
7. La HU-013 pide que la fecha fin sea mayor que la de inicio, pero el back deja que sean iguales.
   En el front lo validamos estricto.
8. Una fecha de vigencia ya guardada no se puede borrar, porque el back toma null como "no cambiar".

## Carpetas

```
src/
  api/          llamadas al back y su versión mock
  components/   Header, ProtectedRoute, AvailabilityPicker (calendario),
                ClientVerification, ActiveReservations
  context/      AuthContext (sesión del proveedor)
  mocks/        catálogo y datos en memoria de agendas y reservas
  pages/        una página por flujo
  styles/       CSS
  utils/        dates.js y validation.js
```

## Build

`npm run build` deja todo en `dist/`. Si lo suben a GitHub Pages, al recargar en una ruta como
`/servicio/...` da 404 porque el router usa rutas normales. Se arregla con un fallback a
`index.html` o cambiando a `HashRouter`.
