# 07. Guía de Pruebas con Postman / cURL

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

## 3. Chatbot Agente IA Multi-Skill (`/agent`)

### A) Flujo Búsqueda Definida Directa (`DEFINED_SEARCH`) + Confirmación

**Paso 1: Enviar la petición completa**
```bash
curl -X POST http://localhost:3001/agent/chat \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sesion-directa-1",
    "prompt": "Vuelos de MAD a LON saliendo el lunes y volviendo el miercoles para 2 personas por menos de 75 euros entre el 2026-11-01 y el 2026-11-30"
  }'
```

**Paso 2: Confirmar para crear en BD y encolar en BullMQ automáticamente**
```bash
curl -X POST http://localhost:3001/agent/chat \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sesion-directa-1",
    "prompt": "Sí, lánzala"
  }'
```

---

### B) Flujo Recomendador (`DESTINATION_RECOMMENDER` ➔ `DEFINED_SEARCH` ➔ Confirmación)

**Turno 1: Pedir 5 recomendaciones (playa, montaña o barato)**
```bash
curl -X POST http://localhost:3001/agent/chat \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sesion-recomendador-1",
    "prompt": "Recomiéndame sitios baratos con playa para escaparme"
  }'
```

**Turno 2: Elegir uno de los 5 destinos e indicar fechas y presupuesto**
```bash
curl -X POST http://localhost:3001/agent/chat \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sesion-recomendador-1",
    "prompt": "Me quedo con Palma de Mallorca (PMI) saliendo desde MAD de viernes a domingo para 2 personas por menos de 90 euros entre 2026-11-01 y 2026-11-30"
  }'
```

**Turno 3: Confirmar creación y lanzamiento automático**
```bash
curl -X POST http://localhost:3001/agent/chat \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sesion-recomendador-1",
    "prompt": "Sí, adelante"
  }'
```
