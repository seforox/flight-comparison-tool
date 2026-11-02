# 01. Infraestructura y Arquitectura Base

## 1. Estructura del Monorepo con `pnpm`
- Se configuró el proyecto como un **monorepo con `pnpm workspaces`** (`pnpm-workspace.yaml`), separando el backend en `apps/api` y dejando preparado el espacio para el frontend en `apps/web`.
- **Decisión sobre `node_modules`:** `pnpm` utiliza un almacén global con enlaces simbólicos (*symlinks*) en la raíz y dentro de `apps/api/node_modules` para evitar *phantom dependencies* (que un paquete importe librerías que no declaró en su propio `package.json`). Se actualizó `.gitignore` para excluir todas las carpetas `node_modules` y `dist`.

## 2. Infraestructura Local (`docker-compose.yml`)
Se levantaron dos contenedores ligeros basados en Alpine para dar soporte al entorno de desarrollo:
- **PostgreSQL 15 (`flight_db`):** Base de datos relacional principal en el puerto `5432`.
- **Redis 7 (`flight_redis`):** Almacén en memoria en el puerto `6379` utilizado tanto para las colas de trabajos de **BullMQ** como para la **lista negra de tokens JWT (`TokenBlacklistService`)**.

## 3. Arquitectura Hexagonal (Puertos y Adaptadores)
Para desacoplar el núcleo de negocio de las herramientas externas, `apps/api/src` se estructuró en tres capas estrictas:
- **`domain/` (Núcleo puro):**
  - Servicios de dominio sin dependencias externas (`FlightDateCalculatorService`).
  - Interfaces/Puertos (`FlightSearchProvider`, `NotificationProvider`).
  - DTOs de entrada validados con `class-validator` (`CreateAlertDto`, `UpdateAlertStatusDto`, `AuthCredentialsDto`).
- **`application/` (Casos de uso y Orquestación):**
  - `FlightSearchProcessorService`: Evalúa precios, persiste coincidencias (`Match`) y dispara notificaciones.
  - `AlertSchedulerService`: Planificador Cron y encolador de alertas.
  - `AlertParserAgentService`: Extracción de alertas desde lenguaje natural con IA.
  - Controladores REST (`AlertsController`, `AuthController`, `AgentController`).
- **`infrastructure/` (Adaptadores concretos):**
  - `IgnavAdapter` (búsqueda de vuelos).
  - `TelegramAdapter` (notificaciones vía Telegraf).
  - `PrismaService` (acceso a datos en PostgreSQL).
  - `FlightSearchWorker` (consumidor BullMQ).
  - `JwtStrategy`, `JwtAuthGuard` y `TokenBlacklistService` (seguridad).
