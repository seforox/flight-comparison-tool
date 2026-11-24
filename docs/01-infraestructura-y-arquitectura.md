# 01. Infraestructura y Arquitectura Base

## 1. Estructura del Monorepo con `pnpm`
- Se configuró el proyecto como un **monorepo con `pnpm workspaces`** (`pnpm-workspace.yaml`), separando limpiamente dos aplicaciones independientes:
  - **`apps/api` (Puerto `3001`):** Backend en NestJS con Arquitectura Hexagonal, Prisma ORM, BullMQ, Firebase Genkit / Gemini API y bot de Telegram.
  - **`apps/web` (Puerto `3000`):** Frontend en Next.js 16 (App Router), React 19 y Tailwind CSS v4 bajo la identidad visual **V Flights**.
- **Decisión sobre `node_modules`:** `pnpm` utiliza un almacén global con enlaces simbólicos (*symlinks*) en la raíz y dentro de `apps/api/node_modules` y `apps/web/node_modules` para evitar *phantom dependencies* (que un paquete importe librerías que no declaró en su propio `package.json`). Se configuró `.gitignore` para excluir todas las carpetas `node_modules`, `.next` y `dist`.

## 2. Infraestructura Local (`docker-compose.yml`)
Se levantaron dos contenedores ligeros basados en Alpine para dar soporte al entorno de desarrollo:
- **PostgreSQL 15 (`flight_db`):** Base de datos relacional principal en el puerto `5432` (almacena usuarios, alertas, coincidencias de vuelos y el catálogo de +8.000 aeropuertos IATA).
- **Redis 7 (`flight_redis`):** Almacén en memoria en el puerto `6379` utilizado tanto para las colas de trabajos de **BullMQ** como para la **lista negra de tokens JWT (`TokenBlacklistService`)**.

## 3. Arquitectura Hexagonal en Backend (Puertos y Adaptadores)
Para desacoplar el núcleo de negocio de las herramientas externas, `apps/api/src` se estructuró en tres capas estrictas:
- **`domain/` (Núcleo puro):**
  - Servicios de dominio sin dependencias externas (`FlightDateCalculatorService`).
  - Interfaces/Puertos (`FlightSearchProvider`, `NotificationProvider`).
  - DTOs de entrada validados con `class-validator` (`CreateAlertDto`, `UpdateAlertStatusDto`, `AuthCredentialsDto`, `UpdateTelegramDto`, `AgentChatDto`).
- **`application/` (Casos de uso, Skills y Orquestación):**
  - `FlightSearchProcessorService`: Evalúa precios y filtro de escalas (`directOnly`), persiste coincidencias (`Match`) y dispara notificaciones.
  - `AlertSchedulerService`: Planificador Cron, gestor de recordatorios de alertas disparadas (`pendingCompletionPrompt`), encolador y cancelador de trabajos en BullMQ.
  - `AlertParserAgentService` y carpeta `skills/` (`defined-search/SKILL.md` y `destination-recommender/SKILL.md`): Agente conversacional Multi-Skill ("Vera") con verificación de vuelos directos y clarificación de presupuesto por pasajero o total.
  - Controladores REST (`AlertsController`, `AuthController`, `AgentController`, `AirportsController`, `HealthController`).
- **`infrastructure/` (Adaptadores concretos):**
  - `IgnavAdapter` y `ignav.mocks.ts` (búsqueda de vuelos reales y simulados).
  - `TelegramAdapter` (notificaciones push vía Telegraf).
  - `PrismaService` (acceso a datos en PostgreSQL).
  - `FlightSearchWorker` (consumidor BullMQ con control de tasa).
  - `JwtStrategy`, `JwtAuthGuard`, `TokenBlacklistService` y `ApiGatewayGuard` (seguridad, cierre de sesión en Redis y protección opcional de gateway).

## 4. Arquitectura de Producción (Vercel + Railway)
Para el entorno real de producción, el frontend (`apps/web`) se despliega en **Vercel** (incluyendo proxy BFF `/api/proxy/[...path]` y `src/proxy.ts` de acceso privado), mientras que el backend (`apps/api`, `apps/api/Dockerfile` y `railway.json`) junto con PostgreSQL 15 y Redis 7 corren de forma persistente en **Railway**. Consulta el detalle completo en [`10-despliegue-produccion-y-acceso-privado.md`](./10-despliegue-produccion-y-acceso-privado.md).
