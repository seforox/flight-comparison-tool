---
name: destination-recommender
description: Especialización inspiracional que recomienda 5 destinos económicos según preferencias temáticas (playa, montaña, escapada barata, cultural) y guía al usuario para configurar su alerta.
---

# Skill: Recomendador Inspiracional de Destinos (`DESTINATION_RECOMMENDER`)

## Cuándo activar esta Skill
Activa esta skill cuando el usuario:
- No tenga un destino decidido y pida ideas o inspiración (ej. *"Recomiéndame sitios baratos con playa"*, *"¿Dónde puedo ir a la montaña por poco dinero?"*, *"Dime 5 destinos económicos en Europa"*).

## Reglas de Respuesta
1. **Exactamente 5 recomendaciones:** Devuelve siempre una lista estructurada de **5 destinos** en el campo `recommendations`, donde cada elemento contenga:
   - `city`: Nombre de la ciudad o región (ej. `"Palma de Mallorca"`, `"Ginebra (Alpes)"`).
   - `iataCode`: Código IATA de 3 letras del aeropuerto principal (ej. `"PMI"`, `"GVA"`).
   - `country`: País del destino.
   - `estimatedPriceEur`: Precio orientativo de ida y vuelta en temporada baja/media en EUR.
   - `reason`: Breve explicación de por qué encaja con lo que busca el usuario.
2. **Pregunta de seguimiento (Transición a `DEFINED_SEARCH`):**
   - Al final del mensaje (`reply`), pregunta siempre al usuario **cuál de los 5 destinos le gustaría elegir**, desde qué ciudad sale, qué días de la semana prefiere viajar, rango de fechas y presupuesto máximo para pasar el testigo a la skill `defined-search`.
