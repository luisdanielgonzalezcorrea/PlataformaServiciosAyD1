# Pendientes del back (Sprint 2) · para AyD2

Hola equipo. Esto es lo que encontramos al probar el front de AyD1 contra el back real
(Docker, `localhost:8080`). **Actualización 17/10/2026:** con la última versión del back volvimos
a probar desde el navegador y casi todo quedó resuelto. Lo que sigue pendiente está al final de
este archivo (mensaje de duplicidad, HU-013 y despliegue).

| # | Punto | Estado |
|---|-------|--------|
| 1 | Cancelar reserva desde el navegador (PATCH en CORS) | Resuelto, probado desde el front |
| 2 | Duplicidad de reservas | Funciona (probado); falta mejorar el mensaje de error |
| 3 | Diferencias Swagger vs código | Corregido (revisado en `docs/api-servas-swagger.yaml`) |
| 4 | Horarios guardados, calendario mensual | Resuelto (GET de horarios y `availability/month`) |
| 5 | Correo de confirmación con código | Resuelto: llega con el `RSV-XXXXXXXX` y la API devuelve `reservationCode` |
| 6 | Despliegue (Vercel) | Pendiente |
| 7 | HU-013: fecha fin igual a inicio | Pendiente (el back la acepta, la HU pide posterior) |

El detalle de cada punto queda abajo como historial de lo que encontramos.

---

## 2. Un mismo cliente puede reservar el mismo servicio a la misma hora (duplicidad) · FUNCIONA, FALTA EL MENSAJE

> Probado: ya no deja reservar dos veces el mismo servicio a la misma hora con el mismo cliente.
> **Falta el mensaje.** Hoy el back responde con `SLOT_NOT_AVAILABLE` ("La franja ya no está
> disponible."), el mismo error de una franja llena. Eso confunde, porque la franja sí está libre y
> lo que pasa es que el cliente ya tiene una reserva ahí. **Proponemos** un error propio: en
> `Errors.java` agregar
> `DUPLICATE_RESERVATION = conflict("DUPLICATE_RESERVATION", "Ya tienes una reserva para ese servicio en ese horario.")`
> y devolverlo en `ReservationService.validateSlot` donde hoy está `sameClientOverlap`
> (línea ~294). El front muestra el `message` que mande el back, así que no necesita cambios.
> El texto de abajo es el diagnóstico original.

**Proponemos:**
1. En `validateSlot` (o en `create` y `modify`), rechazar si el mismo `client_id` ya tiene una
   reserva activa (PENDING o CONFIRMED) del mismo servicio que se solape con la franja. Devolver
   un código nuevo, por ejemplo `DUPLICATE_RESERVATION` (409), con un mensaje claro.
2. Hacerlo bajo el mismo bloqueo de fila del servicio (`findByIdForUpdate`) para que dos
   peticiones simultáneas no se cuelen.
3. Opcional, como respaldo en base de datos: un índice único parcial sobre
   `(client_id, service_id, reservation_date, start_time)` para estados activos.
4. Documentar el nuevo código de error en el Swagger. El front ya muestra el `message` que el
   back mande, así que no necesita cambios para mostrarlo.

---

## 4. HU que dependen de ajustes del back · MAYORÍA RESUELTA

El front de estas HU está hecho y probado; para cerrarlas al 100 % falta lo siguiente.

| HU | Qué hace el front hoy | Qué falta en el back |
|----|-----------------------|----------------------|
| HU-013 | Valida en el formulario que la fecha de fin sea **posterior** a la de inicio y envía `PUT /services/{id}` con `start_date` / `end_date` | `ValidDateRange` acepta fin **igual** a inicio (`!fin.isBefore(inicio)`). Para que coincida con la HU, rechazar también la igualdad (`fin.isAfter(inicio)`) y ajustar el mensaje a "La fecha de fin debe ser posterior a la fecha de inicio". |

---


## Cómo probar esto de nuestro lado

```
npm install
npm test                    # contrato, sin back (24 pruebas)
npm run test:integration    # contra el back real en Docker (9 pruebas)
```

`npm run test:integration` corre en Node, así que **no detecta problemas de CORS**; esos solo se
ven en el navegador (F12 → Red).
