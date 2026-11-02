# SPEC.md - Sistema de Monitorización Recurrente de Vuelos con Agente IA

## 1. Visión General del Producto

Plataforma SaaS que permite a los usuarios programar alertas de vuelos basadas en patrones fijos de días de la semana (ej. "salida un lunes y regreso un miércoles"), número de pasajeros y un rango temporal con un precio umbral máximo.

El sistema monitoriza tarifas de forma asíncrona mediante un planificador Cron y workers con control de tasa (*rate limiting*) y deduplicación, dispone de un agente conversacional para crear alertas mediante lenguaje natural y notifica instantáneamente al usuario a través de un bot de Telegram con un resumen detallado (aerolínea, escalas, hora de salida, duración y enlace de reserva).

---

## 2. Decisiones Arquitectónicas

- **Patrón:** Monolito Modular en Monorepo (`pnpm workspaces`) con Procesamiento Asíncrono Basado en Colas.
- **Diseño Interno:** Arquitectura Hexagonal (Puertos y Adaptadores) para desacoplar proveedores externos (APIs de vuelos, servicios de mensajería y LLMs).
- **Lenguaje Unificado:** TypeScript 100% de extremo a extremo (Node.js/NestJS en backend, React/Next.js en frontend).

---

## 3. Stack Tecnológico

- **Frontend:** Next.js (App Router, Server Components, Tailwind CSS, componentes shadcn/ui).
- **Backend API:** NestJS (TypeScript, controladores REST, validación global estricta por DTOs con `class-validator`, autenticación JWT + Passport y hashing con `bcryptjs`).
- **Base de Datos & ORM:** PostgreSQL + Prisma ORM (con histórico de migraciones en `prisma/migrations`).
- **Colas, Planificación y Sesiones:** Redis + BullMQ + `@nestjs/schedule` (Scheduler Cron configurable, Workers con rate limiting, deduplicación por `jobId` y revocación de JWT en Redis).
- **Capa de Inteligencia Artificial:** Firebase Genkit (TypeScript) integrado en NestJS para extracción de alertas desde lenguaje natural.
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
```

---

## 5. Endpoints de la API REST (NestJS - Puerto 3001)

### Autenticación (`/auth`)

- `POST /auth/register`: `{ email, password }` -> Crea usuario con contraseña hasheada (`bcryptjs`) y devuelve `{ accessToken }`.
- `POST /auth/login`: `{ email, password }` -> Valida credenciales y retorna `{ accessToken }`.
- `POST /auth/logout` (JWT): Revoca el token actual almacenándolo en la lista negra de Redis (`TokenBlacklistService`).
- `PATCH /auth/telegram` (JWT): `{ telegramChatId }` -> Asocia el ID numérico de chat de Telegram al usuario autenticado.

### Alertas (`/alerts`) - Autenticado vía JWT

- `POST /alerts`: Crea alerta mediante formulario estructurado y dispara inmediatamente su primera búsqueda en la cola.
  - Body: `{ originIata, destinationIata, departureDay, returnDay, adults?, maxPriceEur, startDate, endDate }`.
- `POST /alerts/:id/check`: Fuerza manualmente el encolado y comprobación de una alerta activa.
- `GET /alerts`: Devuelve las alertas del usuario autenticado incluyendo su historial de coincidencias (`matches`).
- `PATCH /alerts/:id/status`: Actualiza el estado de la alerta (`ACTIVE`, `PAUSED`, `TRIGGERED`, `COMPLETED`).
- `DELETE /alerts/:id`: Elimina la alerta y sus coincidencias en cascada.

### Agente IA (`/agent`) - Autenticado vía JWT

- `POST /agent/parse-alert`: Recibe `{ prompt: string }` (ej. *"Vuelos de MAD a LON saliendo el lunes y volviendo el miércoles por menos de 75 euros..."*).
  - Invoca al servicio de IA y retorna el DTO validado o solicita clarificación si faltan parámetros obligatorios.

---

## 6. Lógica del Motor Asíncrono (BullMQ + Redis)

1. **Scheduler (`AlertSchedulerService`):**
   - Se ejecuta inmediatamente al crear una alerta y periódicamente mediante Cron configurable (`ALERT_CRON_SCHEDULE`, por defecto `0 */6 * * *`).
   - Recorre las alertas con estado `ACTIVE`.
   - Si `endDate` ya ha expirado o no quedan combinaciones futuras posibles, marca automáticamente la alerta como `COMPLETED`.
   - Genera todas las tuplas futuras `(departureDate, returnDate)` y encola **un único trabajo agrupado por alerta** en `flight-search-queue` usando `jobId: alert.id` para evitar duplicados o condiciones de carrera.

2. **Worker (`FlightSearchWorker` + `FlightSearchProcessorService`):**
   - Consume trabajos respetando un limitador de tasa (*Rate Limiter*: máx. 2 peticiones/segundo).
   - Verifica que la alerta siga en estado `ACTIVE` antes de iniciar la búsqueda.
   - Consulta cada combinación de fechas a través del puerto `FlightSearchProvider` (`IgnavAdapter`).
   - Para cada fecha cuyo mejor precio sea `<= alert.maxPriceEur`:
     1. Inserta el registro en la tabla `Match`.
     2. Acumula la oferta encontrada (incluyendo aerolínea, si es directo o con escalas, hora de salida, duración y link de reserva).
   - Al finalizar el recorrido de fechas, si se encontró al menos una oferta:
     1. Envía **un único mensaje resumen unificado** por Telegram (`TelegramAdapter`).
     2. Cambia el estado de la alerta a `TRIGGERED` para no repetir la búsqueda en posteriores ejecuciones del Cron. Si no hubo resultados dentro del presupuesto, la alerta permanece `ACTIVE`.

---

## 7. Alcance Estricto del MVP

- **Incluido:** Autenticación JWT con logout en Redis, creación manual de alertas con número de pasajeros, creación por lenguaje natural con IA, scheduler Cron y worker en background con BullMQ, integración con Ignav API (modo Real y Mock) y alertas enriquecidas por Telegram.
- **Excluido:** Pasarelas de pago (Stripe), búsqueda multiciudad compleja, login social de terceros y scraping web directo.
