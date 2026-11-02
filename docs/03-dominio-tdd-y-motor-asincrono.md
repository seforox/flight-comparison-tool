# 03. Dominio, TDD y Motor Asíncrono (BullMQ)

## 1. Desarrollo Guiado por Pruebas (TDD)
Siguiendo las reglas de `AGENTS.md`, toda la lógica de negocio se construyó bajo el ciclo **Red-Green-Refactor** con Jest (`"types": ["jest", "node"]` en `tsconfig.json`):
- **`FlightDateCalculatorService`:** Calcula todas las tuplas `(departureDate, returnDate)` dentro de un rango `[startDate, endDate]` según los días ISO de la semana (1 = Lunes ... 7 = Domingo), contemplando años bisiestos, cambios de año y vueltas en la semana siguiente.
- **`AlertSchedulerService`:** Filtra fechas pasadas (usando `max(startDate, hoy)`), marca alertas expiradas como `COMPLETED` y encola trabajos en BullMQ.
- **`FlightSearchProcessorService`:** Procesa las combinaciones de fechas de una alerta, filtra por `maxPriceEur`, guarda el mejor vuelo de cada fecha en la tabla `Match`, envía un único resumen a Telegram y cambia el estado a `TRIGGERED` si hubo coincidencias.

## 2. Agrupación de Búsquedas por Alerta
- **Problema inicial:** Encolar un trabajo independiente por cada semana de un mes provocaba que el usuario recibiera 4 mensajes separados en Telegram para una sola alerta.
- **Solución implementada:** `AlertSchedulerService` agrupa todas las tuplas de fechas válidas (`dateTuples`) de una alerta en **un único Job de BullMQ**, permitiendo que `FlightSearchProcessorService` envíe **un solo mensaje unificado** con todos los vuelos encontrados.

## 3. Prevención de Condiciones de Carrera (Deduplicación)
- **Problema detectado:** Al ejecutar la llamada real a la API de vuelos mientras un Cron de alta frecuencia estaba activo, el Cron podía volver a encolar una alerta que aún estaba siendo procesada (porque todavía no había terminado ni pasado a `TRIGGERED`).
- **Doble candado implementado:**
  1. **BullMQ `jobId: alert.id`:** Se asigna el ID de la alerta como identificador único del trabajo en Redis (`removeOnComplete: true`). Redis impide que existan dos trabajos para la misma alerta simultáneamente.
  2. **Verificación previa en el Worker:** Antes de iniciar las llamadas HTTP externas, `FlightSearchProcessorService` verifica en PostgreSQL que la alerta continúe en estado `ACTIVE`.

## 4. Cron Job Configurable
- Se integró `@nestjs/schedule` en `AlertSchedulerService` con la expresión configurable desde `.env` mediante `ALERT_CRON_SCHEDULE` (por defecto `"0 */6 * * *"` cada 6 horas, o `"* * * * *"` para pruebas locales).
