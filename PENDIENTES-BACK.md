# Pendientes del back (Sprint 2) · para AyD2

Hola equipo. Esto es lo que encontramos al probar el front de AyD1 contra el back real
(Docker, `localhost:8080`). El front ya cumple el contrato: 24 pruebas de contrato en verde y
9/9 de integración. Lo que sigue es lo que **no pudimos cerrar** y depende del back.

Cada punto dice qué pasa, cómo lo comprobamos y qué proponemos. Está en orden de prioridad.

---

## 1. Cancelar una reserva falla desde el navegador (HU-026) · BLOQUEA

**Qué pasa:** en "Mis reservas", al pulsar *Cancelar reserva* sale "Ocurrió un error al comunicarse
con el servidor (código 403)".

**Cómo lo comprobamos:** en F12 → Red, la petición
`PATCH /reservations/{id}/cancel` responde `403` con el cuerpo `Invalid CORS request` (texto plano,
20 B). La petición sí lleva `Authorization: Bearer ...` y el origen es `http://localhost:5173`.

**Causa:** `config/SecurityBeansConfig.java`, `corsConfigurationSource`, línea 36:

```java
configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
```

Falta `"PATCH"`. El origen sí está permitido (el GET y el POST desde el mismo origen responden
200/201). Lo que se rechaza es el método. El filtro de CORS corre antes que la autorización, por
eso no se llega a evaluar la sesión.

**Por qué no lo vieron:** desde Postman, curl o Swagger UI no hay cabecera `Origin`, así que el
back no aplica CORS y el PATCH pasa. Solo falla desde un navegador.

**Arreglo (1 línea):**

```java
configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
```

**Cómo verificarlo** (debe responder `200` y `Access-Control-Allow-Methods` con PATCH):

```
curl -i -X OPTIONS http://localhost:8080/reservations/x/cancel \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: PATCH" \
  -H "Access-Control-Request-Headers: authorization,content-type"
```

**No proponemos** hacer el endpoint público: el bloqueo ocurre en CORS y seguiría igual, y se
perdería la protección que pusimos en las HU (solo el dueño de la sesión cancela su reserva).

---

## 2. Un mismo cliente puede reservar el mismo servicio a la misma hora (duplicidad) · REGLA DE NEGOCIO

**Qué pasa:** un usuario está pudiendo reservar el mismo servicio, el mismo día y a la misma hora,
más de una vez.

**Qué vimos en el código:** `ReservationService.validateSlot` cuenta las reservas activas que se
solapan con la franja y las compara con `service.getCapacity()`:

```java
if (overlapping >= service.getCapacity()) { return Result.failure(Errors.SLOT_NOT_AVAILABLE); }
```

No hay ninguna comprobación por cliente. Con `capacity = 1` la franja queda llena y nadie más
reserva. Con `capacity > 1` (por ejemplo una clase con varios cupos, migración V6) **el mismo
cliente puede ocupar varios cupos de la misma franja**. Además, la migración V6 eliminó la
restricción de exclusión `ex_reservations_no_overlap` (V4), así que la base de datos tampoco lo
impide.

---

## 3. Diferencias entre el Swagger y el código

El front sigue **el código** (es lo que responde de verdad). Hay que corregir el Swagger o el
controlador:

| # | Dónde | Swagger dice | El código hace |
|---|-------|--------------|----------------|
| 1 | `GET /services/{id}/availability` | `[{ start_time, end_time, available }]` | `[{ startTime, endTime }]` (camelCase, `ScheduleController.SlotView`) |
| 2 | `GET /services` | `company_id`, `comuna_id` | `@RequestParam companyId` y `comunaId` |
| 3 | `POST /reservations/{id}/confirm` | no existe | existe en `ReservationController` (body `{ otp_code }`) |
| 4 | `POST /auth/login` | sin cuerpo de respuesta | `{ token, userId, email }` |

Estas diferencias quedan registradas en `tests/helpers/contract.js` (`KNOWN_DIVERGENCES`).

---

## 4. HU que dependen de ajustes del back

El front de estas HU está hecho y probado; para cerrarlas al 100 % falta lo siguiente.

| HU | Qué hace el front hoy | Qué falta en el back |
|----|-----------------------|----------------------|
| HU-014 | `PUT /services/{id}/schedules` (guarda bien) | No hay forma de **leer** los horarios guardados: `ScheduleController` solo tiene POST y PUT en `/services/{id}/schedules`, y `ServiceView` no incluye los horarios. Al volver a "Mi agenda" el proveedor no ve sus días de atención. Pedimos `GET /services/{id}/schedules` (devolviendo `[{ id, dayOfWeek, startTime, endTime }]`, con `@GetMapping` y la misma regla de dueño del servicio) o incluir `schedules` en `ServiceView`. Mientras tanto el front guarda una copia en el navegador; en cuanto exista el GET, lo usa solo. |
| HU-018 / HU-019 | El calendario mensual pide `GET /services/{id}/availability?date=` día por día (hasta 31 llamadas por mes) | Un endpoint mensual (por ejemplo `availability?month=YYYY-MM`) que devuelva el estado de cada día en una sola llamada. Hoy funciona, pero es lento y recarga el back. **Solo es una sugerencia**|
| HU-029 | Muestra la ventana de confirmación de la reserva | Que el back envie el correo post confirmación, no el codigo, sino el correo indicando que se reservó bien y cual fue el código de reserva que se le asignó |

---

## 5. El correo está pero faltan los datos de la reserva (HU-029)

**Qué pasa:** al confirmar la reserva con el OTP, el correo "Tu reserva en agenda.co está confirmada"
**sí llega**. Trae el servicio, la fecha y la
hora, pero **no trae el código de la reserva**.

**Por qué:** el código `RSV-XXXXXXXX` que ve el cliente en pantalla lo arma el front, con `RSV-` más
los primeros 8 caracteres del `id` de la reserva en mayúsculas (sin guiones). El back no usa ese
código y la plantilla del correo no incluye el `id`, así que el cliente no tiene cómo relacionar el
correo con lo que ve en la pantalla.

**Proponemos (cualquiera de las dos):**
1. Que el correo de confirmación incluya el código, armado igual que el front. Ejemplo para el id
   `79898eee-21d1-415d-b401-159a83c30bf1`: `RSV-79898EEE`.
2. O que el back genere y guarde ese código, y lo devuelva en la respuesta de la reserva
   (`reservationCode`). Así el correo, la pantalla y la consulta en "Mis reservas" muestran el mismo
   valor, y el front deja de calcularlo.

**Opcional:** que el correo también traiga el negocio, la hora de fin, la dirección o el enlace según
la modalidad y la regla de cancelación (hasta 2 horas antes). Tampoco se envía correo al cancelar.

**Cómo lo comprobamos:** con el back en Docker, confirmar una reserva y abrir Mailpit. El segundo
correo debe mostrar el código `RSV-…` igual al de la pantalla de reserva confirmada.

**El front:** no necesita cambios para la opción 1. Con la opción 2 solo cambia una línea, para leer
`reservationCode` en vez de calcularlo.

---

## Cómo probar esto de nuestro lado

```
npm install
npm test                    # contrato, sin back (24 pruebas)
npm run test:integration    # contra el back real en Docker (9 pruebas)
```

`npm run test:integration` corre en Node, así que **no detecta problemas de CORS**; esos solo se
ven en el navegador (F12 → Red).
