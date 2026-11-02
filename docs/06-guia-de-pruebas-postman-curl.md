# 06. Guía de Pruebas con Postman / cURL

Todos los endpoints asumen que el servidor NestJS está corriendo en `http://localhost:3001`.

---

## 1. Autenticación (`/auth`)

### Registrar usuario
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@ejemplo.com",
    "password": "mi_password_seguro"
  }'
```

### Iniciar sesión (Login)
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@ejemplo.com",
    "password": "mi_password_seguro"
  }'
```

### Asociar Chat ID de Telegram
```bash
curl -X PATCH http://localhost:3001/auth/telegram \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "telegramChatId": "TU_CHAT_ID_NUMERICO"
  }'
```

### Cerrar sesión (Logout con revocación en Redis)
```bash
curl -X POST http://localhost:3001/auth/logout \
  -H "Authorization: Bearer <TU_TOKEN_JWT>"
```

---

## 2. Gestión de Alertas (`/alerts`)

### Crear alerta (Caso 1 Mock: `CHEAP_FLIGHT` - Dispara Telegram y pasa a `TRIGGERED`)
```bash
curl -X POST http://localhost:3001/alerts \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "originIata": "MAD",
    "destinationIata": "LON",
    "departureDay": 1,
    "returnDay": 3,
    "adults": 2,
    "maxPriceEur": 100,
    "startDate": "2026-11-01T00:00:00Z",
    "endDate": "2026-11-30T23:59:59Z"
  }'
```

### Crear alerta (Caso 2 Mock: `EXPENSIVE_FLIGHT` - Supera presupuesto, sigue `ACTIVE`)
```bash
curl -X POST http://localhost:3001/alerts \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "originIata": "MAD",
    "destinationIata": "JFK",
    "departureDay": 5,
    "returnDay": 7,
    "adults": 1,
    "maxPriceEur": 200,
    "startDate": "2026-11-01T00:00:00Z",
    "endDate": "2026-11-30T23:59:59Z"
  }'
```

### Crear alerta (Caso 3 Mock: `EMPTY_RESPONSE` - Sin vuelos disponibles)
```bash
curl -X POST http://localhost:3001/alerts \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "originIata": "MAD",
    "destinationIata": "XXX",
    "departureDay": 2,
    "returnDay": 4,
    "adults": 1,
    "maxPriceEur": 150,
    "startDate": "2026-11-01T00:00:00Z",
    "endDate": "2026-11-30T23:59:59Z"
  }'
```

### Crear alerta (Caso 4 Mock: `REALISTIC_RESPONSE` - Air France 110.25€)
```bash
curl -X POST http://localhost:3001/alerts \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "originIata": "MAD",
    "destinationIata": "PAR",
    "departureDay": 5,
    "returnDay": 7,
    "adults": 1,
    "maxPriceEur": 120,
    "startDate": "2026-11-01T00:00:00Z",
    "endDate": "2026-11-30T23:59:59Z"
  }'
```

### Listar todas las alertas del usuario y sus `Matches`
```bash
curl -X GET http://localhost:3001/alerts \
  -H "Authorization: Bearer <TU_TOKEN_JWT>"
```

### Cambiar el estado de una alerta (`ACTIVE`, `PAUSED`, `COMPLETED`)
```bash
curl -X PATCH http://localhost:3001/alerts/<ID_DE_LA_ALERTA>/status \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PAUSED"
  }'
```

### Forzar comprobación manual de una alerta
```bash
curl -X POST http://localhost:3001/alerts/<ID_DE_LA_ALERTA>/check \
  -H "Authorization: Bearer <TU_TOKEN_JWT>"
```

---

## 3. Agente IA (`/agent`)

### Extraer alerta desde lenguaje natural
```bash
curl -X POST http://localhost:3001/agent/parse-alert \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Vuelos de MAD a LON saliendo el lunes y volviendo el miercoles por menos de 75 euros entre el 2026-11-01 y el 2026-11-30"
  }'
```
