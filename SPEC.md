# SPEC.md - Sistema de Monitorización Recurrente de Vuelos con Agente IA (V Flights)

## 1. Visión General del Producto

Plataforma SaaS (**V Flights**) que permite a los usuarios programar alertas de vuelos basadas en patrones fijos de días de la semana (ej. "salida un viernes y regreso un domingo" o "lunes a miércoles"), número de pasajeros, preferencia de escalas (solo vuelos directos o con escalas) y un rango temporal con un precio umbral máximo.

El sistema monitoriza tarifas de forma asíncrona mediante un planificador Cron y workers con control de tasa (*rate limiting*) y deduplicación, cuenta con una base de datos de más de 8.000 aeropuertos IATA, dispone de un agente conversacional Multi-Skill (**Vera**) para recomendar destinos y crear alertas mediante lenguaje natural, ofrece un panel visual interactivo con gráficas comparativas por fechas y notifica instantáneamente al usuario a través de un bot de Telegram con un resumen detallado (aerolínea, escalas, hora de salida, duración y enlace de reserva).

---

## 2. Decisiones Arquitectónicas

- **Patrón:** Monolito Modular en Monorepo (`pnpm workspaces`) con Procesamiento Asíncrono Basado en Colas.
- **Diseño Interno:** Arquitectura Hexagonal (Puertos y Adaptadores) para desacoplar proveedores externos (APIs de vuelos, servicios de mensajería y LLMs).
- **Lenguaje Unificado:** TypeScript 100% de extremo a extremo (Node.js/NestJS en backend, React 19 / Next.js 16 en frontend).

---

## 3. Stack Tecnológico

- **Frontend (`apps/web`):** Next.js 16 (App Router, React 19, Tailwind CSS v4, componentes accesibles WAI-ARIA).
- **Backend API (`apps/api`):** NestJS (TypeScript, controladores REST, validación global estricta por DTOs con `class-validator`, autenticación JWT + Passport y hashing con `bcryptjs`).
- **Base de Datos & ORM:** PostgreSQL 15 + Prisma ORM (con histórico de migraciones en `prisma/migrations` y autosembrado de aeropuertos desde `prisma/airports-seed.json`).
- **Colas, Planificación y Sesiones:** Redis 7 + BullMQ + `@nestjs/schedule` (Scheduler Cron configurable, Workers con rate limiting, deduplicación por `jobId`, cancelación de trabajos en cola y revocación de JWT en Redis).
- **Capa de Inteligencia Artificial:** Firebase Genkit (TypeScript) y Google Gemini API integrados en NestJS con definición modular de habilidades mediante archivos `SKILL.md` (`defined-search` y `destination-recommender`).
- **Integraciones Externas:**
  - **Ignav Flight API** (`POST https://ignav.com/api/fares/round-trip`) como proveedor de datos de vuelos (con soporte de modo Mock mediante `USE_IGNAV_MOCK`).
  - **Telegram Bot API** (vía `telegraf`) para notificaciones push instantáneas.
- **Infraestructura Local:** Docker Compose (PostgreSQL 15 y Redis 7).

---

## 4. Modelo de Datos (Prisma Schema)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum AlertStatus {
  ACTIVE
  PAUSED
  TRIGGERED
  COMPLETED
}

model User {
  id             String   @id @default(uuid())
  email          String   @unique
  passwordHash   String
  telegramChatId String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  alerts         Alert[]
}

model Alert {
  id              String      @id @default(uuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  originIata      String      // Ej: "MAD"
  destinationIata String      // Ej: "LON"
  departureDay    Int         // 1 = Lunes, ..., 7 = Domingo
  returnDay       Int         // 1 = Lunes, ..., 7 = Domingo
  adults          Int         @default(1) // Número de pasajeros
  directOnly      Boolean     @default(false) // true = Solo vuelos directos, false = Con escalas permitidas
  maxPriceEur     Decimal     @db.Decimal(10, 2)
  startDate       DateTime    // Inicio del rango de monitorización
  endDate         DateTime    // Fin del rango de monitorización
  status          AlertStatus @default(ACTIVE)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  matches         Match[]
}

model Match {
  id            String   @id @default(uuid())
  alertId       String
  alert         Alert    @relation(fields: [alertId], references: [id], onDelete: Cascade)
  departureDate DateTime
  returnDate    DateTime
  foundPriceEur Decimal  @db.Decimal(10, 2)
  airlineCode   String?
  bookingUrl    String?
  notifiedAt    DateTime @default(now())
}

model Airport {
  iata       String   @id
  name       String
  city       String
  country    String
  popularity Int      @default(0)
  createdAt  DateTime @default(now())

  @@index([city])
  @@index([country])
  @@index([popularity(sort: Desc)])
}
```

---

## 5. Endpoints de la API REST (NestJS - Puerto 3001)

### Autenticación (`/auth`)

- `POST /auth/register`: `{ email, password }` -> Crea usuario con contraseña hasheada (`bcryptjs`) y devuelve `{ accessToken }`.
- `POST /auth/login`: `{ email, password }` -> Valida credenciales y retorna `{ accessToken }`.
- `POST /auth/logout` (JWT): Revoca el token actual almacenándolo en la lista negra de Redis (`TokenBlacklistService`).
- `GET /auth/me` (JWT): Devuelve el perfil del usuario autenticado (`id`, `email`, `telegramChatId`, `createdAt`).
- `PATCH /auth/telegram` (JWT): `{ telegramChatId }` -> Asocia el ID numérico de chat de Telegram al usuario autenticado.

### Aeropuertos (`/airports`)

- `GET /airports?q=<texto>&limit=<n>`: Busca en el catálogo de +8.000 aeropuertos IATA y códigos metropolitanos ordenando por coincidencia exacta de código IATA, prefijo de ciudad/país y popularidad.
- `GET /airports/:iata`: Resuelve la información completa (`iata`, `name`, `city`, `country`, `popularity`) de un código IATA concreto.

### Alertas (`/alerts`) - Autenticado vía JWT

- `POST /alerts`: Crea alerta mediante formulario estructurado y dispara inmediatamente su primera búsqueda en la cola.
  - Body: `{ originIata, destinationIata, departureDay, returnDay, adults?, directOnly?, maxPriceEur, startDate, endDate }`.
- `PATCH /alerts/:id`: Modifica los parámetros de una alerta existente (excepto si está `COMPLETED`), limpia sus coincidencias anteriores, reactiva su estado a `ACTIVE` y la vuelve a encolar inmediatamente.
- `POST /alerts/:id/check`: Fuerza manualmente el re-encolado y comprobación de tarifas de una alerta.
- `GET /alerts`: Devuelve las alertas del usuario autenticado incluyendo su historial de coincidencias (`matches`), flag `directOnly` e indicador `pendingCompletionPrompt`.
- `PATCH /alerts/:id/status`: Actualiza el estado de la alerta (`ACTIVE`, `PAUSED`, `TRIGGERED`, `COMPLETED`), cancelando o encolando trabajos en BullMQ según corresponda.
- `DELETE /alerts/:id`: Cancela trabajos pendientes en cola y elimina la alerta y sus coincidencias en cascada.

### Agente IA (`/agent`) - Autenticado vía JWT

- `POST /agent/chat` y `POST /agent/parse-alert`: Recibe `{ prompt: string, sessionId?: string }`.
  - Mantiene estado conversacional multi-turno por `sessionId` y opera con dos Skills (`DEFINED_SEARCH` y `DESTINATION_RECOMMENDER`), devolviendo recomendaciones verificadas, preguntas de clarificación (origen, fechas, presupuesto por persona vs. total, vuelo directo vs. con escalas) o lanzando automáticamente la alerta tras la confirmación del usuario.

---

## 6. Lógica del Motor Asíncrono (BullMQ + Redis)

1. **Scheduler (`AlertSchedulerService`):**
   - Se ejecuta inmediatamente al crear o modificar una alerta y periódicamente mediante Cron configurable (`ALERT_CRON_SCHEDULE`, por defecto `0 */6 * * *`).
   - Marca con `pendingCompletionPrompt = true` aquellas alertas que ya estaban en estado `TRIGGERED` al pasar un nuevo ciclo del Cron sin haber sido completadas por el usuario, para que el frontend le ofrezca darlas por completadas o mantenerlas activas.
   - Recorre las alertas con estado `ACTIVE`.
   - Si `endDate` ya ha expirado o no quedan combinaciones futuras posibles, marca automáticamente la alerta como `COMPLETED`.
   - Genera todas las tuplas futuras `(departureDate, returnDate)` y encola **un único trabajo agrupado por alerta** en `flight-search-queue` usando `jobId: alert.id` para evitar duplicados o condiciones de carrera.

2. **Worker (`FlightSearchWorker` + `FlightSearchProcessorService`):**
   - Consume trabajos respetando un limitador de tasa (*Rate Limiter*: máx. 2 peticiones/segundo).
   - Verifica que la alerta siga en estado `ACTIVE` antes de iniciar la búsqueda.
   - Consulta cada combinación de fechas a través del puerto `FlightSearchProvider` (`IgnavAdapter`), aplicando el filtro `directOnly` si el usuario solicitó exclusivamente vuelos sin escalas.
   - Para cada fecha cuyo mejor precio sea `<= alert.maxPriceEur`:
     1. Inserta el registro en la tabla `Match`.
     2. Acumula la oferta encontrada (incluyendo aerolínea, si es directo o con escalas, hora de salida, duración y link de reserva).
   - Al finalizar el recorrido de fechas, si se encontró al menos una oferta:
     1. Envía **un único mensaje resumen unificado** por Telegram (`TelegramAdapter`).
     2. Cambia el estado de la alerta a `TRIGGERED` para no repetir la búsqueda en posteriores ejecuciones del Cron. Si no hubo resultados dentro del presupuesto, la alerta permanece `ACTIVE`.

---

## 7. Alcance Estricto del MVP

- **Incluido:** Frontend completo **V Flights** en Next.js (Landing Page, Login/Registro, Comparador, Mis alertas con filtros, edición inline, gráficas comparativas y widget flotante del Agente IA Vera), catálogo de +8.000 aeropuertos IATA, autenticación JWT con logout en Redis, creación y edición manual de alertas con número de pasajeros y filtro de escalas (`directOnly`), creación e inspiración por lenguaje natural con IA Multi-Skill, scheduler Cron y worker en background con BullMQ, integración con Ignav API (modo Real y Mock) y alertas enriquecidas por Telegram.
- **Excluido:** Pasarelas de pago (Stripe), búsqueda multiciudad compleja, login social de terceros y scraping web directo.
