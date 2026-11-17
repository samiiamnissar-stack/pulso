# API de Pulso

Todas las rutas devuelven JSON. Las que llevan 🔒 necesitan la cabecera `Authorization: Bearer <token>`.

## Cuenta

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/auth/register` | Crea una cuenta. Campos: `email`, `password` (mín. 8), `alias`, `birthdate` (AAAA-MM-DD, mayor de 18), `gender`, `consent: true` (acepta la política de privacidad) |
| POST | `/api/auth/login` | Devuelve `{ token, user }` |
| GET 🔒 | `/api/me` | Perfil y check-in activo |
| PATCH 🔒 | `/api/me` | Cambia `alias`, `bio`, `gender`, `visibleInVenue` |
| GET 🔒 | `/api/me/export` | Descarga todos tus datos (art. 15 RGPD) |
| DELETE 🔒 | `/api/me` | Borra la cuenta y todo lo asociado (art. 17 RGPD) |

Valores de `gender`: `mujer`, `hombre`, `no_binario`, `otro`.

## Locales

| Método | Ruta | Qué hace |
|---|---|---|
| GET 🔒 | `/api/venues?lat=&lng=&vibe=` | Lista de locales con su resumen de ambiente. Con `lat`/`lng` se ordena por distancia. `vibe` filtra: `mujeres` (≥ 60 % mujeres), `hombres` (≥ 60 % hombres) o `mixto` |
| GET 🔒 | `/api/venues/:id` | Un local |
| POST 🔒 | `/api/venues/:id/checkin` | Check-in. Body `{ lat, lng }`; hay que estar a menos de 300 m (salvo en modo demo) |
| DELETE 🔒 | `/api/venues/checkin/current` | Salir del local |
| GET 🔒 | `/api/venues/:id/people` | Personas visibles en el local. Solo si tú también has hecho check-in allí |

Ejemplo de resumen de un local:

```json
{
  "enough": true,
  "people": 140,
  "crowd": "animado",
  "vibe": "hombres",
  "gender": [
    { "key": "hombre", "label": "Hombres", "pct": 60 },
    { "key": "mujer", "label": "Mujeres", "pct": 35 },
    { "key": "no_binario", "label": "No binarias", "pct": 5 }
  ],
  "avgAge": 25
}
```

Si hay menos de 10 personas, `enough` es `false` y no se devuelve ningún desglose.

## Social

| Método | Ruta | Qué hace |
|---|---|---|
| POST 🔒 | `/api/likes/:userId` | «Me gusta». Devuelve `{ match: id }` si es mutuo |
| GET 🔒 | `/api/matches` | Tus matches con el último mensaje |
| GET 🔒 | `/api/matches/:id/messages` | Mensajes de un match |
| POST 🔒 | `/api/matches/:id/messages` | Envía `{ body }` |
| POST 🔒 | `/api/blocks/:userId` | Bloquea a alguien |
| POST 🔒 | `/api/reports` | Denuncia `{ userId, reason }` (también bloquea) |

## Tiempo real (Socket.IO)

Conexión con `io({ auth: { token } })`. Eventos que envía el servidor:

- `match:new` → `{ matchId }`
- `message:new` → `{ matchId, id, sender_id, body, created_at }`
- `venue:update` → `{ venueId }` (ha cambiado el ambiente de un local)

## Operación

| Ruta | Qué hace |
|---|---|
| `/health` | Estado del nodo, de la base de datos (primario y réplica) y de Redis. 200 si está sano, 503 si no |
| `/metrics` | Métricas en formato Prometheus: peticiones, errores, memoria, tiempo arrancado |

Cada respuesta lleva la cabecera `X-Pulso-Node` con el nombre del nodo que la ha atendido.
