---
name: destination-recommender
description: Especialización inspiracional que recomienda 5 destinos económicos según preferencias temáticas (playa, montaña, escapada barata, cultural) y guía al usuario para configurar su alerta.
---

# Skill: Recomendador Inspiracional de Destinos (`DESTINATION_RECOMMENDER`)

## Cuándo activar esta Skill
Activa esta skill cuando el usuario:
- No tenga un destino concreto (aeropuerto/ciudad) decidido y pida ideas o inspiración por temática o país (ej. *"Recomiéndame sitios baratos con playa"*, *"Recomiéndame sitios de Italia para un viaje de 3 días en enero"*, *"¿Dónde puedo ir a la montaña por poco dinero?"*, *"Dime 5 destinos económicos en Europa"*).

## Reglas de Respuesta y Extracción Simultánea (`draft`)
1. **Conserva en `draft` los datos que el usuario ya haya mencionado en la misma frase:**
   - Si menciona un mes (ej. *"en enero"*), rellena `startDate` (`"YYYY-01-01"`) y `endDate` (`"YYYY-01-31"`).
   - Si menciona duración sin días explícitos: *"3 días"* o *"finde"* -> `departureDay: 5` (Viernes) y `returnDay: 7` (Domingo); *"4 días"* -> `departureDay: 4` (Jueves) y `returnDay: 7` (Domingo).
   - Si menciona ciudad de origen, presupuesto o si quiere vuelo directo (`directOnly: true`) o con escalas (`directOnly: false`), guárdalos también en `draft`.
2. **Exactamente 5 recomendaciones:** Devuelve siempre una lista estructurada de **5 destinos** en el campo `recommendations` adaptados al país, época del año o temática pedida:
   - `city`: Nombre de la ciudad o región (ej. `"Roma"`, `"Milán - Bérgamo"`, `"Venecia"`).
   - `iataCode`: Código IATA de 3 letras del aeropuerto principal (ej. `"ROM"`, `"BGY"`, `"VCE"`).
   - `country`: País del destino.
   - `estimatedPriceEur`: Precio orientativo de ida y vuelta en EUR.
   - `reason`: Breve explicación de por qué encaja con lo que busca el usuario (mencionando por qué es ideal para esa duración o mes).
3. **Pregunta de seguimiento (Transición a `DEFINED_SEARCH`):**
   - Al final del mensaje (`reply`), pregunta al usuario **cuál de los 5 destinos le gustaría elegir** y pídele **únicamente los datos que aún falten en `draft`** (por ejemplo, desde qué ciudad sale, su presupuesto máximo y si prefiere **vuelo directo o con escalas**).
