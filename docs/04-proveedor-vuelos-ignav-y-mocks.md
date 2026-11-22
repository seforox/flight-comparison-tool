# 04. Proveedor de Vuelos (Migración de Amadeus a Ignav API) y Mocks

## 1. Motivo de la Migración a Ignav API
- En el diseño inicial se contempló *Amadeus for Developers Self-Service API*, pero dicho portal cerró su capa gratuita de pruebas en julio de 2026, pasando a contratos exclusivamente Enterprise.
- Gracias a la **Arquitectura Hexagonal** y la interfaz `FlightSearchProvider`, se eliminó por completo la dependencia de Amadeus y se implementó **`IgnavAdapter`** apuntando a **Ignav Flight API** (`POST https://ignav.com/api/fares/round-trip`), que ofrece una capa gratuita de 1.000 peticiones y datos detallados de aerolíneas, segmentos y horarios.

## 2. Conmutador Dinámico: Modo Mock vs. Modo Real (`USE_IGNAV_MOCK`)
Para poder desarrollar y probar todos los flujos sin agotar la cuota gratuita de Ignav API, `IgnavAdapter` evalúa la variable de entorno `USE_IGNAV_MOCK`:
- **`USE_IGNAV_MOCK="true"`:** Devuelve respuestas locales instantáneas desde `ignav.mocks.ts` según el código IATA de destino y la ruta:
  - `LON` / `STN` (y destinos directos por defecto) ➔ `CHEAP_FLIGHT` (45.50€ con Ryanair, directo, salida 08:30, 2h 30m).
  - `PAR` / `CDG` ➔ `REALISTIC_RESPONSE` (110.25€ con Air France, estructura completa ida y vuelta sin escalas).
  - `JFK` / `DXB` ➔ `EXPENSIVE_FLIGHT` (350.00€ con Iberia, para probar que NO salta la alerta si supera `maxPriceEur`).
  - `INN` (o rutas regionales con escala detectadas por `isMockLayoverRoute`) ➔ `LAYOVER_FLIGHT` (78.90€ con Lufthansa con 1 escala, `isDirect: false`, `stopsCount: 1`), ideal para verificar el filtro `directOnly` y la comprobación de vuelos directos del recomendador.
  - `XXX` ➔ `EMPTY_RESPONSE` (0 vuelos disponibles).
  - `429` ➔ Lanza error `HTTP 429 Too Many Requests` para probar la resiliencia del Worker.
- **`USE_IGNAV_MOCK="false"`:** Ejecuta la llamada HTTP POST real a `https://ignav.com/api/fares/round-trip` autenticada con el header `X-Api-Key: process.env.IGNAV_API_KEY`, enviando `origin`, `destination`, `departure_date`, `return_date`, `adults`, `cabin_class: 'economy'`, `market: 'ES'` y `max_stops: 0` cuando `directOnly` es `true`.

## 3. Información Extraída y Filtrado por Escalas (`directOnly`)
`IgnavAdapter` transforma cada itinerario en un `FlightSearchResult` enriquecido con:
- **Precio en EUR (`foundPriceEur`)**.
- **Nombre completo de la aerolínea (`airlineCode`):** Prioriza `outbound.carrier` / `operating_carrier_name` (ej. `"Ryanair"`, `"Iberia"`, `"Lufthansa"`) en lugar de solo el código IATA.
- **Escalas (`isDirect`, `stopsCount`):** Calculado a partir de los segmentos tanto de la ida (`outbound.segments`) como de la vuelta (`inbound.segments`), exigiendo 0 escalas en ambos tramos para marcar `isDirect: true`. Si la consulta incluye `directOnly: true`, tanto `IgnavAdapter` (enviando `max_stops: 0` y filtrando en local) como `FlightSearchProcessorService` descartan automáticamente cualquier itinerario con `isDirect === false`.
- **Hora de salida (`departureTime`):** Hora local extraída del primer segmento (`HH:mm`).
- **Duración aproximada (`durationMinutes`):** Formateada en horas y minutos (`~2h 30m`).
- **Enlace de reserva (`bookingUrl`):** URL parametrizada hacia Google Flights con origen, destino, fecha de ida, fecha de vuelta, número de pasajeros (`adults`) y filtro `Nonstop flights` cuando `directOnly` es `true`.
