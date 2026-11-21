# AGENTS.md - Reglas de Desarrollo y Operación para Agentes de IA

Este repositorio sigue directrices estrictas de arquitectura, calidad de código, control de base de datos, accesibilidad en frontend y metodología de pruebas. Cualquier agente autónomo o asistente de código debe cumplir estas normas sin excepción.

---

## 1. Reglas Generales de Comportamiento
1. **Consulta de SPEC.md y `docs/`:** Todo código debe ajustarse a las definiciones de `SPEC.md` y a las decisiones documentadas en la carpeta `docs/` (`01` a `09`). Prohibido inventar campos o módulos no contemplados.
2. **TypeScript y Compilación Limpia:** Mantén el código libre de errores de compilación tanto en el backend (`apps/api`) como en el frontend (`apps/web`). `pnpm build` debe finalizar con código 0.
3. **Gestión de Base de Datos e Histórico (Prisma Migrate):**
   - Cualquier cambio en `apps/api/prisma/schema.prisma` debe ir acompañado de su correspondiente archivo de migración SQL dentro de `apps/api/prisma/migrations/<timestamp>_<nombre>/migration.sql` para preservar el histórico de cambios.
4. **Protección de Cuota de APIs Externas (Ignav y Gemini):**
   - Mantén siempre funcionales los flags `USE_IGNAV_MOCK` en `IgnavAdapter` y `USE_AGENT_MOCK` en `AlertParserAgentService`. Los tests unitarios y el desarrollo local por defecto deben ejecutarse en modo Mock (`"true"`) para no consumir cuota real innecesariamente.

---

## 2. Metodología Obligatoria: Test-Driven Development (TDD) Estricto
La lógica de negocio (`FlightDateCalculatorService`, `AlertSchedulerService`, `FlightSearchProcessorService`, `AlertParserAgentService` y adaptadores como `IgnavAdapter`) debe desarrollarse y modificarse siguiendo el ciclo **Red-Green-Refactor**.

### Ciclo de Ejecución:
1. **Fase 1: RED (Test que falle primero):**
   - Escribe o actualiza la suite de pruebas unitarias en Jest (`*.spec.ts`) antes de modificar la implementación.
2. **Fase 2: GREEN (Código mínimo indispensable):**
   - Escribe el código necesario en el servicio o adaptador para que los tests pasen exitosamente.
3. **Fase 3: REFACTOR & EDGE CASES:**
   - Limpia duplicidades y asegura la cobertura de casos límite obligatorios:
     * Años bisiestos, rangos temporales que cruzan el cambio de año y fechas expiradas (`COMPLETED`).
     * Rangos donde la fecha de vuelta sea anterior o igual a la de ida.
     * Filtrado estricto de vuelos directos (`directOnly: true`) frente a vuelos con escalas (`directOnly: false`).
     * Clarificación de presupuesto por persona (`PER_PERSON`) frente a total (`TOTAL`) cuando `adults > 1`.
     * Prevención de condiciones de carrera (alertas que ya no están `ACTIVE` al iniciar el job).
     * Respuestas vacías o con tarifas nulas desde Ignav API, fallos por límite de cuota (HTTP 429) y caídas de red.

---

## 3. Patrones de Arquitectura en Backend (`apps/api`) y Frontend (`apps/web`)
* **Backend NestJS (Puertos y Adaptadores en `apps/api/src/`):**
  - `domain/`: Interfaces de proveedores (`FlightSearchProvider`, `NotificationProvider`), DTOs (`class-validator`) y servicios de dominio puros (`FlightDateCalculatorService`).
  - `application/`: Servicios orquestadores (`FlightSearchProcessorService`, `AlertSchedulerService`, `AlertParserAgentService`), definición de Skills (`skills/defined-search/SKILL.md`, `skills/destination-recommender/SKILL.md`) y controladores REST (`AlertsController`, `AuthController`, `AgentController`, `AirportsController`).
  - `infrastructure/`: Implementaciones concretas (`IgnavAdapter` y `ignav.mocks.ts`, `TelegramAdapter`, `PrismaService`, `FlightSearchWorker`, `JwtStrategy`, `JwtAuthGuard`, `TokenBlacklistService`).
  - Valida todas las peticiones entrantes con DTOs y el `ValidationPipe` global (`whitelist: true`, `forbidNonWhitelisted: true`).
* **Frontend Next.js (`apps/web/src/`):**
  - Centraliza todas las llamadas HTTP y la caché en memoria de aeropuertos en `src/lib/api.ts`.
  - Mantén la accesibilidad web (atributos `aria-*`, roles semánticos `dialog`, `listbox`, `log`, `status`, soporte de teclado con `Escape` y ausencia de botones interactivos anidados) y el diseño responsivo en móvil y escritorio.

---

## 4. Formato de Respuesta del Agente
Cuando se te asigne una tarea de implementación de lógica:
1. **Especificación del Test (RED):** Muestra o actualiza la prueba unitaria.
2. **Implementación Mínima (GREEN):** Implementa la solución en el servicio/adaptador.
3. **Casos Límite y Migraciones:** Añade los casos extremos y, si hubo cambios en el modelo de datos, genera la migración en `prisma/migrations/`.
4. **Verificación:** Ejecuta los tests correspondientes con `pnpm test` para comprobar que todo pasa en verde.
