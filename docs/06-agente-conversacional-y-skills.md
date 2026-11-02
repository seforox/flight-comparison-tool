# 06. Agente Conversacional Multi-Skill y Confirmación Automática

## 1. Visión y Propósito del Agente
En el frontend (Next.js), el usuario podrá elegir entre dos formas de crear sus alertas de vuelo:
1. **Formulario tradicional estructurado** (`POST /alerts`).
2. **Chatbot inteligente impulsado por IA** (`POST /agent/chat` o `POST /agent/parse-alert`), capaz de mantener una conversación multi-turno mediante un `sessionId`.

## 2. Arquitectura Basada en `SKILL.md`
En lugar de acoplar las instrucciones del LLM en cadenas de texto estáticas dentro del código, se diseñó un sistema modular de especializaciones (**Skills**) alojado en `apps/api/src/application/skills/`:

1. **`defined-search/SKILL.md` (`DEFINED_SEARCH` - Búsqueda Definida):**
   - **Propósito:** Se activa cuando el usuario ya tiene claro el destino (o acaba de elegir uno de las recomendaciones).
   - **Comportamiento:** Va extrayendo y fusionando progresivamente en el borrador de la sesión (`draft`) los 8 datos requeridos: `originIata`, `destinationIata`, `departureDay`, `returnDay`, `adults`, `maxPriceEur`, `startDate` y `endDate`. Si falta algún campo, pregunta **únicamente** por los datos restantes conservando los ya indicados en turnos anteriores.

2. **`destination-recommender/SKILL.md` (`DESTINATION_RECOMMENDER` - Recomendador Inspiracional):**
   - **Propósito:** Se activa cuando el usuario pide inspiración temática o económica (ej. *"Sitios baratos con playa"*, *"Destinos de montaña en Europa"*, *"¿Dónde puedo escaparme barato?"*).
   - **Comportamiento:** Devuelve un array estructurado de **5 recomendaciones** (`city`, `iataCode`, `country`, `estimatedPriceEur`, `reason`) y pregunta al usuario cuál de los 5 destinos prefiere y en qué fechas/presupuesto desea viajar, transfiriendo el contexto automáticamente a la skill `DEFINED_SEARCH` en el siguiente turno.

Al arrancar, `AlertParserAgentService` lee dinámicamente ambos archivos `SKILL.md` desde disco (`loadSkillFile`) y los inyecta en el prompt del sistema.

## 3. Flujo de Confirmación y Encolado Automático
1. Cuando el borrador de la sesión tiene los 8 campos completos (`isComplete: true`), el agente **no lanza la alerta sin permiso**: activa `awaitingConfirmation: true`, muestra un resumen de los parámetros y pregunta:
   > *"¿Deseas que lance y active esta alerta ahora mismo?"*
2. Si en el siguiente mensaje de la sesión el usuario responde afirmativamente (`"Sí"`, `"Sí, lánzala"`, `"Adelante"`, `"Vale"`), el propio `AlertParserAgentService`:
   - Crea el registro en PostgreSQL (`this.prisma.alert.create(...)`).
   - Dispara inmediatamente la búsqueda en segundo plano (`this.alertScheduler.enqueueAlert(created.id)`).
   - Limpia la sesión y devuelve `alertCreated: true` junto con el `createdAlertId`.
3. Si el usuario responde negativamente (`"No"`, `"Cambiar"`), mantiene el borrador abierto para que el usuario modifique cualquier campo.

## 4. Conmutador Mock vs. Gemini Real (`USE_AGENT_MOCK`)
Al igual que con la API de vuelos, se añadió la variable `USE_AGENT_MOCK` en `.env`:
- **`USE_AGENT_MOCK="true"`:** Utiliza el motor local determinista de Skills (`processWithSkillsEngine`), ideal para pruebas unitarias y desarrollo local sin coste de tokens.
- **`USE_AGENT_MOCK="false"`:** Invoca la API oficial de **Google Gemini (`gemini-2.5-flash`)** usando `GOOGLE_GENAI_API_KEY` y los archivos `SKILL.md` cargados dinámicamente con *Structured JSON Outputs*.
