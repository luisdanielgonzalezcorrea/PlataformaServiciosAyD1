# Pruebas del front

`npm test` corre las pruebas de contrato. Las hicimos porque en el sprint 1 se nos fueron
errores por mandar camelCase cuando el back esperaba snake_case, y nos lo pidieron para
poder probar antes de entregar.

## Qué hacen
El front hace sus llamadas de verdad (sin mocks), pero un adaptador las intercepta y las compara
con `contracts/api-servas-swagger.yaml` (copia del Swagger del back):

- que la ruta y el método existan,
- que el cuerpo tenga los campos del contrato, con sus nombres exactos (snake_case) y los obligatorios,
- que los parámetros de query estén declarados,
- que las rutas protegidas lleven el Bearer token (proveedor o cliente según corresponda),
- que el front sepa leer las respuestas y los errores `{ code, message, fields }` (incluido el 429 con `Retry-After`).

## Cuando el back cambia
Copiar de nuevo `back/docs/api-servas-swagger.yaml` a `contracts/` y correr `npm test`.
Lo que falle es lo que hay que ajustar en el front (o avisarle a AyD2).

## Diferencias Swagger vs código que encontramos (pendientes de AyD2)
El front sigue lo que el código del back responde de verdad. Están marcadas en `tests/helpers/contract.js`
y `tests/contract.test.js`:

1. `GET /services`: el Swagger dice `comuna_id` y `company_id`; el controlador recibe `comunaId` y `companyId`.
2. `GET /services/{id}/availability`: el Swagger dice `[{start_time, end_time, available}]`; el back responde `[{startTime, endTime}]`.
3. `POST /reservations/{id}/confirm` existe en el controlador pero no está en el Swagger.
4. `POST /auth/login`: el Swagger no documenta el cuerpo de la respuesta (`{ token, userId, email }`).
5. README del back: dice que el cliente cancela "validando su documento", pero el código pide sesión de cliente por OTP.

## Límites
No prueban el back corriendo ni la UI; para eso está el recorrido manual contra el back desplegado.

## Prueba de integración real (front ↔ back)
Con el back corriendo en Docker (`docker compose up -d` en la carpeta del back) se corre:

```
npm run test:integration
```

El front llama al back de verdad (sin mocks) y la prueba lee los códigos OTP desde Mailpit
(`http://localhost:8025`). Recorre: registro y verificación del proveedor, login, negocio, servicio,
vigencia y horarios (HU-013/014), disponibilidad (HU-018 a 020), reserva y bloqueo del horario,
choque de horario (409), confirmación con OTP (HU-029), sesión del cliente, reservas activas y
cancelación (HU-025/026), y un 401 con la forma `{ code, message }`.

Otro back: `API_BASE_URL=https://mi-back npm run test:integration` (en Windows cmd: `set API_BASE_URL=https://mi-back && npm run test:integration`).
Los datos salen con correos y documentos únicos por corrida, así que se puede repetir.

## Hallazgo: CORS y PATCH

Cancelar una reserva es un `PATCH`. `SecurityBeansConfig.corsConfigurationSource` del back solo permite
`GET, POST, PUT, DELETE, OPTIONS`; falta `"PATCH"`. Desde el navegador la petición se bloquea; desde Node
(`npm run test:integration`) no se nota porque Node no aplica CORS. Corrección de AyD2: agregar `"PATCH"`
a `setAllowedMethods`.
