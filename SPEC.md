# SPEC.md - Sistema de Monitorización Recurrente de Vuelos con Agente IA

## 1. Visión General del Producto

Plataforma SaaS que permite a los usuarios programar alertas de vuelos basadas en patrones fijos de días de la semana (ej. "salida un lunes y regreso un miércoles") o numero de dias (ej. "14 dias") dentro de un rango temporal y con un precio umbral máximo.

El sistema monitoriza tarifas de forma asíncrona mediante workers con control de tasa (*rate limiting*), dispone de un agente conversacional para crear alertas mediante lenguaje natural y notifica instantáneamente al usuario a través de un bot de Telegram cuando se detecta una coincidencia.

---

## 2. Decisiones Arquitectónicas

- **Patrón:** Monolito Modular con Procesamiento Asíncrono Basado en Eventos/Colas.

- **Diseño Interno:** Arquitectura Hexagonal (Puertos y Adaptadores) para desacoplar proveedores externos (APIs de vuelos, servicios de mensajería y LLMs).

- **Lenguaje Unificado:** TypeScript 100% de extremo a extremo (Node.js en backend, React en frontend).

---

## 3. Stack Tecnológico

- **Frontend:** Next.js (App Router, Server Components, Tailwind CSS, componentes shadcn/ui).

- **Backend API:** NestJS (TypeScript, controladores REST, validación por DTOs con `class-validator`).

- **Base de Datos & ORM:** PostgreSQL + Prisma ORM.

- **Colas y Tareas en Segundo Plano:** Redis + BullMQ (Scheduler periódico y Workers con rate limiting y backoff exponencial).

- **Capa de Inteligencia Artificial:** Firebase Genkit (TypeScript) integrado en NestJS para flujos de agentes y extracción de entidades con tipado estricto (Zod Schemas) y observabilidad de trazas.

- **Integraciones Externas:**
  - Ignav Flight API como proveedor de datos de vuelos.
  - Telegram Bot API (vía `telegraf`) para notificaciones push instantáneas.

- **Infraestructura Local:** Docker Compose (PostgreSQL y Redis).

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

## 5. Endpoints de la API REST (NestJS)

### Autenticación (`/auth`)

- `POST /auth/register`: `{ email, password }` -> Crea usuario y devuelve JWT.
- `POST /auth/login`: `{ email, password }` -> Valida credenciales y retorna `{ accessToken }`.
- `PATCH /auth/telegram`: `{ telegramChatId }` -> Asocia el ID de chat de Telegram al usuario.

### Alertas (`/alerts`) - Autenticado vía JWT

- `POST /alerts`: Crea alerta mediante formulario estructurado.
  - Body: `{ originIata, destinationIata, departureDay, returnDay, maxPriceEur, startDate, endDate }`.
- `GET /alerts`: Devuelve las alertas del usuario autenticado con sus coincidencias (*matches*).
- `PATCH /alerts/:id/status`: Alterna entre `ACTIVE` y `PAUSED`.
- `DELETE /alerts/:id`: Elimina la alerta y limpia sus tareas programadas.

### Agente IA (`/agent`) - Autenticado vía JWT

- `POST /agent/parse-alert`: Recibe `{ prompt: string }` (ej. *"Avísame si hay vuelos de Madrid a París de lunes a miércoles por menos de 75 € en mayo"*).
  - Invoca al LLM mediante Structured Outputs.
  - Retorna el DTO validado listo para crear la alerta o pide clarificación si faltan parámetros clave.

---

## 6. Lógica del Motor Asíncrono (BullMQ + Redis)

1. **Scheduler (`FlightCheckScheduler`):**
   - Ejecución programada recurrente (cron de backend).
   - Recorre las alertas con estado `ACTIVE`.
   - Genera todas las tuplas de fechas válidas `(departureDate, returnDate)` según los días indicados entre `startDate` y `endDate`.
   - Encola trabajos en BullMQ dentro de la cola `flight-search-queue`.

2. **Worker (`FlightSearchWorker`):**
   - Consume trabajos respetando un limitador de tasa (*Rate Limiter*: máx. 2 peticiones/segundo).
   - Realiza la búsqueda a través del puerto `FlightSearchProvider` (implementado por `IgnavAdapter`).
   - Si el precio encontrado es menor o igual a `alert.maxPriceEur`:
     1. Inserta el registro en la tabla `Match`.
     2. Dispara el puerto `NotificationProvider` (implementado por `TelegramAdapter`).
     3. Envía notificación push instantánea al usuario.

---

## 7. Alcance Estricto del MVP

- **Incluido:** Autenticación por token, creación manual de alertas, creación por lenguaje natural con IA, worker en background con BullMQ, integración con Ignav y alertas por Telegram.
- **Excluido:** Pasarelas de pago (Stripe), búsqueda multiciudad compleja, login social de terceros y scraping web.
