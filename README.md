# Flight Comparison tool - Comparador Inteligente de Vuelos Recurrentes

Plataforma SaaS diseñada para detectar oportunidades de vuelo basadas en patrones semanales flexibles (ej. viajar siempre de lunes a miércoles) dentro de un rango temporal y con un límite de presupuesto. Incorpora un agente de Inteligencia Artificial que procesa peticiones en lenguaje natural y orquesta la monitorización asíncrona mediante tareas en segundo plano y avisos por Telegram.

Proyecto desarrollado como Trabajo de Fin de Máster (TFM) en Desarrollo de Software con Inteligencia Artificial.

---

## Stack Tecnológico

* **Frontend:** Next.js (React 19, App Router), TypeScript, Tailwind CSS, shadcn/ui.
* **Backend:** NestJS, TypeScript, arquitectura modular con puertos y adaptadores.
* **Base de Datos & ORM:** PostgreSQL, Prisma ORM.
* **Colas y Asincronía:** Redis, BullMQ (gestión de rate-limiting y reintentos automáticos).
* **Inteligencia Artificial:** Vercel AI SDK / LangChain.js con Function Calling estructurado (Zod Schema).
* **Servicios Externos:** Amadeus for Developers API (datos de vuelos), Telegram Bot API (notificaciones push).
* **Infraestructura:** Docker y Docker Compose.

---

## Estructura del Proyecto

```text
flight-radar-ai/
├── apps/
│   ├── api/                      # Backend NestJS
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/         # Autenticación y gestión de usuarios
│   │   │   │   ├── alerts/       # Lógica y CRUD de alertas de vuelo
│   │   │   │   ├── flight-search/# Integración con APIs de vuelos y adaptadores
│   │   │   │   ├── scheduler/    # Workers y colas BullMQ
│   │   │   │   ├── notifications/# Adaptador del bot de Telegram
│   │   │   │   └── agent/        # Agente de lenguaje natural y structured outputs
│   │   │   ├── prisma/           # Esquema y migraciones de base de datos
│   │   │   └── main.ts
│   │   └── test/
│   └── web/                      # Frontend Next.js
│       ├── src/
│       │   ├── app/              # Rutas y páginas (App Router)
│       │   ├── components/       # Componentes de UI (shadcn/ui)
│       │   └── lib/              # Cliente de API y utilidades
├── docker-compose.yml            # Servicios de soporte (Postgres y Redis)
├── SPEC.md                       # Especificación técnica
├── AGENTS.md                     # Reglas de desarrollo y TDD
└── README.md
```

## Funcionalidades Principales

1. **Gestión de Alertas por Patrones:** Configuración de alertas basadas en días fijos de la semana (ej. ida en lunes, vuelta en miércoles) con presupuesto máximo garantizado.

2. **Creación Asistida por IA:** Creación de alertas mediante lenguaje natural (ej. *"Búscame vuelos de Madrid a Londres de lunes a miércoles por menos de 80 € en mayo"*), parseadas automáticamente por un LLM con validación de tipos.

3. **Motor Asíncrono de Monitorización:** Búsqueda recurrente en segundo plano con control estricto de llamadas concurrentes para respetar las cuotas de las APIs de aviación.

4. **Notificaciones Push Inmediatas:** Envío instantáneo de alertas a través de Telegram con enlace de reserva y resumen del vuelo.

## Instalación y Ejecución

### Requisitos Previos

- Node.js v20+ y npm/pnpm.
- Docker y Docker Compose instalados y en ejecución.
- Cuenta de desarrollador en [Amadeus for Developers](https://developers.amadeus.com/) (para obtener credenciales de prueba).
- Un bot creado en Telegram a través de [@BotFather](https://t.me/BotFather) (para obtener el token).

### Pasos de Instalación

1. **Clonar el repositorio:**

   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd flight-radar-ai
   ```

2. **Configurar variables de entorno:** Copia el archivo de plantilla y completa tus credenciales:

   ```bash
   cp .env.example .env
   ```

3. **Levantar la infraestructura (Base de Datos y Redis):**

   ```bash
   docker compose up -d
   ```

4. **Instalar dependencias y ejecutar migraciones:**

   ```bash
   npm install
   cd apps/api
   npx prisma migrate dev --name init
   npx prisma db seed # Opcional: genera el usuario de prueba
   ```

5. **Iniciar en modo desarrollo:**

   - **Backend (NestJS):**

     ```bash
     cd apps/api && npm run start:dev
     ```

   - **Frontend (Next.js):**

     ```bash
     cd apps/web && npm run dev
     ```

La aplicación web estará accesible en `http://localhost:3000` y la API en `http://localhost:4000/api`.

## Usuario y Contraseña de Prueba

Para evaluar la aplicación de inmediato sin necesidad de completar el registro manual:

- **Email:** `demo@flightradar.ai`
- **Contraseña:** `Demo1234!`
- **Chat ID de Telegram de prueba:** Puedes vincular tu propio ID en la sección de perfil o usar el bot de pruebas configurado en el archivo `.env`.