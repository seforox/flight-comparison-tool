# Flight Comparison Tool - Comparador Inteligente de Vuelos Recurrentes

Plataforma SaaS diseñada para detectar oportunidades de vuelo basadas en patrones semanales flexibles (ej. viajar siempre de lunes a miércoles) dentro de un rango temporal, número de pasajeros y un límite de presupuesto. Incorpora un agente de Inteligencia Artificial que procesa peticiones en lenguaje natural y orquesta la monitorización asíncrona mediante tareas en segundo plano y avisos enriquecidos por Telegram.

Proyecto desarrollado como Trabajo de Fin de Máster (TFM) en Desarrollo de Software con Inteligencia Artificial.

---

## Stack Tecnológico

* **Frontend:** Next.js (React 19, App Router), TypeScript, Tailwind CSS, shadcn/ui.
* **Backend:** NestJS, TypeScript, Arquitectura Hexagonal (Puertos y Adaptadores).
* **Base de Datos & ORM:** PostgreSQL, Prisma ORM (con control histórico de migraciones).
* **Colas, Asincronía y Sesiones:** Redis, BullMQ (rate-limiting, deduplicación por alerta, `@nestjs/schedule` Cron Job y lista negra de tokens JWT).
* **Inteligencia Artificial:** Firebase Genkit (Google AI / Gemini) con Structured Outputs.
* **Servicios Externos:** Ignav Flight API (datos de vuelos en vivo y modo Mock configurable), Telegram Bot API vía `telegraf` (notificaciones push).
* **Infraestructura:** Docker y Docker Compose (monorepo gestionado con `pnpm`).

---

## Estructura del Proyecto

```text
flight-comparison-tool/
├── apps/
│   ├── api/                                      # Backend NestJS (Puerto 3001)
│   │   ├── prisma/
│   │   │   ├── migrations/                       # Histórico SQL de migraciones
│   │   │   └── schema.prisma                     # Esquema de datos (User, Alert, Match)
│   │   └── src/
│   │       ├── domain/                           # Capa de Dominio (Puertos, DTOs y Calculadora de Fechas)
│   │       ├── application/                      # Casos de Uso (Controladores, Scheduler, Processor, Agente IA)
│   │       ├── infrastructure/                   # Adaptadores (IgnavAdapter, TelegramAdapter, Prisma, Auth JWT/Redis, Worker)
│   │       ├── app.module.ts
│   │       └── main.ts
│   └── web/                                      # Frontend Next.js (Puerto 3000)
├── docs/                                         # Documentación técnica paso a paso y guía de pruebas cURL
├── docker-compose.yml                            # Servicios de soporte (PostgreSQL y Redis)
├── pnpm-workspace.yaml                           # Configuración del monorepo pnpm
├── SPEC.md                                       # Especificación técnica del sistema
├── AGENTS.md                                     # Reglas de desarrollo, arquitectura y TDD
└── README.md
```

## Funcionalidades Principales

1. **Gestión de Alertas por Patrones y Pasajeros:** Configuración de alertas basadas en días fijos de la semana (ej. ida en lunes, vuelta en miércoles), número de pasajeros (`adults`) y presupuesto máximo (`maxPriceEur`).
2. **Ciclo de Vida Inteligente (`ACTIVE`, `PAUSED`, `TRIGGERED`, `COMPLETED`):**
   - Pausa manual para ahorrar cuota y silenciar avisos.
   - Paso automático a `TRIGGERED` al encontrar ofertas válidas para evitar spam.
   - Expiración automática a `COMPLETED` cuando el rango de fechas finaliza (o marcado manual por el usuario).
3. **Creación Asistida por IA:** Creación de alertas mediante lenguaje natural parseadas por un agente conversacional.
4. **Motor Asíncrono y Modo Mock/Real:** Búsqueda inmediata al crear la alerta y recurrente mediante Cron Job configurable (`ALERT_CRON_SCHEDULE`), con conmutador `USE_IGNAV_MOCK` para alternar entre pruebas locales gratuitas y llamadas reales a Ignav API.
5. **Notificaciones Push Unificadas en Telegram:** Envío de un único mensaje resumen por alerta con fechas, precio, nombre completo de la aerolínea, indicador de vuelo directo o con escalas, hora de salida, duración aproximada y enlace directo a la reserva.
6. **Seguridad JWT + Blacklist en Redis:** Registro y login con `bcryptjs`, protección por Guards, validación estricta con `ValidationPipe` y cierre de sesión real (`POST /auth/logout`) con revocación en Redis.

---

## Instalación y Ejecución

### Requisitos Previos

- Node.js v20+ y `pnpm` instalado.
- Docker y Docker Compose en ejecución.
- API Key de [Ignav](https://ignav.com/) (incluye 1.000 búsquedas gratuitas; opcional si se usa `USE_IGNAV_MOCK="true"`).
- Un bot creado en Telegram a través de [@BotFather](https://t.me/BotFather).

### Pasos de Instalación

1. **Clonar el repositorio:**
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd flight-comparison-tool
   ```

2. **Configurar variables de entorno en `apps/api/.env`:**
   Configura `DATABASE_URL`, `REDIS_HOST`, `TELEGRAM_BOT_TOKEN`, `IGNAV_API_KEY`, `USE_IGNAV_MOCK`, `JWT_SECRET` y `ALERT_CRON_SCHEDULE`.

3. **Levantar la infraestructura (PostgreSQL y Redis):**
   ```bash
   docker compose up -d
   ```

4. **Instalar dependencias y aplicar migraciones:**
   ```bash
   pnpm install
   cd apps/api
   npx prisma migrate deploy
   ```

5. **Iniciar en modo desarrollo:**
   - **Backend (NestJS):**
     ```bash
     cd apps/api && pnpm start:dev
     ```
   - **Ejecutar tests unitarios (Jest):**
     ```bash
     cd apps/api && pnpm test
     ```

La API estará disponible en `http://localhost:3001`. Consulta la carpeta [`docs/`](./docs/) (especialmente [`docs/06-guia-de-pruebas-postman-curl.md`](./docs/06-guia-de-pruebas-postman-curl.md)) para ver todos los ejemplos de peticiones `cURL`.
