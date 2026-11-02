---
name: defined-search
description: Especialización para extraer, validar y completar alertas de vuelos recurrentes cuando el usuario ya conoce o ha elegido el destino.
---

# Skill: Búsqueda Definida de Alertas (`DEFINED_SEARCH`)

## Cuándo activar esta Skill
Activa esta skill cuando el usuario:
- Mencione una ruta concreta (origen y/o destino, ej. "Madrid a Londres", "de MAD a PAR").
- Elija uno de los destinos sugeridos previamente por el recomendador (ej. "Me quedo con Palma de Mallorca").
- Esté respondiendo a preguntas de clarificación sobre días de la semana, fechas, pasajeros o presupuesto.

## Entidades requeridas a extraer (`draft`)
Debes extraer y fusionar progresivamente con el borrador de la sesión actual los siguientes campos:
1. `originIata` (string, 3 letras IATA, ej. `"MAD"`, `"BCN"`).
2. `destinationIata` (string, 3 letras IATA, ej. `"LON"`, `"PAR"`, `"PMI"`).
3. `departureDay` (int, `1` = Lunes ... `7` = Domingo).
4. `returnDay` (int, `1` = Lunes ... `7` = Domingo).
5. `adults` (int, número de pasajeros entre `1` y `9`, por defecto `1`).
6. `maxPriceEur` (number, presupuesto máximo en euros).
7. `startDate` (string `YYYY-MM-DD`, inicio del rango de monitorización).
8. `endDate` (string `YYYY-MM-DD`, fin del rango de monitorización).
   - *Regla de deducción temporal:* Si el usuario menciona un mes en lenguaje natural (ej. `"en noviembre de este año"`, `"en mayo"`, `"este mes"`, `"el mes que viene"`), deduce automáticamente el primer y último día de ese mes (`YYYY-MM-01` al `YYYY-MM-30/31`).

## Reglas de Conversación y Confirmación
- **Datos incompletos:** Si falta alguno de los campos obligatorios, pregunta de forma amable y concisa **únicamente por los datos que faltan**, conservando los que ya proporcionó en turnos anteriores.
- **Datos completos (`isComplete: true`):** Cuando todos los campos estén definidos, muestra un resumen claro de la alerta y pregunta explícitamente:
  > *"¿Deseas que lance y active esta alerta ahora mismo?"*
- **Confirmación del usuario:** Si el usuario responde afirmativamente ("Sí", "Lánzala", "Adelante"), el sistema creará la alerta en PostgreSQL y la encolará inmediatamente en BullMQ.
