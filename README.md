# V Flights (Flight Comparison Tool) - Comparador Inteligente de Vuelos Recurrentes

Plataforma SaaS diseñada para detectar oportunidades de vuelo basadas en patrones semanales flexibles (por ejemplo, viajar siempre de viernes a domingo o de lunes a miércoles) dentro de un rango temporal, número de pasajeros, preferencia de escalas (solo vuelos directos o con escalas) y un límite de presupuesto opcional (pudiendo buscar también el vuelo más barato posible sin tope).

Incorpora a **Vera**, un agente conversacional de Inteligencia Artificial Multi-Skill que procesa peticiones en lenguaje natural, recomienda destinos verificando conexiones directas y orquesta la monitorización asíncrona mediante tareas en segundo plano y avisos enriquecidos por Telegram.

Proyecto desarrollado como **Trabajo de Fin de Máster (TFM)** en Desarrollo de Software con Inteligencia Artificial (BigSchool).

---

## Recursos de Entrega del TFM

| Recurso | Enlace / Acceso |
|---|---|
| **Aplicación desplegada (Producción)** | [https://flight-comparison-tool.vercel.app/](https://flight-comparison-tool.vercel.app/) *(requiere parámetro `?key=...` de acceso privado; la clave de invitación se adjunta en el formulario de entrega de BigSchool)* |
| **Repositorio público (GitHub)** | [https://github.com/seforox/flight-comparison-tool](https://github.com/seforox/flight-comparison-tool) |
| **Presentación (Slides)** | `<!-- TODO: Añadir URL pública de Google Slides / Canva / PowerPoint o enlazar archivo adjunto (ej. ./docs/presentacion-v-flights.pdf) -->` _[Enlace pendiente de añadir]_ |
| **Vídeo explicativo (con captura de pantalla)** | `<!-- TODO: Añadir URL pública de YouTube / Google Drive con la explicación y captura de pantalla -->` _[Enlace pendiente de añadir]_ |

---

## Acceso a la Aplicación y Credenciales de Prueba

### 1. Acceso al Despliegue en Producción
La plataforma está desplegada en producción con una arquitectura distribuida (**Vercel** para el frontend Next.js y **Railway** para el backend NestJS, PostgreSQL 15 y Redis 7).

Por seguridad y control de cuotas de API externas, el despliegue cuenta con una puerta de acceso privado activable por variable de entorno (`PRIVATE_ACCESS_ENABLED`):
- **URL base:** [https://flight-comparison-tool.vercel.app/](https://flight-comparison-tool.vercel.app/)
- **Acceso con clave de invitación:** `https://flight-comparison-tool.vercel.app/?key=<CLAVE_ADJUNTA_EN_BIGSCHOOL>`
  > La clave `key` se entrega directamente en el formulario de evaluación de **BigSchool**. Al abrir el enlace con `?key=...`, se emite una cookie `HttpOnly` firmada (válida durante 30 días) y se redirige automáticamente a la aplicación limpia.

Para más detalles sobre la arquitectura de despliegue y las capas de privacidad, consulta [`docs/10-despliegue-produccion-y-acceso-privado.md`](./docs/10-despliegue-produccion-y-acceso-privado.md).

### 2. Usuario y Contraseña de Prueba
Puedes iniciar sesión directamente desde `/login` con la siguiente cuenta de evaluación:

- **Email:** `tfmbigschool@test.com`
- **Contraseña:** `tfmbigschoolpass`

> **Opcional (Notificaciones en Telegram):** Una vez dentro del panel, puedes vincular tu propio `Chat ID` desde el botón **Telegram** de la barra superior siguiendo la guía interactiva de 3 pasos (`@userinfobot` ➔ `@asistente_comparador_vuelos_bot`).

---

## Stack Tecnológico

* **Frontend (`apps/web`):** Next.js `16.4.6` (App Router + Turbopack + `Proxy`), React `19.3.0`, TypeScript 5, Tailwind CSS v4, diseño accesible (WAI-ARIA) y responsivo bajo la marca **V Flights**.
* **Backend (`apps/api`):** NestJS 11, TypeScript, Arquitectura Hexagonal (Puertos y Adaptadores), validación estricta con `class-validator` / `class-transformer` y pruebas unitarias con Jest (TDD).
* **Base de Datos & ORM:** PostgreSQL 15, Prisma ORM 6 (con histórico de migraciones SQL y catálogo autosembrado de **+8.000 aeropuertos IATA** + códigos metropolitanos).
* **Colas, Asincronía y Sesiones:** Redis 7, BullMQ 5 (control de tasa, deduplicación por alerta, cancelación de jobs), `@nestjs/schedule` (Cron Job configurable) y lista negra de tokens JWT en Redis.
* **Inteligencia Artificial:** Firebase Genkit + Google Gemini API (`@genkit-ai/googleai`, *Structured Outputs*) con arquitectura modular basada en `SKILL.md` (`DEFINED_SEARCH` y `DESTINATION_RECOMMENDER`) y motor local determinista de respaldo (`USE_AGENT_MOCK`).
* **Servicios Externos:** Ignav Flight API (datos de vuelos reales en vivo y modo Mock configurable `USE_IGNAV_MOCK`), Telegram Bot API vía `telegraf` (notificaciones push enriquecidas).
* **Infraestructura y Despliegue:** Monorepo gestionado con `pnpm workspaces` (`pnpm@12.9.1`), Docker y Docker Compose (desarrollo local), **Vercel** (frontend + BFF Proxy `/api/proxy`) y **Railway** (backend Dockerizado 24/7 + PostgreSQL + Redis).

---

## Estructura del Proyecto

```text
flight-comparison-tool/
├── apps/
│   ├── api/                                      # Backend NestJS 11 (Puerto 3001)
│   │   ├── prisma/
│   │   │   ├── migrations/                       # Histórico SQL (init, adults, airports, directOnly, maxPriceEur opcional)
│   │   │   ├── airports-seed.json                # Catálogo semilla con +8.000 aeropuertos IATA mundiales
│   │   │   ├── seed-airports.js                  # Script auxiliar de sembrado manual de aeropuertos
│   │   │   └── schema.prisma                     # Esquema de datos (User, Alert, Match, Airport)
│   │   ├── src/
│   │   │   ├── domain/                           # Capa de Dominio (Puertos, DTOs con validaciones y Calculadora de Fechas)
│   │   │   ├── application/                      # Casos de Uso (Controladores, Scheduler, Processor, Agente IA y Skills)
│   │   │   │   ├── controllers/                  # Auth, Alerts, Agent, Airports y HealthController
│   │   │   │   ├── services/                     # AlertScheduler, FlightSearchProcessor, AlertParserAgent (+ tests .spec.ts)
│   │   │   │   └── skills/                       # defined-search/SKILL.md y destination-recommender/SKILL.md
│   │   │   ├── infrastructure/                   # Adaptadores (IgnavAdapter, TelegramAdapter, Prisma, Auth JWT/Redis, ApiGatewayGuard, Worker)
│   │   │   ├── genkit.flows.ts                   # Flujos exportados para Firebase Genkit Developer UI
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── .env.example                          # Plantilla de variables de entorno del backend
│   │   └── Dockerfile                            # Imagen de producción para Railway (node:22-slim + Prisma + NestJS)
│   └── web/                                      # Frontend Next.js 16 "V Flights" (Puerto 3000)
│       ├── public/                               # Activos estáticos e identidad visual (logo.jpg, iconos)
│       ├── src/
│       │   ├── app/
│       │   │   ├── api/proxy/[...path]/route.ts  # Proxy BFF en servidor para ocultar el backend y reenviar cabeceras seguras
│       │   │   ├── login/page.tsx                # Inicio de sesión y registro con botón para mostrar/ocultar contraseña
│       │   │   ├── robots.ts                     # Generación dinámica de robots.txt según BLOCK_SEARCH_ENGINES
│       │   │   ├── layout.tsx                    # Layout raíz en español con skip-link de accesibilidad
│       │   │   ├── page.tsx                      # Dashboard principal (Comparador, Mis alertas, Modal guía de Telegram)
│       │   │   └── globals.css                   # Estilos globales Tailwind CSS v4
│       │   ├── components/
│       │   │   ├── LandingView.tsx               # Landing Page pública explicativa para usuarios no autenticados
│       │   │   ├── CreateAlertForm.tsx           # Buscador de patrones semanales con atajos de fecha, escalas y precio opcional
│       │   │   ├── AirportSelector.tsx           # Selector autocompletable conectado a los +8.000 aeropuertos IATA
│       │   │   ├── AlertCard.tsx                 # Detalle de alerta, edición inline, tuplas y gráfica comparativa
│       │   │   └── AgentChatbot.tsx              # Widget flotante y ampliable del Agente IA "Vera" (botón compacto en móvil)
│       │   ├── lib/
│       │   │   └── api.ts                        # Cliente HTTP tipado (directo o vía /api/proxy), gestión JWT y caché de aeropuertos
│       │   └── proxy.ts                          # Next.js Proxy: puerta de acceso privado (?key=...) y cabecera X-Robots-Tag
│       └── .env.example                          # Plantilla de variables de entorno del frontend
├── docs/                                         # Documentación técnica detallada (01 al 10)
├── docker-compose.yml                            # Servicios de infraestructura local (PostgreSQL 15 y Redis 7)
├── railway.json                                  # Configuración de build Docker y healthcheck (/health) para Railway
├── .dockerignore                                 # Exclusiones para la imagen Docker de producción
├── package.json                                  # Scripts raíz del monorepo (dev, build, test:api)
├── pnpm-workspace.yaml                           # Configuración del monorepo pnpm
├── SPEC.md                                       # Especificación técnica del sistema
├── AGENTS.md                                     # Reglas de desarrollo, arquitectura y TDD
└── README.md
```

---

## Funcionalidades Principales

1. **Gestión de Alertas por Patrones Semanales, Pasajeros, Escalas y Presupuesto Flexible:**
   - Configuración de alertas basadas en días fijos de la semana (ej. salida en viernes y regreso en domingo), rango de fechas, número de pasajeros (`adults`), preferencia de escalas (`directOnly`: solo vuelos directos o con escalas) y presupuesto máximo **opcional** (`maxPriceEur`, pudiendo dejarlo vacío para buscar el vuelo más barato disponible).
   - Validaciones de negocio en frontend y backend para impedir búsquedas inválidas (mismo aeropuerto de origen y destino, ida y vuelta el mismo día o rangos sin combinaciones válidas).
   - Edición inline de cualquier parámetro de una alerta activa o pausada directamente desde la interfaz.
2. **Buscador Global de +8.000 Aeropuertos IATA:**
   - Base de datos autosembrada al arranque con más de 8.000 aeropuertos mundiales e inclusión de códigos metropolitanos (`LON`, `PAR`, `ROM`, `TYO`, `NYC`, `TCI`, `MIL`, `STO`, etc.), ordenados por popularidad y relevancia, combinada con caché híbrida en memoria en el frontal.
3. **Ciclo de Vida Inteligente (`ACTIVE`, `PAUSED`, `TRIGGERED`, `COMPLETED`):**
   - Pausa manual para ahorrar cuota y silenciar avisos (cancelando jobs pendientes en BullMQ).
   - Paso automático a `TRIGGERED` (*Vuelo encontrado*) en cuanto se detecta al menos un vuelo válido que cumpla los criterios de la alerta, evitando spam en ejecuciones repetidas.
   - Aviso proactivo tras nuevos ciclos del Cron (`pendingCompletionPrompt`) preguntando al usuario si desea archivar la alerta como `COMPLETED` o mantenerla activa.
   - Expiración automática a `COMPLETED` cuando el rango de fechas finaliza.
4. **Agente IA Conversacional Multi-Skill ("Vera"):**
   - **Skill 1 (`DEFINED_SEARCH`):** Extrae rutas, días de la semana, fechas o meses naturales, número de pasajeros, preferencia de escalas (directo/escalas) y presupuesto opcional; aclara automáticamente si el presupuesto es **máximo por persona o máximo total** cuando viajan varios pasajeros y solicita confirmación explícita antes de crear la alerta.
   - **Skill 2 (`DESTINATION_RECOMMENDER`):** Solicita primero el aeropuerto de origen, verifica la disponibilidad de vuelos directos desde dicho origen y presenta **5 recomendaciones interactivas** adaptadas a la temática (playa, montaña, país concreto o escapadas económicas).
5. **Interfaz Visual "V Flights" (Next.js 16 + React 19):**
   - **Landing Page pública** explicativa con demostración visual de escapadas semanales.
   - **Panel de Control en dos vistas:** *Comparador de vuelos* (buscador + última alerta en tiempo real) y *Mis alertas* (filtros combinados por estado y escalas, grid responsivo con paginación por scroll en móvil y gráfica comparativa de barras por combinación de fechas).
   - **Accesibilidad y UX móvil:** Navegación por teclado, skip-link, atributos WAI-ARIA, botón de mostrar/ocultar contraseña en `/login`, guía paso a paso integrada para vincular Telegram y widget flotante de Vera minimizado en la esquina inferior derecha en dispositivos móviles.
6. **Motor Asíncrono y Notificaciones Push en Telegram:**
   - Búsqueda inmediata al crear o editar la alerta y revisión recurrente mediante Cron Job (`ALERT_CRON_SCHEDULE`), enviando un resumen unificado por Telegram con aerolínea, escalas, hora de salida, duración y enlace directo a Google Flights (incluyendo filtro de vuelos directos cuando aplica).
7. **Seguridad Multicapa:**
   - Autenticación JWT con `bcryptjs`, protección por Guards, validación global con `ValidationPipe` y cierre de sesión real (`POST /auth/logout`) con revocación en Redis.
   - Capas opcionales de privacidad para producción activables por entorno: puerta de acceso por enlace con `?key=...` (`src/proxy.ts`), proxy BFF (`/api/proxy`) + `ApiGatewayGuard` (`x-api-gateway-secret`), bloqueo de indexación (`robots.txt` + `X-Robots-Tag`) y control de registro (`ALLOW_REGISTRATION` / `ALLOWED_EMAILS`).

---

## Instalación y Ejecución en Local

### Requisitos Previos

- **Node.js v20+** (recomendado v22) y **`pnpm`** (`pnpm@12.9.1`).
- **Docker** y **Docker Compose** en ejecución.
- API Key de [Ignav](https://ignav.com/) *(opcional si se usa `USE_IGNAV_MOCK="true"`)*.
- API Key de Google Gemini (`GOOGLE_GENAI_API_KEY`, *opcional si se usa `USE_AGENT_MOCK="true"`*).
- Token de un bot de Telegram creado en [@BotFather](https://t.me/BotFather) *(opcional si no se requieren notificaciones reales en local)*.

### Pasos de Instalación

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/seforox/flight-comparison-tool.git
   cd flight-comparison-tool
   ```

2. **Configurar variables de entorno:**
   - **Backend:** Copiar `apps/api/.env.example` a `apps/api/.env` y ajustar los valores (para desarrollo local con Docker puedes dejar `DATABASE_URL` y `REDIS_URL` por defecto, `CORS_ORIGIN="http://localhost:3000"`, `API_GATEWAY_ENABLED="false"`, y activar `USE_IGNAV_MOCK="true"` / `USE_AGENT_MOCK="true"` si quieres probar sin API keys externas).
   - **Frontend (opcional en local):** Si deseas configurar proxy o acceso privado en local, copia `apps/web/.env.example` a `apps/web/.env.local`. Por defecto, sin `.env.local`, el frontend apunta directamente a `http://localhost:3001`.

3. **Levantar la infraestructura local (PostgreSQL 15 y Redis 7):**
   ```bash
   docker compose up -d
   ```

4. **Instalar dependencias y aplicar migraciones de base de datos:**
   ```bash
   pnpm install
   cd apps/api
   npx prisma migrate deploy
   cd ../..
   ```
   *(Al iniciar el backend, `AirportsController` verificará y sembrará automáticamente los +8.000 aeropuertos IATA desde `apps/api/prisma/airports-seed.json`).*

5. **Iniciar la aplicación en modo desarrollo:**
   - **Backend + Frontend en paralelo desde la raíz:**
     ```bash
     pnpm dev
     ```
   - **O por separado en dos terminales:**
     - Backend (NestJS en `http://localhost:3001`): `pnpm dev:api`
     - Frontend (Next.js en `http://localhost:3000`): `pnpm dev:web`

6. **Ejecutar tests unitarios (Jest) y compilación:**
   ```bash
   pnpm test:api
   pnpm build
   ```
   *(Para abrir la interfaz de depuración de **Firebase Genkit**, ejecuta `cd apps/api && pnpm genkit:ui`).*

---

## Presentación y Vídeo Explicativo

### Slides del Proyecto
> `<!-- TODO: Sustituir por el enlace público a Google Slides / PowerPoint / Canva o subir el documento a ./docs/ y enlazarlo aquí -->`
- **Enlace a la presentación:** _[Añadir URL pública de las slides o ruta al archivo en el repositorio]_

### Vídeo Explicativo (con captura de pantalla)
> `<!-- TODO: Sustituir por el enlace público a YouTube / Google Drive -->`
- **Enlace al vídeo demostrativo:** _[Añadir URL pública del vídeo con la explicación del proyecto y captura de pantalla]_

---

## Índice de Documentación Técnica (`docs/`)

1. [`01-infraestructura-y-arquitectura.md`](./docs/01-infraestructura-y-arquitectura.md): Monorepo `pnpm`, Docker Compose, Arquitectura Hexagonal y componentes de producción.
2. [`02-modelo-de-datos-y-migraciones.md`](./docs/02-modelo-de-datos-y-migraciones.md): Esquema Prisma (`User`, `Alert`, `Match`, `Airport`), ciclo de vida, presupuesto opcional e histórico de migraciones.
3. [`03-dominio-tdd-y-motor-asincrono.md`](./docs/03-dominio-tdd-y-motor-asincrono.md): Desarrollo TDD, agrupación de búsquedas, deduplicación en BullMQ y recordatorios de completado en el Cron.
4. [`04-proveedor-vuelos-ignav-y-mocks.md`](./docs/04-proveedor-vuelos-ignav-y-mocks.md): Adaptador `IgnavAdapter`, filtrado de vuelos directos (`directOnly`), enlaces a Google Flights y catálogo de Mocks.
5. [`05-seguridad-jwt-y-notificaciones-telegram.md`](./docs/05-seguridad-jwt-y-notificaciones-telegram.md): Autenticación JWT, revocación en Redis, control de registro, `ApiGatewayGuard` y notificaciones en Telegram.
6. [`06-agente-conversacional-y-skills.md`](./docs/06-agente-conversacional-y-skills.md): Agente IA "Vera", arquitectura Multi-Skill (`SKILL.md`), verificación de vuelos directos, presupuesto opcional/por persona/total y Genkit Flows.
7. [`07-guia-de-pruebas-postman-curl.md`](./docs/07-guia-de-pruebas-postman-curl.md): Colección completa de ejemplos `cURL` para probar Auth, Aeropuertos, Alertas y el Agente IA.
8. [`08-arquitectura-y-componentes-frontend.md`](./docs/08-arquitectura-y-componentes-frontend.md): Arquitectura del Frontend **V Flights** (Next.js 16 + React 19), proxy BFF, cliente API, caché de aeropuertos y desglose de componentes.
9. [`09-ux-ui-accesibilidad-y-flujos-frontal.md`](./docs/09-ux-ui-accesibilidad-y-flujos-frontal.md): Diseño UX/UI, flujos interactivos, gráficas comparativas, responsividad móvil y accesibilidad WAI-ARIA.
10. [`10-despliegue-produccion-y-acceso-privado.md`](./docs/10-despliegue-produccion-y-acceso-privado.md): Guía de despliegue en Vercel + Railway, variables de entorno y capas de acceso privado activables por flag.
