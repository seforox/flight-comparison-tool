# 09. UX/UI, Flujos Interactivos, Responsividad y Accesibilidad del Frontal

## 1. Identidad Visual y Sistema de Diseño (V Flights)
La interfaz de **V Flights** se diseñó buscando claridad informativa para comparar múltiples fechas de un vistazo sin saturar al usuario:
- **Paleta cromática con contraste verificado:**
  - Cabeceras y Hero: Degradados en azul marino profundo (`from-[#071932] via-[#0c2b53] to-[#0d3b6e]`) con detalles decorativos de aves en origami en azul cian (`#00b4d8`).
  - Estados semánticos de las alertas (`STATUS_PILLS`):
    - **Vuelo encontrado (`TRIGGERED`):** Verde esmeralda (`bg-emerald-50 text-emerald-700 border-emerald-200`).
    - **Buscando (`ACTIVE`):** Azul vivo con punto pulsante (`bg-blue-50 text-blue-600`, `animate-pulse`).
    - **En pausa (`PAUSED`):** Ámbar suave (`bg-amber-50 text-amber-700`).
    - **Completada (`COMPLETED`):** Estilo especial dorado/ámbar en degradado (`from-amber-50 via-yellow-50 to-amber-100 border-amber-300`) con insignia `🏆 Alerta completada y archivada`.

---

## 2. Flujos Interactivos Clave implementados en el Frontal

### 2.1. Separación de Contextos: "Comparador de vuelos" vs. "Mis alertas"
Para evitar que la pantalla principal crezca indefinidamente cuando un usuario acumula decenas de alertas:
1. En la pestaña **Comparador de vuelos**, el usuario se centra exclusivamente en el buscador superior y en la tarjeta **Última búsqueda** (con sus fechas y gráfica desplegadas en tiempo real), acompañada de un enlace rápido `Ver todas en Mis alertas (N) →`.
2. En la pestaña **Mis alertas**, el usuario dispone de la barra de filtros por estado y escalas, una cuadrícula de **mini-tarjetas resumen seleccionables** y, debajo, la tarjeta de detalle de la alerta seleccionada con sus combinaciones de fechas plegadas por defecto (`collapsibleDates`) para mantener una lectura limpia.

### 2.2. Flujo de Recordatorio tras Revisión del Cron (`pendingCompletionPrompt`)
Cuando una alerta ya ha encontrado vuelos (`TRIGGERED`) y transcurre un nuevo ciclo del Cron sin que el usuario la haya marcado como `COMPLETED`:
- El backend marca `pendingCompletionPrompt = true`.
- El frontend detecta este estado y muestra un **aviso destacado en ámbar** tanto dentro de la propia tarjeta `AlertCard` como en la notificación flotante (*toast*):
  > *"Esta alerta ya tiene vuelos encontrados y sigue sin marcarse como completada. Ha vuelto a pasar el ciclo de revisión automática. ¿Quieres darla por completada o mantener la búsqueda activa?"*
- El usuario puede resolverlo con un solo clic:
  - **📥 Completar alerta:** Pasa el estado a `COMPLETED`, limpia el aviso y la archiva con estilo dorado.
  - **🧭 Mantener:** Reactiva la alerta a `ACTIVE` y limpia el aviso para seguir buscando nuevas ofertas.

### 2.3. Flujo Guiado en el Chat de "Vera" (`AgentChatbot`)
El chat de **Vera** combina lenguaje natural libre con controles asistidos para minimizar la fricción en pantallas táctiles y de escritorio:
1. **Ocultación inteligente de sugerencias:** Las píldoras de ejemplo iniciales desaparecen automáticamente en cuanto el usuario escribe el primer carácter en la caja de texto (`!input.trim()`).
2. **Desambiguación interactiva de Presupuesto y Escalas:**
   - Si el usuario pide un viaje para más de 1 persona indicando un precio, Vera muestra dos botones instantáneos: `👤 Máximo por persona` y `👥 Máximo total`.
   - Si falta indicar la preferencia de escalas, Vera muestra los botones `✈️ Solo directo` y `🔄 Con escalas`.
3. **Tarjetas de Recomendación Verificadas:**
   - Cuando Vera recomienda 5 destinos (`DESTINATION_RECOMMENDER`), no repite el listado en el texto del mensaje: presenta 5 tarjetas interactivas con ciudad, código IATA, país, motivo de recomendación, precio estimado y una etiqueta que indica si existen **vuelos directos (`✈️ Vuelo directo`)** o si requiere **escalas (`🔄 Con escalas`)** desde el aeropuerto de origen del usuario.
4. **Ampliación de ventana (`isExpanded`):**
   - El usuario puede expandir el widget flotante hasta `760x760 px` en escritorio (`85vh` en móvil), reorganizando automáticamente las tarjetas de destinos recomendados y sugerencias en una cuadrícula de 2 columnas (`sm:grid-cols-2`).

---

## 3. Adaptabilidad y Responsividad Móvil (`< 640px` y `< 768px`)
Se cuidaron específicamente los puntos de ruptura para dispositivos móviles:
- **Barra de navegación móvil dedicada:** En pantallas menores de `768px` (`md:hidden`), las pestañas *Comparador* y *Mis alertas (N)* se sitúan en una segunda fila de ancho completo dentro del `header` para evitar solapamientos con los botones de *Telegram* y *Salir*.
- **Paginación por Scroll en "Mis alertas" (Móvil):** En pantallas móviles (`< 640px`), la lista de mini-tarjetas muestra inicialmente un máximo de **3 alertas visibles** dentro de un contenedor con `overflow-y-auto` y `snap-y`, cargando progresivamente de 3 en 3 a medida que el usuario desliza hacia abajo (`onScroll`).
- **Prevención de solapamiento de elementos flotantes:** En móvil, el botón flotante de Vera ocupa el ancho inferior (`bottom-4 left-4 right-4`), y el *toast* de aviso de vuelo encontrado se eleva automáticamente a `bottom-24` para no tapar nunca el acceso al chat.

---

## 4. Accesibilidad Web (WCAG / WAI-ARIA)
Todos los componentes del frontal siguen buenas prácticas de accesibilidad semántica y navegación por teclado:
1. **Enlace de salto (*Skip Link*):** En `layout.tsx` se incluye un enlace `Saltar al contenido principal` (`href="#main-content"`) visible al recibir foco por teclado (`sr-only focus:not-sr-only`).
2. **Semántica de Diálogos y Listas Desplegables:**
   - El modal de Telegram y el panel desplegado de Vera utilizan `role="dialog"` con etiquetas descriptivas (`aria-label` / `aria-labelledby`).
   - El buscador de aeropuertos `AirportSelector` implementa el patrón `aria-haspopup="listbox"`, `aria-expanded`, `role="listbox"` y `role="option"` con `aria-selected`, vinculando etiquetas e IDs únicos generados con `useId()`.
3. **Regiones Vivas (`aria-live`):**
   - El historial de mensajes de Vera utiliza `role="log"` y `aria-live="polite"` para anunciar nuevas respuestas del agente a lectores de pantalla.
   - Los mensajes de error de los formularios emplean `role="alert"` y `aria-live="assertive"`, mientras que los estados de carga y confirmaciones usan `role="status"` y `aria-live="polite"`.
4. **Soporte de Teclado y Jerarquía HTML Válida:**
   - Todos los modales, selectores desplegables (`AirportSelector`) y la ventana del chat de Vera pueden cerrarse pulsando la tecla `Escape`.
   - En la cabecera de `AgentChatbot` y en las tarjetas de `AlertCard` se evitó estrictamente el anidamiento de elementos `<button>` dentro de otros `<button>`, garantizando un árbol DOM y de accesibilidad 100% válido.
