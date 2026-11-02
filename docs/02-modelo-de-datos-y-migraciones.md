# 02. Modelo de Datos y Migraciones (Prisma)

## 1. Entidades Principales (`schema.prisma`)
El esquema en PostgreSQL consta de tres modelos principales relacionados con borrado en cascada (`onDelete: Cascade`):
- **`User`:** Credenciales (`email`, `passwordHash`) y canal de notificación (`telegramChatId`).
- **`Alert`:** Configuración de búsqueda recurrente (`originIata`, `destinationIata`, `departureDay`, `returnDay`, `adults`, `maxPriceEur`, `startDate`, `endDate`, `status`).
- **`Match`:** Historial de vuelos baratos encontrados para cada alerta (`departureDate`, `returnDate`, `foundPriceEur`, `airlineCode`, `bookingUrl`, `notifiedAt`).

## 2. Ciclo de Vida y Estados de una Alerta (`AlertStatus`)
Se definieron 4 estados con responsabilidades claras:
1. **`ACTIVE`:** Estado inicial. El Cron Job la revisa periódicamente y busca ofertas.
2. **`PAUSED`:** Pausada manualmente por el usuario. Permite silenciar notificaciones y ahorrar cuota de la API externa sin borrar la configuración ni el historial de `Matches`.
3. **`TRIGGERED`:** Estado automático al que pasa una alerta **únicamente cuando se ha recorrido su rango de fechas y se ha encontrado al menos un vuelo dentro del presupuesto**. Evita que el sistema vuelva a buscar y notificar repetidamente la misma alerta en siguientes ejecuciones del Cron.
4. **`COMPLETED`:** Fin del ciclo de vida de la alerta. Se alcanza de dos formas:
   - **Automática:** Cuando `AlertSchedulerService` detecta que `endDate` ya ha expirado o que ya no quedan combinaciones futuras posibles de ida y vuelta dentro del rango.
   - **Manual:** Cuando el usuario la marca como completada vía `PATCH /alerts/:id/status` (por ejemplo, tras haber comprado su billete).

## 3. Estrategia de Histórico de Base de Datos (`prisma/migrations`)
Se acordó mantener tanto `schema.prisma` (estado actual y generador de tipos TS) como la carpeta `prisma/migrations/` (historial paso a paso en SQL):
- `20261102000000_init`: Migración base con `User`, `Alert`, `Match` y `AlertStatus`.
- `20261102172000_add_adults_to_alert`: Añade la columna `adults INT NOT NULL DEFAULT 1` a la tabla `Alert` para permitir búsquedas por número de pasajeros.
