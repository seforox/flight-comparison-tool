# V Flights (Flight Comparison Tool) - Comparador Inteligente de Vuelos Recurrentes

Plataforma SaaS diseñada para detectar oportunidades de vuelo basadas en patrones semanales flexibles (ej. viajar siempre de viernes a domingo o de lunes a miércoles) dentro de un rango temporal, número de pasajeros, preferencia de escalas (solo directo o con escalas) y un límite de presupuesto. Incorpora a **Vera**, un agente conversacional de Inteligencia Artificial Multi-Skill que procesa peticiones en lenguaje natural, recomienda destinos verificando conexiones directas y orquesta la monitorización asíncrona mediante tareas en segundo plano y avisos enriquecidos por Telegram.

Proyecto desarrollado como Trabajo de Fin de Máster (TFM) en Desarrollo de Software con Inteligencia Artificial.

---

## Stack Tecnológico

* **Frontend (`apps/web`):** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, diseño accesible (WAI-ARIA) y responsivo bajo la marca **V Flights**.
* **Backend (`apps/api`):** NestJS, TypeScript, Arquitectura Hexagonal (Puertos y Adaptadores).
* **Base de Datos & ORM:** PostgreSQL 15, Prisma ORM (con control histórico de migraciones y catálogo autosembrado de **+8.000 aeropuertos IATA**).
* **Colas, Asincronía y Sesiones:** Redis 7, BullMQ (rate-limiting, deduplicación por alerta, cancelación de jobs, `@nestjs/schedule` Cron Job y lista negra de tokens JWT).
* **Inteligencia Artificial:** Firebase Genkit + Google Gemini API con arquitectura modular basada en `SKILL.md` (`DEFINED_SEARCH` y `DESTINATION_RECOMMENDER`) y motor local determinista de respaldo (`USE_AGENT_MOCK`).
* **Servicios Externos:** Ignav Flight API (datos de vuelos en vivo y modo Mock configurable), Telegram Bot API vía `telegraf` (notificaciones push enriquecidas).
* **Infraestructura:** Docker y Docker Compose (monorepo gestionado con `pnpm workspaces`).

---

## Estructura del Proyecto

```text
flight-comparison-tool/
├── apps/
│   ├── api/                                      # Backend NestJS (Puerto 3001)
│   │   ├── prisma/
│   │   │   ├── migrations/                       # Histórico SQL de migraciones (init, adults, airports, directOnly)
│   │   │   ├── airports-seed.json                # Catálogo semilla con +8.000 aeropuertos IATA mundiales
│   │   │   ├── seed-airports.js                  # Script de sembrado manual/auxiliar de aeropuertos
│   │   │   └── schema.prisma                     # Esquema de datos (User, Alert, Match, Airport)
│   │   └── src/
│   │       ├── domain/                           # Capa de Dominio (Puertos, DTOs y Calculadora de Fechas)
│   │       ├── application/                      # Casos de Uso (Controladores, Scheduler, Processor, Agente IA y Skills)
│   │       │   ├── controllers/                  # AuthController, AlertsController, AgentController, AirportsController
│   │       │   ├── services/                     # AlertScheduler, FlightSearchProcessor, AlertParserAgent
│   │       │   └── skills/                       # defined-search/SKILL.md y destination-recommender/SKILL.md
│   │       ├── infrastructure/                   # Adaptadores (IgnavAdapter, TelegramAdapter, Prisma, Auth JWT/Redis, Worker)
│   │       ├── genkit.flows.ts                   # Flujos exportados para Firebase Genkit Developer UI
│   │       ├── app.module.ts
│   │       └── main.ts
│   └── web/                                      # Frontend Next.js "V Flights" (Puerto 3000)
│       ├── public/                               # Activos estáticos e identidad visual (logo.jpg, iconos)
│       └── src/
│           ├── app/
│           │   ├── login/page.tsx                # Página de inicio de sesión y registro de cuenta
│           │   ├── layout.tsx                    # Layout raíz en español con skip-link de accesibilidad
│           │   ├── page.tsx                      # Dashboard principal (Comparador, Mis alertas, Modal Telegram)
│           │   └── globals.css                   # Estilos globales Tailwind CSS v4
│           ├── components/
│           │   ├── LandingView.tsx               # Landing Page pública para usuarios no autenticados
│           │   ├── CreateAlertForm.tsx           # Buscador de patrones semanales con atajos de fecha y escalas
│           │   ├── AirportSelector.tsx           # Selector autocompletable conectado a los +8.000 aeropuertos IATA
│           │   ├── AlertCard.tsx                 # Detalle de alerta, edición inline, tuplas y gráfica comparativa
│           │   └── AgentChatbot.tsx              # Widget flotante y ampliable del Agente IA "Vera"
│           └── lib/
│               └── api.ts                        # Cliente HTTP tipado, gestión de JWT y caché de aeropuertos
├── docs/                                         # Documentación técnica detallada (01 al 09)
├── docker-compose.yml                            # Servicios de soporte (PostgreSQL 15 y Redis 7)
├── pnpm-workspace.yaml                           # Configuración del monorepo pnpm
├── SPEC.md                                       # Especificación técnica del sistema
├── AGENTS.md                                     # Reglas de desarrollo, arquitectura y TDD
└── README.md
```

---

## Funcionalidades Principales

1. **Gestión de Alertas por Patrones, Pasajeros y Escalas:** Configuración de alertas basadas en días fijos de la semana (ej. salida en viernes y regreso en domingo), número de pasajeros (`adults`), preferencia de escalas (`directOnly`: solo vuelos directos o con escalas) y presupuesto máximo (`maxPriceEur`). Permite **modificar cualquier parámetro** de una alerta activa o pausada directamente desde la interfaz.
2. **Buscador Global de +8.000 Aeropuertos IATA:** Base de datos autosembrada con más de 8.000 aeropuertos e inclusión de códigos metropolitanos (`LON`, `PAR`, `ROM`, `TYO`, `NYC`, `TCI`, `MIL`, `STO`) ordenados por popularidad y relevancia de coincidencia.
3. **Ciclo de Vida Inteligente (`ACTIVE`, `PAUSED`, `TRIGGERED`, `COMPLETED`):**
   - Pausa manual para ahorrar cuota y silenciar avisos (cancelando jobs pendientes en BullMQ).
   - Paso automático a `TRIGGERED` (*Vuelo encontrado*) al detectar ofertas válidas para evitar spam.
   - Aviso proactivo tras nuevos ciclos del Cron (`pendingCompletionPrompt`) preguntando al usuario si desea archivar la alerta como `COMPLETED` o mantenerla activa.
   - Expiración automática a `COMPLETED` cuando el rango de fechas finaliza.
4. **Agente IA Conversacional Multi-Skill ("Vera"):**
   - **Skill 1 (`DEFINED_SEARCH`):** Extrae rutas, días de la semana, fechas o meses naturales, número de pasajeros, tipo de vuelo (directo/escalas) y aclara automáticamente si el presupuesto es **máximo por persona o máximo total** cuando viajan varios pasajeros.
   - **Skill 2 (`DESTINATION_RECOMMENDER`):** Solicita primero el aeropuerto de origen, verifica la disponibilidad de vuelos directos desde dicho origen y presenta **5 recomendaciones interactivas** adaptadas a la temática (playa, montaña, Italia, escapadas económicas en Europa).
5. **Interfaz Visual "V Flights" (Next.js):**
   - **Landing Page pública** explicativa con demostración visual de escapadas semanales.
   - **Panel de Control en dos vistas:** *Comparador de vuelos* (buscador + última alerta en tiempo real) y *Mis alertas* (filtros combinados por estado y escalas, grid responsivo con paginación por scroll en móvil y gráfica comparativa de barras por combinación de fechas).
6. **Motor Asíncrono y Notificaciones Push en Telegram:** Búsqueda inmediata al crear o editar la alerta y recurrente mediante Cron Job (`ALERT_CRON_SCHEDULE`), enviando un resumen unificado a Telegram con aerolínea, escalas, hora de salida, duración y enlace directo a Google Flights.
7. **Seguridad JWT + Blacklist en Redis:** Registro y login con `bcryptjs`, protección por Guards, validación estricta con `ValidationPipe` y cierre de sesión real (`POST /auth/logout`) con revocación en Redis.

---

## Instalación y Ejecución

### Requisitos Previos

- Node.js v20+ y `pnpm` instalado.
- Docker y Docker Compose en ejecución.
- API Key de [Ignav](https://ignav.com/) (opcional si se usa `USE_IGNAV_MOCK="true"`).
- API Key de Google Gemini (`GOOGLE_GENAI_API_KEY`, opcional si se usa `USE_AGENT_MOCK="true"`).
- Un bot creado en Telegram a través de [@BotFather](https://t.me/BotFather).

### Pasos de Instalación

1. **Clonar el repositorio:**
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd flight-comparison-tool
   ```

2. **Configurar variables de entorno en `apps/api/.env`:**
   Configura `DATABASE_URL`, `REDIS_HOST`, `TELEGRAM_BOT_TOKEN`, `IGNAV_API_KEY`, `USE_IGNAV_MOCK`, `GOOGLE_GENAI_API_KEY`, `USE_AGENT_MOCK`, `JWT_SECRET` y `ALERT_CRON_SCHEDULE`.

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
   *(Al iniciar el backend, `AirportsController` verificará y sembrará automáticamente los +8.000 aeropuertos IATA desde `prisma/airports-seed.json`).*

5. **Iniciar en modo desarrollo:**
   - **Backend (NestJS en `http://localhost:3001`):**
     ```bash
     cd apps/api && pnpm start:dev
     ```
   - **Frontend (Next.js en `http://localhost:3000`):**
     ```bash
     cd apps/web && pnpm dev
     ```
   - **Ejecutar tests unitarios (Jest):**
     ```bash
     cd apps/api && pnpm test
     ```

---

## Índice de Documentación (`docs/`)

1. [`01-infraestructura-y-arquitectura.md`](./docs/01-infraestructura-y-arquitectura.md): Monorepo `pnpm`, Docker Compose y Arquitectura Hexagonal.
2. [`02-modelo-de-datos-y-migraciones.md`](./docs/02-modelo-de-datos-y-migraciones.md): Esquema Prisma (`User`, `Alert`, `Match`, `Airport`), ciclo de vida e histórico de migraciones.
3. [`03-dominio-tdd-y-motor-asincrono.md`](./docs/03-dominio-tdd-y-motor-asincrono.md): Desarrollo TDD, agrupación de búsquedas, deduplicación en BullMQ y recordatorios de completado en el Cron.
4. [`04-proveedor-vuelos-ignav-y-mocks.md`](./docs/04-proveedor-vuelos-ignav-y-mocks.md): Adaptador `IgnavAdapter`, filtrado de vuelos directos (`directOnly`) y catálogo de Mocks.
5. [`05-seguridad-jwt-y-notificaciones-telegram.md`](./docs/05-seguridad-jwt-y-notificaciones-telegram.md): Autenticación JWT, revocación en Redis, perfil `/auth/me` y notificaciones en Telegram.
6. [`06-agente-conversacional-y-skills.md`](./docs/06-agente-conversacional-y-skills.md): Agente IA "Vera", arquitectura Multi-Skill (`SKILL.md`), verificación de vuelos directos, presupuesto por persona/total y Genkit Flows.
7. [`07-guia-de-pruebas-postman-curl.md`](./docs/07-guia-de-pruebas-postman-curl.md): Colección completa de ejemplos `cURL` para probar Auth, Aeropuertos, Alertas y el Agente IA.
8. [`08-arquitectura-y-componentes-frontend.md`](./docs/08-arquitectura-y-componentes-frontend.md): Arquitectura del Frontend **V Flights** (Next.js 16 + React 19), cliente API, caché de aeropuertos y desglose de componentes.
9. [`09-ux-ui-accesibilidad-y-flujos-frontal.md`](./docs/09-ux-ui-accesibilidad-y-flujos-frontal.md): Diseño UX/UI, flujos interactivos de usuario, gráficas comparativas, responsividad móvil y accesibilidad WAI-ARIA.
