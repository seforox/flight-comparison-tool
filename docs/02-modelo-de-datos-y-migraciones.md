# 02. Modelo de Datos y Migraciones (Prisma)

## 1. Entidades Principales (`schema.prisma`)
El esquema en PostgreSQL consta de cuatro modelos principales (los tres primeros relacionados con borrado en cascada `onDelete: Cascade`):
- **`User`:** Credenciales (`email`, `passwordHash`) y canal de notificación (`telegramChatId`).
- **`Alert`:** Configuración de búsqueda recurrente (`originIata`, `destinationIata`, `departureDay`, `returnDay`, `adults`, `directOnly`, `maxPriceEur`, `startDate`, `endDate`, `status`), además del flag de aviso tras ciclo Cron (`pendingCompletionPrompt`).
- **`Match`:** Historial de vuelos baratos encontrados para cada alerta (`departureDate`, `returnDate`, `foundPriceEur`, `airlineCode`, `bookingUrl`, `notifiedAt`).
- **`Airport`:** Catálogo global de **+8.000 aeropuertos IATA** (`iata` como clave primaria, `name`, `city`, `country`, `popularity`) indexado por `city`, `country` y `popularity DESC` para alimentar el buscador autocompletable del frontend y la resolución de ciudades en el Agente IA.

## 2. Ciclo de Vida y Estados de una Alerta (`AlertStatus`)
Se definieron 4 estados con responsabilidades claras:
1. **`ACTIVE` (*Buscando*):** Estado inicial (y al reactivar o editar una alerta). El Cron Job la revisa periódicamente y busca ofertas.
2. **`PAUSED` (*En pausa*):** Pausada manualmente por el usuario. Cancela cualquier job pendiente en BullMQ, silencia notificaciones y ahorra cuota de la API externa sin borrar la configuración ni el historial de `Matches`.
3. **`TRIGGERED` (*Vuelo encontrado*):** Estado automático al que pasa una alerta **únicamente cuando se ha recorrido su rango de fechas y se ha encontrado al menos un vuelo dentro del presupuesto** (respetando también `directOnly`). Evita que el sistema vuelva a buscar y notificar repetidamente la misma alerta en siguientes ejecuciones del Cron.
   - **Recordatorio en el siguiente ciclo Cron (`pendingCompletionPrompt`):** Si el Cron vuelve a ejecutarse y la alerta continúa en estado `TRIGGERED`, `AlertSchedulerService` activa `pendingCompletionPrompt = true` para que la interfaz web pregunte al usuario si desea **Completar** la alerta o **Mantenerla** activa.
4. **`COMPLETED` (*Completada*):** Fin del ciclo de vida de la alerta (se muestra archivada con estilo dorado en el frontal y queda bloqueada frente a ediciones o reactivaciones). Se alcanza de dos formas:
   - **Automática:** Cuando `AlertSchedulerService` detecta que `endDate` ya ha expirado o que ya no quedan combinaciones futuras posibles de ida y vuelta dentro del rango.
   - **Manual:** Cuando el usuario la marca como completada vía `PATCH /alerts/:id/status` (por ejemplo, tras haber reservado su billete).

## 3. Autosembrado de Aeropuertos y Códigos Metropolitanos (`AirportsController`)
Al arrancar el módulo (`onModuleInit`), `AirportsController` garantiza que la tabla `Airport` exista y esté poblada:
- Si la tabla está vacía, lee `apps/api/prisma/airports-seed.json` e inserta en lotes de 500 registros los **+8.000 aeropuertos IATA** mundiales.
- Además, inyecta códigos metropolitanos multi-aeropuerto (`ensureMetroCodesInDb`) como `LON` (Londres), `PAR` (París), `ROM` (Roma), `MIL` (Milán), `TCI` (Tenerife Norte/Sur), `TYO` (Tokio Haneda/Narita), `NYC` (Nueva York), `STO` (Estocolmo), `BUE`, `SAO`, `RIO`, `REK` y `BUH`.
- También se incluye el script independiente `apps/api/prisma/seed-airports.js` por si se desea ejecutar el sembrado manualmente desde consola.

## 4. Estrategia de Histórico de Base de Datos (`prisma/migrations`)
Se mantiene tanto `schema.prisma` como la carpeta `prisma/migrations/` con el historial paso a paso en SQL:
- `20261102000000_init`: Migración base con `User`, `Alert`, `Match` y `AlertStatus`.
- `20261102172000_add_adults_to_alert`: Añade la columna `adults INT NOT NULL DEFAULT 1` a la tabla `Alert` para búsquedas por número de pasajeros.
- `20261109170000_add_airports_table`: Crea la tabla `Airport` y sus índices de búsqueda rápida (`Airport_city_idx`, `Airport_country_idx`, `Airport_popularity_idx`).
- `20261109172500_add_direct_only_to_alert`: Añade la columna `directOnly BOOLEAN NOT NULL DEFAULT false` a la tabla `Alert` para distinguir búsquedas de vuelos exclusivamente directos frente a vuelos con escalas.
- `20261123130000_make_max_price_optional`: Hace nullable la columna `maxPriceEur` en `Alert` (`DROP NOT NULL`) para permitir alertas sin límite máximo de precio.
