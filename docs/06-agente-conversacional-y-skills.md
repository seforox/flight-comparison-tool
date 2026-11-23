# 06. Agente Conversacional Multi-Skill ("Vera") y Confirmación Automática

## 1. Visión y Propósito del Agente
En **V Flights** (Next.js), el usuario puede elegir entre dos formas de crear sus alertas de vuelo:
1. **Formulario tradicional estructurado** (`POST /alerts`).
2. **Chatbot inteligente impulsado por IA ("Vera")** (`POST /agent/chat` o `POST /agent/parse-alert`), capaz de mantener una conversación multi-turno con memoria de estado mediante un `sessionId`.

## 2. Arquitectura Basada en `SKILL.md`
En lugar de acoplar las instrucciones del LLM en cadenas de texto estáticas dentro del código, se diseñó un sistema modular de especializaciones (**Skills**) alojado en `apps/api/src/application/skills/`:

### 1. `defined-search/SKILL.md` (`DEFINED_SEARCH` - Búsqueda Definida)
- **Propósito:** Se activa cuando el usuario ya tiene claro el destino (o acaba de elegir uno de los 5 destinos propuestos por el recomendador).
- **Entidades extraídas y fusionadas en el borrador (`draft`):**
  1. `originIata` y `destinationIata` (códigos IATA de 3 letras, resolviendo nombres de ciudades y el catálogo de PostgreSQL).
  2. `departureDay` y `returnDay` (1 = Lunes ... 7 = Domingo; deduce también expresiones como *"finde"*, *"3 días"* ➔ Viernes a Domingo, o *"4 días"* ➔ Jueves a Domingo). En las respuestas textuales al usuario (`reply`) siempre muestra los nombres en español (`Lunes`..`Domingo`) y nunca los números.
  3. `adults` (entero obligatorio de 1 a 9; si el usuario no lo ha indicado todavía, Vera pregunta cuántos pasajeros viajan sin asumir 1 por defecto).
  4. `directOnly` (booleano obligatorio: `true` para solo vuelos directos / sin escalas, `false` para con escalas permitidas). Si el usuario no lo ha indicado, Vera le pregunta explícitamente si prefiere **vuelo directo o con escalas**.
  5. `maxPriceEur` (opcional, `number | null`) y `budgetType` (`"PER_PERSON"` | `"TOTAL"`):
     - Si el usuario no indica presupuesto máximo, Vera puede completar la alerta sin tope de precio (`maxPriceEur: null`, mostrado como *"Más barato posible"*).
     - **Clarificación automática para múltiples pasajeros (`adults > 1`):** Si viajan 2 o más pasajeros y el usuario sí indica un presupuesto sin especificar si es por persona o total, Vera pregunta explícitamente si ese importe es **máximo por persona o máximo total** antes de continuar. Si es `"PER_PERSON"`, calcula automáticamente el presupuesto total multiplicando `rawMaxPriceEur * adults`.
  6. `startDate` y `endDate` (`YYYY-MM-DD`, con deducción automática de meses en lenguaje natural como *"en noviembre"*, *"este mes"*, *"el mes que viene"*).

### 2. `destination-recommender/SKILL.md` (`DESTINATION_RECOMMENDER` - Recomendador Inspiracional)
- **Propósito:** Se activa cuando el usuario pide inspiración temática, por país o económica (ej. *"Recomiéndame sitios baratos con playa"*, *"Destinos de montaña"*, *"Sitios en Italia para 3 días en enero"*).
- **Reglas obligatorias del recomendador:**
  1. **Solicitar primero el origen (`originIata`):** Si el usuario aún no ha indicado desde qué ciudad o aeropuerto sale, Vera conserva cualquier otro dato mencionado (fechas, duración, pasajeros, presupuesto) y pregunta **primero desde qué ciudad o aeropuerto va a salir** (y aclara si el presupuesto es por persona o total cuando `adults > 1`).
  2. **Comprobación de vuelos directos (`verifyDirectFlightsForRecommendations`):** Una vez conocido `originIata`, antes de mostrar las 5 propuestas, el servicio consulta `IgnavAdapter` y el mapa de rutas para etiquetar cada destino con `hasDirectFlights: true | false` (*"✈️ Vuelo directo"* o *"🔄 Con escalas"*).
  3. **5 Recomendaciones Interactivas:** Devuelve un array estructurado de 5 destinos (`city`, `iataCode`, `country`, `estimatedPriceEur`, `hasDirectFlights`, `reason`) sin duplicar la lista numerada en el texto plano, permitiendo al usuario elegir uno con un clic en el frontend y transicionar automáticamente a `DEFINED_SEARCH`.

Al arrancar, `AlertParserAgentService` lee dinámicamente ambos archivos `SKILL.md` desde disco (`loadSkillFile`) y los inyecta en el prompt del sistema.

## 3. Flujo de Confirmación y Encolado Automático
1. Cuando el borrador de la sesión tiene todos los campos obligatorios completos (`isComplete: true`), Vera **no lanza la alerta sin permiso**: activa `awaitingConfirmation: true`, muestra un resumen detallado (ruta, días en español, tipo de vuelo directo/escalas, pasajeros, presupuesto total y por persona, y rango de fechas) y pregunta:
   > *"¿Deseas que lance y active esta alerta ahora mismo?"*
2. Si el usuario responde afirmativamente (`"Sí"`, `"Sí, lánzala"`, `"Adelante"`, o pulsa el botón **✓ Sí, activar alerta** en el chat):
   - Crea el registro en PostgreSQL (`this.prisma.alert.create(...)`) incluyendo `directOnly`.
   - Dispara inmediatamente la búsqueda en segundo plano (`this.alertScheduler.enqueueAlert(created.id)`).
   - Limpia la sesión y devuelve `alertCreated: true` junto con el `createdAlertId`.
3. Si el usuario responde negativamente o pide cambiar las escalas desde el botón rápido del resumen, mantiene el borrador abierto y actualiza el parámetro solicitado.

## 4. Conmutador Mock vs. Gemini Real (`USE_AGENT_MOCK`) y Firebase Genkit UI
- **`USE_AGENT_MOCK="true"`:** Utiliza el motor local determinista de Skills (`processWithSkillsEngine`), ideal para pruebas unitarias y desarrollo local sin coste de tokens.
- **`USE_AGENT_MOCK="false"`:** Invoca la API oficial de **Google Gemini** usando `GOOGLE_GENAI_API_KEY` con fallback automático entre modelos (`process.env.GEMINI_MODEL`, `gemini-3-flash-preview`, `gemini-3.5-flash`, `gemini-3.1-flash-lite`) y *Structured JSON Outputs*.
- **Flujos Genkit (`apps/api/src/genkit.flows.ts`):** Exporta `flightAgentChatFlow` y `destinationRecommenderSkill` para poder inspeccionar trazas y probar el agente desde la **Firebase Genkit Developer UI**.
