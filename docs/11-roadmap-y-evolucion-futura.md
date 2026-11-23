# 11. Roadmap y Evolución Futura (Post-MVP)

Este documento recoge las líneas de evolución planificadas para **V Flights** fuera del alcance del MVP entregado en el TFM, detallando tanto la propuesta de valor de producto (comunicaciones y monetización *Freemium*) como las mejoras arquitectónicas y de calidad técnica necesarias para escalar el servicio en producción.

---

## 1. Gestión de Cuenta y Comunicaciones Multicanal

1. **Verificación de correo electrónico en el registro:**
   - Añadir campos `emailVerifiedAt` y token de verificación temporal (en PostgreSQL o Redis con TTL) para validar las cuentas recién registradas antes de habilitar la creación de alertas.
2. **Notificaciones de alertas por correo electrónico:**
   - Gracias a la **Arquitectura Hexagonal** y al puerto `NotificationProvider`, incorporar un adaptador `EmailNotificationAdapter` (por ejemplo, sobre **Resend** o **SendGrid**) que envíe el resumen de vuelos encontrados con aerolínea, escalas, precio y enlace directo a Google Flights, funcionando como alternativa o complemento a Telegram.
3. **Recuperación de contraseña y panel de perfil:**
   - Flujo completo de *"¿Olvidaste tu contraseña?"* mediante enlace firmado de un solo uso con caducidad corta.
   - Sección de configuración de cuenta para cambiar contraseña y elegir las **preferencias de canal de notificación** (Telegram, Email o ambos).
4. **Inicio de sesión social (OAuth2 con Google):**
   - Integración de autenticación con Google para reducir la fricción en el alta y facilitar la conversión de nuevos usuarios.

---

## 2. Capa de Monetización y Modelo *Freemium* (Free vs. Pro)

Para hacer sostenible el consumo de APIs externas (Ignav Flight API y Google Gemini) y ofrecer valor avanzado a viajeros frecuentes, se plantea un modelo de suscripción en dos niveles gestionado mediante **Stripe** (pagos recurrentes, *webhooks* para sincronizar el plan del usuario en PostgreSQL y portal de autogestión de facturación).

### Comparativa de Funcionalidades por Plan

| Capacidad | Plan Gratuito (`FREE`) | Plan Suscripción (`PRO`) |
|---|---|---|
| **Ventana temporal máxima por alerta** | Máximo **1 mes** desde la fecha de inicio | Rango ampliado (ej. **3 a 6 meses**) |
| **Frecuencia de revisión automática (Cron)** | Intervalo estándar fijo (ej. cada 12–24 h) | **Configurable por el usuario** (ej. cada 1, 2 o 4 h) |
| **Actualización manual (`POST /alerts/:id/check`)** | **Deshabilitada:** la alerta espera al siguiente ciclo del Cron | **Habilitada bajo demanda** (con control de tasa razonable) |
| **Límite de alertas activas simultáneas** | Cupo reducido (ej. máx. **2–3 alertas**) | Cupo ampliado o **ilimitado** |
| **Agente IA "Vera" (`SKILL.md`)** | Solo **`DEFINED_SEARCH`** (creación guiada de búsqueda definida) | **`DEFINED_SEARCH` + `DESTINATION_RECOMMENDER`** (recomendador de 5 destinos con verificación de vuelos directos) |
| **Canales de notificación** | Telegram o Email | Multicanal (Telegram + Email simultáneos) |
| **Análisis de precios y cobertura** | Gráfica comparativa por fecha | **Histórico de evolución de precios** + alertas **multi-origen / multi-destino** |

### Notas de Implementación Previstas
- **Modelo de datos (`schema.prisma`):** añadir `plan` (`FREE` | `PRO`), `stripeCustomerId`, `subscriptionStatus` en `User`, así como `checkIntervalHours` en `Alert` y una tabla `PriceSnapshot` para almacenar el histórico de precios por ruta y fecha.
- **Aplicación de reglas en backend:** validar en `AlertsController`, `AlertSchedulerService` y `AlertParserAgentService` los límites del plan del usuario (duración máxima de 1 mes, cupo de alertas activas, bloqueo de `POST /alerts/:id/check` en `FREE` y activación condicional de la skill `DESTINATION_RECOMMENDER`).
- **Histórico de precios:** registrar periódicamente el mejor precio detectado por combinación `(originIata, destinationIata, departureDate, returnDate)` para mostrar tendencias y destacar mínimos históricos en `AlertCard`.
- **Alertas multi-origen / multi-destino:** permitir a usuarios `PRO` vigilar en una única alerta varias ciudades de salida o varios destinos candidatos (por ejemplo, escapadas de fin de semana a Roma, Milán o Venecia simultáneamente).

---

## 3. Escalabilidad, Resiliencia y Calidad Técnica

1. **Persistencia de sesiones de Vera en Redis y escalado horizontal:**
   - Actualmente las sesiones conversacionales de `AlertParserAgentService` viven en memoria del proceso Node.js y el servicio de Railway opera con **1 réplica** para no perder conversaciones ni duplicar ejecuciones del `@Cron`.
   - Migrar el estado de sesión del chat a **Redis** (con TTL automático) e incorporar un **bloqueo distribuido** (*distributed lock* en Redis / *repeatable jobs* nativos de BullMQ) permitirá escalar la API horizontalmente a múltiples réplicas con alta disponibilidad.
2. **Caché compartida de búsquedas de vuelos en Redis (TTL):**
   - Almacenar temporalmente las respuestas de Ignav bajo una clave determinista (`flights:{origin}:{destination}:{dep}:{ret}:{adults}:{directOnly}`) con TTL configurable. Así, si varios usuarios monitorizan la misma ruta y fecha, se reutiliza el resultado evitando llamadas redundantes y reduciendo costes de API.
3. **Estrategia Multi-Proveedor de Vuelos (`FlightSearchProvider`):**
   - Aprovechando el desacoplamiento de la Arquitectura Hexagonal, añadir adaptadores adicionales (como **Duffel**, **Kiwi Tequila** o **Skyscanner API**) para comparar tarifas entre proveedores o activar un mecanismo de *fallback* automático si un proveedor sufre degradación o alcanza su cuota.
4. **Pipeline CI/CD y Pruebas End-to-End (E2E):**
   - Configurar **GitHub Actions** para ejecutar automáticamente en cada *push* y *Pull Request* los tests unitarios de Jest (`pnpm test:api`), comprobaciones de lint/tipado y `pnpm build` antes del despliegue en Vercel y Railway.
   - Incorporar una suite de pruebas **E2E con Playwright** que valide de extremo a extremo el registro/login, la creación y edición de alertas, el flujo del chat de **Vera** y el acceso mediante puerta privada.

---

## 4. Priorización Sugerida por Fases

| Fase | Foco Principal | Entregables Clave |
|---|---|---|
| **Fase 1 · Retención y Cuenta** | Confianza y alcance de notificaciones | Verificación de email, recuperación de contraseña, notificaciones por correo (`EmailNotificationAdapter`) y OAuth2 con Google |
| **Fase 2 · Monetización** | Sostenibilidad del producto | Integración con Stripe, planes `FREE` vs. `PRO`, límites de alertas/rango/recarga manual, frecuencia configurable y gating de `DESTINATION_RECOMMENDER` |
| **Fase 3 · Escala e Inteligencia** | Crecimiento y ventaja competitiva | Sesiones de Vera en Redis + multi-réplica, caché compartida de vuelos, histórico de precios, alertas multi-destino, multi-proveedor y CI/CD + E2E |
