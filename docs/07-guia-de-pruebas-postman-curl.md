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

### Obtener perfil del usuario autenticado (`GET /auth/me`)
```bash
curl -X GET http://localhost:3001/auth/me \
  -H "Authorization: Bearer <TU_TOKEN_JWT>"
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

## 2. Catálogo de Aeropuertos IATA (`/airports`)

### Buscar aeropuertos por texto (ciudad, país, nombre o código IATA)
```bash
curl -X GET "http://localhost:3001/airports?q=madrid&limit=10"
```

### Obtener detalle de un aeropuerto o código metropolitano por IATA
```bash
curl -X GET http://localhost:3001/airports/LON
```

---

## 3. Gestión de Alertas (`/alerts`)

### Crear alerta (Caso 1 Mock: `CHEAP_FLIGHT` - Solo vuelos directos, dispara Telegram y pasa a `TRIGGERED`)
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
    "directOnly": true,
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
    "directOnly": false,
    "maxPriceEur": 200,
    "startDate": "2026-11-01T00:00:00Z",
    "endDate": "2026-11-30T23:59:59Z"
  }'
```

### Crear alerta (Caso 3 Mock: `LAYOVER_FLIGHT` a `INN` con `directOnly: false` vs `directOnly: true`)
```bash
curl -X POST http://localhost:3001/alerts \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "originIata": "MAD",
    "destinationIata": "INN",
    "departureDay": 5,
    "returnDay": 7,
    "adults": 1,
    "directOnly": false,
    "maxPriceEur": 120,
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
    "directOnly": true,
    "maxPriceEur": 120,
    "startDate": "2026-11-01T00:00:00Z",
    "endDate": "2026-11-30T23:59:59Z"
  }'
```

### Modificar todos los parámetros de una alerta existente (`PATCH /alerts/:id`)
```bash
curl -X PATCH http://localhost:3001/alerts/<ID_DE_LA_ALERTA> \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "originIata": "MAD",
    "destinationIata": "ROM",
    "departureDay": 5,
    "returnDay": 7,
    "adults": 2,
    "directOnly": true,
    "maxPriceEur": 140,
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

## 4. Chatbot Agente IA Multi-Skill ("Vera" - `/agent`)

### A) Flujo Búsqueda Definida Directa (`DEFINED_SEARCH`) + Clarificación de Presupuesto/Escalas + Confirmación

**Paso 1: Enviar la petición completa (con tipo de presupuesto y escalas)**
```bash
curl -X POST http://localhost:3001/agent/chat \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sesion-directa-1",
    "prompt": "Vuelos directos de MAD a LON saliendo el lunes y volviendo el miercoles para 2 personas por menos de 75 euros por persona entre el 2026-11-01 y el 2026-11-30"
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

### B) Flujo Recomendador (`DESTINATION_RECOMMENDER` ➔ Solicitud de Origen ➔ `DEFINED_SEARCH` ➔ Confirmación)

**Turno 1: Pedir 5 recomendaciones (sin indicar origen todavía)**
```bash
curl -X POST http://localhost:3001/agent/chat \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sesion-recomendador-1",
    "prompt": "Recomiéndame sitios baratos con playa para escaparme"
  }'
```
*(Vera preguntará desde qué ciudad o aeropuerto vas a salir antes de buscar y verificar vuelos directos).*

**Turno 2: Indicar aeropuerto/ciudad de origen para recibir las 5 recomendaciones con indicador `hasDirectFlights`**
```bash
curl -X POST http://localhost:3001/agent/chat \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sesion-recomendador-1",
    "prompt": "Salgo desde Madrid (MAD)"
  }'
```

**Turno 3: Elegir uno de los 5 destinos e indicar fechas, presupuesto y preferencia de escalas**
```bash
curl -X POST http://localhost:3001/agent/chat \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sesion-recomendador-1",
    "prompt": "Me quedo con Palma de Mallorca (PMI) de viernes a domingo para 2 personas por menos de 90 euros en total solo vuelo directo entre 2026-11-01 y 2026-11-30"
  }'
```

**Turno 4: Confirmar creación y lanzamiento automático**
```bash
curl -X POST http://localhost:3001/agent/chat \
  -H "Authorization: Bearer <TU_TOKEN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sesion-recomendador-1",
    "prompt": "Sí, adelante"
  }'
```
