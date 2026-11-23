# 05. Seguridad, Autenticación JWT y Notificaciones en Telegram

## 1. Validación Global de Entrada (`ValidationPipe`) y Protección de Gateway
En `main.ts` se configuró CORS restringido mediante la variable `CORS_ORIGIN` y un `ValidationPipe` global de NestJS con:
- `whitelist: true`: Elimina automáticamente cualquier campo JSON que no esté declarado en el DTO.
- `forbidNonWhitelisted: true`: Rechaza con `400 Bad Request` cualquier petición que intente inyectar propiedades no permitidas.
- `transform: true`: Convierte tipos primitivos automáticamente.

Adicionalmente, para entornos de producción se añadieron capas de protección activables por variable de entorno (detalladas en [`10-despliegue-produccion-y-acceso-privado.md`](./10-despliegue-produccion-y-acceso-privado.md)):
- **`ApiGatewayGuard` (`API_GATEWAY_ENABLED` / `API_GATEWAY_SECRET`):** Guard global que exige la cabecera `x-api-gateway-secret` emitida por el proxy BFF de Vercel (dejando exento `GET /health`).
- **Control de registro (`ALLOW_REGISTRATION` / `ALLOWED_EMAILS`):** Permite cerrar el registro de nuevas cuentas o limitarlo a una lista blanca de correos electrónicos.

## 2. Autenticación Criptográfica, Perfil y Cierre de Sesión (`AuthController`)
- **Sustitución de `bcrypt` por `bcryptjs`:** En Windows con Node.js v24 y las políticas de seguridad de `pnpm` v10+, el binario nativo en C++ de `bcrypt` (`bcrypt_lib.node`) provocaba errores `MODULE_NOT_FOUND`. Se migró a `bcryptjs` (100% JavaScript puro, sin compilación nativa), manteniendo el mismo estándar de seguridad con *salt* de 10 rondas.
- **Firma y Verificación JWT (`JWT_SECRET`):**
  - `POST /auth/register` y `POST /auth/login` firman tokens JWT con el secreto de `.env`.
  - `GET /auth/me` devuelve el perfil del usuario autenticado (`id`, `email`, `telegramChatId`, `createdAt`) para que el frontend **V Flights** recupere la sesión al cargar y determine si mostrar la Landing Page pública o el Dashboard.
  - Los controladores `AlertsController` y `AgentController` están protegidos al completo con `@UseGuards(JwtAuthGuard)`.
- **Revocación de Tokens en Redis (`POST /auth/logout`):**
  - Dado que los JWT son *stateless* por naturaleza, se implementó `TokenBlacklistService` apoyado en Redis.
  - Cuando el usuario cierra sesión desde la barra superior del frontend (`POST /auth/logout`), su token se almacena en Redis bajo la clave `blacklist:jwt:<token>` con un tiempo de expiración (`EX`) igual al tiempo restante de validez del token, y se elimina de `localStorage`.
  - `JwtStrategy` consulta Redis en cada petición y rechaza inmediatamente con `401 Unauthorized` cualquier token revocado.

## 3. Notificaciones Enriquecidas en Telegram (`TelegramAdapter`)
- Se integró la librería `telegraf` conectada mediante `TELEGRAM_BOT_TOKEN`.
- **Vinculación desde el Frontend:** En la barra superior del Dashboard de **V Flights**, el botón **Vincular Telegram / Telegram** abre un modal accesible con una guía interactiva en 3 pasos (consultar el ID numérico en `@userinfobot`, iniciar el bot de alertas `@asistente_comparador_vuelos_bot` con `/start` y pegar el `telegramChatId` para guardarlo vía `PATCH /auth/telegram`).
- **Formato del mensaje unificado:**
  ```text
  ✈️ ¡Vuelos encontrados para MAD ➔ LON! (2 pasajeros | Máx: 100 EUR)

  📅 2026-11-02 ➔ 2026-11-04
  💰 45.5 EUR | 🏢 Aerolínea: Ryanair
  ✈️ Directo | 🕒 Salida: 08:30 | ⏱️ Duración: ~2h 30m
  🔗 https://www.google.com/travel/flights?q=Flights%20to%20LON%20from%20MAD%20on%202026-11-02%20through%202026-11-04%20for%202%20adults
  ```
