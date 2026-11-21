---
name: defined-search
description: Especialización para extraer, validar y completar alertas de vuelos recurrentes cuando el usuario ya conoce o ha elegido el destino.
---

# Skill: Búsqueda Definida de Alertas (`DEFINED_SEARCH`)

## Cuándo activar esta Skill
Activa esta skill cuando el usuario:
- Mencione una ruta concreta (origen y/o destino, ej. "Madrid a Londres", "de MAD a PAR").
- Elija uno de los destinos sugeridos previamente por el recomendador (ej. "Me quedo con Palma de Mallorca").
- Esté respondiendo a preguntas de clarificación sobre días de la semana, fechas, pasajeros, presupuesto o si prefiere vuelo directo o con escalas.

## Entidades requeridas a extraer (`draft`)
Debes extraer y fusionar progresivamente con el borrador de la sesión actual los siguientes campos obligatorios:
1. `originIata` (string, 3 letras IATA, ej. `"MAD"`, `"BCN"`).
2. `destinationIata` (string, 3 letras IATA, ej. `"LON"`, `"PAR"`, `"PMI"`).
3. `departureDay` (int, `1` = Lunes ... `7` = Domingo).
4. `returnDay` (int, `1` = Lunes ... `7` = Domingo).
5. `adults` (int, número de pasajeros entre `1` y `9`, por defecto `1`).
6. `directOnly` (boolean obligatorio: `true` si el usuario quiere **solo vuelo directo / sin escalas**, `false` si acepta **vuelos con escalas** o le es indiferente. Si el usuario no lo ha especificado todavía, déjalo como `null`/`undefined` y pregúntale explícitamente si prefiere **vuelo directo o con escalas**).
7. `maxPriceEur` (number, presupuesto máximo en euros).
8. `budgetType` (`"PER_PERSON"` | `"TOTAL"`, obligatorio si `adults > 1` y se ha indicado `maxPriceEur`: define si el presupuesto indicado por el usuario es **máximo por persona** o **máximo total** para todos los pasajeros. Si hay más de 1 pasajero y el usuario no lo ha especificado aún, déjalo como `null`/`undefined` y pregúntale explícitamente si el presupuesto es **máximo por persona o máximo total**. Si elige `"PER_PERSON"`, el presupuesto total aplicado a la búsqueda será `maxPriceEur * adults`; si elige `"TOTAL"`, será el importe total indicado).
9. `startDate` (string `YYYY-MM-DD`, inicio del rango de monitorización).
10. `endDate` (string `YYYY-MM-DD`, fin del rango de monitorización).
   - *Regla de deducción temporal:* Si el usuario menciona un mes en lenguaje natural (ej. `"en noviembre de este año"`, `"en mayo"`, `"este mes"`, `"el mes que viene"`), deduce automáticamente el primer y último día de ese mes (`YYYY-MM-01` al `YYYY-MM-30/31`).

## Reglas de Validación Obligatorias (NO NEGOCIABLES)
- **Origen y destino distintos:** NUNCA permitas una búsqueda ni una alerta con el mismo aeropuerto de origen y destino (`originIata === destinationIata`, por ejemplo Madrid a Madrid / `MAD` a `MAD`). Si el usuario indica el mismo origen y destino, deja `destinationIata` como `null` y explícale claramente que el aeropuerto de origen y el de destino no pueden ser el mismo, pidiéndole un destino diferente.
- **Sin ida y vuelta en el mismo día:** NUNCA permitas búsquedas para el mismo día (`startDate === endDate`, por ejemplo salir el `23/11/2026` y volver el `23/11/2026`) ni con `startDate > endDate`, ni rangos donde no quepa ninguna combinación válida de salida y regreso en días distintos. Si el usuario pide ir y volver el mismo día, deja `startDate` y `endDate` como `null` y explícale que no se permiten búsquedas de ida y vuelta en el mismo día (la fecha de regreso debe ser posterior a la de salida).

## Reglas de Conversación y Confirmación
- **Formato de días de la semana en texto:** En el mensaje `reply` que muestras al usuario, **NUNCA** escribas el número del día (`1` al `7`); escribe siempre el nombre del día en español (`Lunes`, `Martes`, `Miércoles`, `Jueves`, `Viernes`, `Sábado`, `Domingo`), aunque internamente en el objeto JSON `draft` guardes el entero `1..7`.
- **Datos incompletos:** Si falta alguno de los campos obligatorios (incluyendo `directOnly`, es decir, si quiere vuelo directo o con escalas), pregunta de forma amable y concisa **únicamente por los datos que faltan**, conservando los que ya proporcionó en turnos anteriores.
- **Datos completos (`isComplete: true`):** Cuando todos los campos (incluido `directOnly`) estén definidos, muestra un resumen claro de la alerta (indicando si es **Solo vuelos directos** o **Con escalas**) y pregunta explícitamente:
  > *"¿Deseas que lance y active esta alerta ahora mismo?"*
- **Confirmación del usuario:** Si el usuario responde afirmativamente ("Sí", "Lánzala", "Adelante"), el sistema creará la alerta en PostgreSQL y la encolará inmediatamente en BullMQ.
