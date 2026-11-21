# 10. Despliegue en Producción (Vercel + Railway) y Control de Acceso Privado

## 1. Arquitectura de Despliegue Elegida

El proyecto es un monorepo `pnpm` (`pnpm@12.9.1`) compuesto por un frontend Next.js 16 y un backend NestJS 11 con procesos persistentes en segundo plano:

- **Frontend (`apps/web`) → Vercel**
  - Next.js 16.4 (App Router + Turbopack), React 19, Tailwind CSS v4.
  - Incluye proxy BFF (`/api/proxy/[...path]`), `Proxy (Middleware)` de control de acceso (`src/proxy.ts`) y `robots.txt` dinámico.
- **Backend + Datos (`apps/api`, PostgreSQL 15 y Redis 7) → Railway**
  - NestJS 11 necesita un contenedor **encendido 24/7** (no Serverless puro) porque ejecuta el worker de BullMQ (`FlightSearchWorker`), el `@Cron` periódico de alertas (`AlertSchedulerService`) y sesiones conversacionales en memoria del agente IA **Vera**.
  - **Región recomendada:** `Europe West (Amsterdam, Netherlands)` (`europe-west4`) para los **3 servicios** (API, PostgreSQL y Redis) con el fin de minimizar la latencia entre ellos y desde España/Europa.
  - **Réplicas:** mantener **1 sola réplica** en la API para evitar duplicar ejecuciones del `@Cron` o perder sesiones en memoria del chat.

---

## 2. Preparación Técnica Aplicada al Repositorio

Para garantizar despliegues reproducibles y sin fallos en contenedor:

1. **Docker y configuración de Railway:**
   - `apps/api/Dockerfile`: imagen `node:22-slim` con `openssl` y `ca-certificates` (requeridos por Prisma 6), instalación de `pnpm@12.9.1`, `pnpm install --filter api --frozen-lockfile`, `prisma generate`, `nest build` y arranque mediante `pnpm exec prisma migrate deploy && exec node dist/main`.
   - `railway.json`: indica a Railway el `Dockerfile` (`apps/api/Dockerfile`), el healthcheck `GET /health` (`healthcheckTimeout: 120`) y la política de reinicio ante fallos.
   - `.dockerignore`: evita subir `node_modules`, `.next`, `.env*`, `.git` y documentación en el contexto de build.
2. **Conexión Redis preparada para Railway (`apps/api/src/app.module.ts`):**
   - `buildRedisConnection()` soporta `REDIS_URL` (incluyendo `username`, `password`, `db` y `rediss://` TLS) y activa `family: 0` (resolución dual-stack IPv4/IPv6), imprescindible para conectar a la red privada interna de Railway (`*.railway.internal`).
   - Mantiene compatibilidad total con `REDIS_HOST` / `REDIS_PORT` en desarrollo local.
3. **CORS y binding de red (`apps/api/src/main.ts`):**
   - Escucha explícitamente en `0.0.0.0` (`app.listen(process.env.PORT ?? 3001, '0.0.0.0')`).
   - Restringe CORS mediante `CORS_ORIGIN` (admite múltiples dominios separados por coma y limpia barras finales `/`).
4. **Healthcheck (`apps/api/src/application/controllers/health.controller.ts`):**
   - Endpoint ligero `GET /health` que responde `{ status: "ok", timestamp }` para la verificación de disponibilidad de Railway.
5. **Assets en compilación (`apps/api/nest-cli.json` y `airports.controller.ts`):**
   - `nest-cli.json` copia automáticamente `src/application/skills/**/*.md` a `dist/application/skills/` para que **Vera** pueda leer sus `SKILL.md` en producción.
   - `AirportsController` busca `prisma/airports-seed.json` en rutas relativas al `cwd` y al `dist/` para autosembrar los +8.000 aeropuertos IATA al primer arranque.

---

## 3. Capas de Acceso Privado (Activables por Variable de Entorno)

Todas las medidas de privacidad y protección disponen de **flags activables/desactivables** desde el panel de variables de entorno de Vercel y Railway sin necesidad de modificar el código fuente.

### 3.1. Evitar Indexación en Buscadores (Frontend)
- **Archivos:** `apps/web/src/app/robots.ts` y `apps/web/src/proxy.ts`.
- **Flag:** `BLOCK_SEARCH_ENGINES="true"` (se activa también automáticamente si `PRIVATE_ACCESS_ENABLED="true"` y `BLOCK_SEARCH_ENGINES` no es `"false"`).
- **Efecto:** sirve `robots.txt` con `Disallow: /` y añade la cabecera HTTP `X-Robots-Tag: noindex, nofollow, noarchive` en todas las respuestas.

### 3.2. Puerta Privada por Enlace de Invitación (`?key=...`) (Frontend)
- **Archivo:** `apps/web/src/proxy.ts` (Next.js 16 `Proxy`).
- **Flags:** `PRIVATE_ACCESS_ENABLED="true"` y `SITE_ACCESS_KEY="<clave-secreta>"`.
- **Flujo de funcionamiento:**
  1. Cualquier visita sin cookie válida a páginas (`/`, `/login`) o a `/api/proxy/*` recibe `403 Acceso privado`.
  2. Al abrir el enlace de invitación `https://tu-app.vercel.app/?key=<SITE_ACCESS_KEY>`, el proxy valida la clave con comparación en tiempo constante (`crypto.timingSafeEqual`), emite una cookie `HttpOnly` firmada (`vflights_access`, válida 30 días, con HMAC-SHA256 derivado de `SITE_ACCESS_KEY`) y redirige (`302`) a `/` limpiando `?key=...` de la URL.
  3. Desactivando `PRIVATE_ACCESS_ENABLED="false"`, la web queda accesible sin enlace secreto.

### 3.3. Ocultación del Backend mediante Proxy BFF + Secreto de Gateway (Frontend + Backend)
- **Archivos:**
  - Frontend: `apps/web/src/app/api/proxy/[...path]/route.ts` y `apps/web/src/lib/api.ts`.
  - Backend: `apps/api/src/infrastructure/auth/api-gateway.guard.ts` (registrado como `APP_GUARD` global en `AppModule`).
- **Flags:**
  - En Vercel: `NEXT_PUBLIC_USE_API_PROXY="true"`, `API_INTERNAL_URL="https://tu-api.up.railway.app"`, `API_GATEWAY_ENABLED="true"` y `API_GATEWAY_SECRET="<secreto-compartido>"`.
  - En Railway: `API_GATEWAY_ENABLED="true"` y `API_GATEWAY_SECRET="<mismo-secreto-compartido>"`.
- **Efecto:**
  - El navegador llama únicamente a `/api/proxy/...` dentro de Vercel; la URL real de Railway no aparece en el bundle cliente ni en las DevTools.
  - Vercel reenvía la petición desde el servidor inyectando la cabecera `x-api-gateway-secret`.
  - `ApiGatewayGuard` en NestJS bloquea con `403 Forbidden` cualquier petición directa a Railway que no incluya ese secreto (dejando exento únicamente `GET /health` y preflight `OPTIONS`).
  - Si `API_GATEWAY_ENABLED="false"` (o no está definido), el guard permite peticiones directas (útil en desarrollo local o pruebas con Postman/cURL).

### 3.4. Control de Registro de Nuevos Usuarios (Backend)
- **Archivo:** `apps/api/src/application/controllers/auth.controller.ts` (`POST /auth/register`).
- **Flags:**
  - `ALLOW_REGISTRATION="false"`: bloquea por completo el registro de nuevas cuentas (`403 Forbidden`), permitiendo solo `login` a cuentas ya existentes.
  - `ALLOWED_EMAILS="correo1@ejemplo.com,correo2@ejemplo.com"`: lista blanca opcional (insensible a mayúsculas) de correos autorizados a registrarse. Si se deja vacía y `ALLOW_REGISTRATION` no es `"false"`, el registro queda abierto.

---

## 4. Variables de Entorno

Plantillas disponibles en `apps/api/.env.example` y `apps/web/.env.example`.

### 4.1. Railway (`apps/api`)

| Variable | Ejemplo / Valor recomendado | Descripción |
|---|---|---|
| `NODE_ENV` | `production` | Entorno de ejecución |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Referencia al servicio PostgreSQL en Railway |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` | Referencia al servicio Redis en Railway |
| `JWT_SECRET` | Cadena aleatoria de 64 chars hex | Clave de firma JWT (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `JWT_EXPIRATION` | `7d` | Caducidad del token JWT |
| `CORS_ORIGIN` | `https://tu-app.vercel.app` | Origen permitido para CORS (sin `/` final) |
| `API_GATEWAY_ENABLED` | `true` / `false` | Activa o desactiva el bloqueo de acceso directo al backend |
| `API_GATEWAY_SECRET` | Secreto compartido con Vercel | Valor esperado en la cabecera `x-api-gateway-secret` |
| `ALLOW_REGISTRATION` | `true` / `false` | Permite o bloquea `POST /auth/register` |
| `ALLOWED_EMAILS` | `tu@email.com,tutor@uni.es` | Lista blanca de emails permitidos en registro (vacío = cualquiera) |
| `USE_AGENT_MOCK` | `false` (`true` para demo sin coste) | Activa Gemini real (`false`) o motor local determinista (`true`) |
| `GOOGLE_GENAI_API_KEY` | API Key de Google AI Studio | Requerida si `USE_AGENT_MOCK="false"` |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Modelo de Gemini para Vera |
| `USE_IGNAV_MOCK` | `false` (`true` para demo sin coste) | Activa Ignav API real (`false`) o simulador (`true`) |
| `IGNAV_API_KEY` | API Key de Ignav | Requerida si `USE_IGNAV_MOCK="false"` |
| `TELEGRAM_BOT_TOKEN` | Token de `@BotFather` | Envío de notificaciones push por Telegram |
| `ALERT_CRON_SCHEDULE` | `0 */6 * * *` | Expresión Cron para revisar alertas activas |

### 4.2. Vercel (`apps/web`)

| Variable | Ejemplo / Valor recomendado | Descripción |
|---|---|---|
| `NEXT_PUBLIC_USE_API_PROXY` | `true` / `false` | `true` usa `/api/proxy` (oculta Railway). *Requiere redeploy si cambia* |
| `API_INTERNAL_URL` | `https://tu-api.up.railway.app` | URL de Railway usada solo desde el servidor de Vercel |
| `NEXT_PUBLIC_API_URL` | `https://tu-api.up.railway.app` | Solo necesaria si `NEXT_PUBLIC_USE_API_PROXY="false"` |
| `BLOCK_SEARCH_ENGINES` | `true` / `false` | Activa `robots.txt` restrictivo y cabecera `X-Robots-Tag: noindex` |
| `PRIVATE_ACCESS_ENABLED` | `true` / `false` | Activa la puerta privada mediante enlace `/?key=...` |
| `SITE_ACCESS_KEY` | Clave secreta de invitación | Clave que se adjunta en `https://tu-app.vercel.app/?key=...` |
| `API_GATEWAY_ENABLED` | `true` / `false` | Envía `x-api-gateway-secret` desde `/api/proxy` hacia Railway |
| `API_GATEWAY_SECRET` | Secreto compartido con Railway | Debe coincidir exactamente con el configurado en Railway |

---

## 5. Guía Paso a Paso de Despliegue

### Paso 1: Subir cambios al repositorio remoto
```bash
git add .
git commit -m "chore: configure production deployment and private access controls"
git push
```

### Paso 2: Configurar Railway (Backend + PostgreSQL + Redis)
1. Crear un nuevo proyecto en [railway.com](https://railway.com).
2. Añadir **PostgreSQL** y **Redis** en la región **Europe West (Amsterdam, Netherlands)**.
3. Añadir el repositorio de GitHub (`flight-comparison-tool`) como nuevo servicio:
   - Dejar el **Root Directory** en la raíz `/` del repositorio (detectará `railway.json` y `apps/api/Dockerfile`).
   - Configurar región **Europe West (Amsterdam, Netherlands)** y **1 réplica**.
4. Cargar las variables de entorno de la tabla **4.1**.
5. En **Settings → Networking → Public Networking**, pulsar **Generate Domain** para obtener la URL pública (ej. `https://vflights-api.up.railway.app`).
6. Verificar que `GET https://<tu-dominio-railway>/health` devuelve `{"status":"ok",...}`.

### Paso 3: Configurar Vercel (Frontend)
1. Ir a [vercel.com](https://vercel.com) → **Add New → Project** e importar el repositorio de GitHub.
2. Configurar:
   - **Root Directory:** `apps/web`
   - **Framework Preset:** `Next.js`
3. Cargar las variables de entorno de la tabla **4.2** (apuntando `API_INTERNAL_URL` a la URL de Railway generada en el Paso 2).
4. Pulsar **Deploy**.

### Paso 4: Ajustar `CORS_ORIGIN` y compartir el acceso
1. Copiar la URL final asignada por Vercel (ej. `https://vflights.vercel.app`) y guardarla en `CORS_ORIGIN` dentro de Railway.
2. Compartir con las personas autorizadas el enlace privado:
   ```text
   https://vflights.vercel.app/?key=TU_SITE_ACCESS_KEY
   ```

---

## 6. Checklist de Verificación Post-Despliegue

- [ ] Entrar a `https://tu-app.vercel.app` sin `?key` devuelve `403 Acceso privado` (si `PRIVATE_ACCESS_ENABLED="true"`).
- [ ] Entrar a `https://tu-app.vercel.app/?key=<SITE_ACCESS_KEY>` redirige a `/` limpia y muestra la aplicación.
- [ ] Llamar directamente a `https://tu-api.up.railway.app/airports` sin cabecera devuelve `403` (si `API_GATEWAY_ENABLED="true"`), mientras que `/health` responde `200 OK`.
- [ ] `https://tu-app.vercel.app/robots.txt` devuelve `Disallow: /` (si `BLOCK_SEARCH_ENGINES="true"`).
- [ ] Registro / Login / Logout funcionan correctamente (PostgreSQL + JWT + blacklist en Redis).
- [ ] El selector de aeropuertos devuelve resultados de los +8.000 aeropuertos IATA autosembrados.
- [ ] Crear una alerta encola y procesa el trabajo en BullMQ y envía la notificación a Telegram.
- [ ] El chat de **Vera** carga los `SKILL.md` y responde correctamente.

---

## 7. Cómo Cambiar entre Modo Privado y Modo Público

- **Para abrir la aplicación al público general sin tocar código:**
  1. En **Vercel**: cambiar `PRIVATE_ACCESS_ENABLED="false"` y (opcionalmente) `BLOCK_SEARCH_ENGINES="false"`, y hacer redeploy.
  2. En **Railway**: cambiar `ALLOW_REGISTRATION="true"` y vaciar `ALLOWED_EMAILS` si deseas registro abierto.
  3. Puedes mantener `NEXT_PUBLIC_USE_API_PROXY="true"` y `API_GATEWAY_ENABLED="true"` incluso en modo público si prefieres seguir ocultando la URL directa de Railway.
