# 03. Dominio, TDD y Motor Asíncrono (BullMQ)

## 1. Desarrollo Guiado por Pruebas (TDD)
Siguiendo las reglas de `AGENTS.md`, toda la lógica de negocio se construyó bajo el ciclo **Red-Green-Refactor** con Jest (`"types": ["jest", "node"]` en `tsconfig.json`):
- **`FlightDateCalculatorService`:** Calcula todas las tuplas `(departureDate, returnDate)` dentro de un rango `[startDate, endDate]` según los días ISO de la semana (1 = Lunes ... 7 = Domingo), contemplando años bisiestos, cambios de año y vueltas en la semana siguiente.
- **`AlertSchedulerService`:** Filtra fechas pasadas (usando `max(startDate, hoy)`), marca alertas expiradas como `COMPLETED`, gestiona la cancelación de trabajos en cola (`cancelAlertJobs`), marca avisos de completado (`markCompletionPrompt`) y encola trabajos en BullMQ incluyendo `adults` y `directOnly`.
- **`FlightSearchProcessorService`:** Procesa las combinaciones de fechas de una alerta, filtra tanto por `maxPriceEur` como por preferencia de escalas (`directOnly`), guarda el mejor vuelo de cada fecha en la tabla `Match`, envía un único resumen a Telegram y cambia el estado a `TRIGGERED` si hubo coincidencias.

## 2. Agrupación de Búsquedas por Alerta
- **Problema inicial:** Encolar un trabajo independiente por cada semana de un mes provocaba que el usuario recibiera 4 mensajes separados en Telegram para una sola alerta.
- **Solución implementada:** `AlertSchedulerService` agrupa todas las tuplas de fechas válidas (`dateTuples`) de una alerta en **un único Job de BullMQ**, permitiendo que `FlightSearchProcessorService` envíe **un solo mensaje unificado** con todos los vuelos encontrados.

## 3. Prevención de Condiciones de Carrera y Cancelación de Jobs
- **Doble candado de deduplicación:**
  1. **BullMQ `jobId: alert.id`:** Se asigna el ID de la alerta como identificador único del trabajo en Redis (`removeOnComplete: true`, `removeOnFail: true`). Redis impide que existan dos trabajos para la misma alerta simultáneamente.
  2. **Verificación previa en el Worker:** Antes de iniciar las llamadas HTTP externas, `FlightSearchProcessorService` verifica en PostgreSQL que la alerta continúe en estado `ACTIVE`.
- **Cancelación activa (`cancelAlertJobs`):** Cuando el usuario pausa, completa, modifica o elimina una alerta desde el frontend, `AlertSchedulerService` retira inmediatamente cualquier trabajo pendiente en Redis para esa alerta.

## 4. Ciclo Cron y Recordatorio de Alertas Encontradas (`pendingCompletionPrompt`)
- Se integró `@nestjs/schedule` en `AlertSchedulerService` con la expresión configurable desde `.env` mediante `ALERT_CRON_SCHEDULE` (por defecto `"0 */6 * * *"` cada 6 horas, o `"* * * * *"` para pruebas locales).
- En cada ejecución de `handleCron()`:
  1. **Revisión de alertas en `TRIGGERED`:** Si una alerta ya tenía vuelos encontrados (`TRIGGERED`) y el usuario aún no la ha pasado a `COMPLETED`, se marca `pendingCompletionPrompt = true`. De este modo, el frontend muestra un banner y notificación interactiva preguntando si desea **Completar alerta** o **Mantener** la búsqueda activa.
  2. **Revisión de alertas en `ACTIVE`:** Encola todas las alertas activas vigentes para buscar nuevas bajadas de precio.
