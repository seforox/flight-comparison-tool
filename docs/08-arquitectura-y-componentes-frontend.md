# 08. Arquitectura y Componentes del Frontend (V Flights)

## 1. Visión General y Stack del Frontal (`apps/web`)
El frontend del proyecto se desarrolló bajo la identidad de marca **V Flights** ("*Vuela cuando sea más barato, no solo cuando toca*") en el paquete `apps/web` del monorepo, corriendo en el puerto `3000` y consumiendo la API REST de NestJS en el puerto `3001`.

- **Framework:** Next.js `16.4.6` con **App Router**, Turbopack y `Proxy` (`src/proxy.ts`).
- **Librería UI:** React `19.3.0`.
- **Estilos:** Tailwind CSS `v4` (`@tailwindcss/turbopack`), paleta corporativa azul marino profundo (`#071932`, `#0b2545`, `#0e2a47`) con acentos cian (`#00b4d8`, `#18c1f0`) y superficies claras (`#f4f7fb`).
- **Tipado:** TypeScript 5 de extremo a extremo compartido conceptualmente con los DTOs del backend.

---

## 2. Estructura de Archivos de `apps/web`

```text
apps/web/
├── public/
│   └── logo.jpg                       # Logotipo oficial de V Flights
├── .env.example                       # Plantilla de variables de entorno (proxy BFF y acceso privado)
└── src/
    ├── proxy.ts                       # Next.js Proxy: puerta de acceso privado (?key=...) y cabecera X-Robots-Tag
    ├── app/
    │   ├── api/proxy/[...path]/
    │   │   └── route.ts               # Proxy BFF en servidor para reenviar llamadas a la API ocultando Railway
    │   ├── layout.tsx                 # Layout global (lang="es", skip-link accesible al contenido principal)
    │   ├── page.tsx                   # Controlador de vista principal (LandingView vs DashboardPage)
    │   ├── robots.ts                  # Generación dinámica de robots.txt según BLOCK_SEARCH_ENGINES
    │   ├── login/
    │   │   └── page.tsx               # Página unificada de Inicio de Sesión y Registro (con visor de contraseña)
    │   └── globals.css                # Importación y configuración de Tailwind CSS v4
    ├── components/
    │   ├── LandingView.tsx            # Página de aterrizaje pública para usuarios sin sesión
    │   ├── CreateAlertForm.tsx        # Formulario principal de búsqueda por patrones semanales y precio opcional
    │   ├── AirportSelector.tsx        # Selector desplegable y buscador asíncrono de +8.000 aeropuertos IATA
    │   ├── AlertCard.tsx              # Tarjeta de detalle de alerta, edición inline, tuplas y gráfica de barras
    │   └── AgentChatbot.tsx           # Widget flotante y ampliable del Agente IA "Vera"
    └── lib/
        └── api.ts                     # Cliente HTTP fetch (directo o vía /api/proxy), almacenamiento JWT y caché de aeropuertos
```

---

## 3. Capa de Comunicación y Caché en Memoria (`src/lib/api.ts`)
El módulo `api.ts` centraliza toda la comunicación con el backend, soportando dos modos de conexión configurables:
- **Modo Proxy BFF (producción recomendada):** Si `NEXT_PUBLIC_USE_API_PROXY="true"`, el navegador llama a `/api/proxy/...` y el servidor de Next.js reenvía la petición a `API_INTERNAL_URL` inyectando la cabecera `x-api-gateway-secret`.
- **Modo Directo (desarrollo local):** Llama directamente a `NEXT_PUBLIC_API_URL` (por defecto `http://localhost:3001`).

1. **Gestión del Token JWT:**
   - Almacena y lee el token en `localStorage` bajo la clave `flight_jwt_token` (`getToken`, `setToken`, `clearToken`).
   - Inyecta automáticamente la cabecera `Authorization: Bearer <token>` en todas las peticiones autenticadas.
   - Normaliza los mensajes de error devueltos por el `ValidationPipe` de NestJS para mostrarlos de forma legible en los formularios.
2. **Caché Híbrida de Aeropuertos (`AIRPORTS_MEMORY_CACHE`):**
   - Parte de un catálogo inicial en memoria (`AIRPORTS_CATALOG`, con los 80 aeropuertos y códigos metropolitanos más frecuentes de España, Europa y el mundo) para que la interfaz responda en `0 ms` al abrir la aplicación.
   - A medida que el usuario busca en PostgreSQL (`api.airports.search`) o resuelve códigos IATA específicos (`api.airports.getByIata`) o recibe recomendaciones del Agente IA, `cacheAirports()` añade dinámicamente esos aeropuertos a `AIRPORTS_MEMORY_CACHE` para evitar peticiones repetidas y traducir instantáneamente códigos IATA a nombres de ciudad (`MAD` ➔ `Madrid`, `ROM` ➔ `Roma`).
3. **Namespaces del Cliente API:**
   - `api.auth`: `register`, `login`, `logout`, `getProfile` (`GET /auth/me`), `updateTelegram` (`PATCH /auth/telegram`).
   - `api.alerts`: `list`, `create`, `update` (`PATCH /alerts/:id`), `updateStatus` (`PATCH /alerts/:id/status`), `remove` (`DELETE /alerts/:id`), `triggerCheck` (`POST /alerts/:id/check`).
   - `api.agent`: `chat` (`POST /agent/chat`).
   - `api.airports`: `search` (`GET /airports?q=&limit=`), `getByIata` (`GET /airports/:iata`).

---

## 4. Desglose Técnico de Vistas y Componentes

### 4.1. `LandingView.tsx` (Landing Page Pública)
Cuando `DashboardPage` detecta que el usuario no tiene sesión activa (`!user`), renderiza `LandingView` en lugar de redirigir forzosamente, permitiendo conocer el producto antes de registrarse:
- **Barra de navegación superior:** Logotipo de **V Flights**, enlaces de ancla internos (*Escapadas semanales*, *Cómo funciona*, *Vera · Agente IA*) y botón destacado **Iniciar sesión** en la esquina superior derecha.
- **Hero con demostración interactiva:** Explica el concepto de patrones semanales (ej. *Todos los Viernes ➔ Domingo en Noviembre*) e incluye una tarjeta visual de demostración (`Madrid → Roma`) comparando 4 fines de semana con etiquetas de *"¡Chollo!"*, *"Dentro de tu objetivo"* y *"Supera objetivo"*.
- **Secciones informativas:** Bloques de valor (*Patrones por días de la semana*, *Vera · Agente IA con 2 Skills*, *Alertas en tiempo real por Telegram*) y guía paso a paso en 3 etapas.

### 4.2. `app/login/page.tsx` (Autenticación Unificada)
- Permite alternar sin recargar entre las pestañas **Iniciar Sesión** (`POST /auth/login`) y **Crear Cuenta** (`POST /auth/register`) mediante un `tablist` accesible.
- Incluye botón interactivo para **mostrar u ocultar la contraseña**, enlace de retorno a la página de inicio de V Flights, validación de longitud mínima de contraseña (6 caracteres) y redirección automática al panel principal tras almacenar el JWT.

### 4.3. `app/page.tsx` (`DashboardPage` - Panel Principal)
Orquesta el estado global del usuario autenticado:
- **Sincronización en tiempo real (Polling cada 15s):** Refresca silenciosamente `api.alerts.list()` cada 15 segundos para reflejar en pantalla cuando el Worker de BullMQ encuentra vuelos y pasa una alerta de `ACTIVE` a `TRIGGERED`, o cuando el Cron activa `pendingCompletionPrompt`.
- **Dos pestañas principales de trabajo (`navTab`):**
  1. **`comparador` (*Comparador de vuelos*):** Muestra el Hero con contadores en vivo (*buscando* y *vuelos encontrados*), el formulario `CreateAlertForm` y, justo debajo, la sección **Última búsqueda** con el detalle completo (`AlertCard`) de la última alerta creada.
  2. **`alertas` (*Mis alertas*):** Muestra todas las alertas del usuario con doble barra de filtros combinables:
     - **Filtro por estado (`statusFilter`):** *Todas*, *Vuelo encontrado (`TRIGGERED`)*, *Buscando (`ACTIVE`)*, *En pausa (`PAUSED`)* y *Completadas (`COMPLETED`)*.
     - **Filtro por escalas (`directFilter`):** *Todos*, *✈️ Solo directo* y *🔄 Con escalas*.
- **Modal de vinculación de Telegram:** Permite configurar o actualizar el `telegramChatId` con instrucciones paso a paso sin salir del panel.

### 4.4. `AirportSelector.tsx` (Buscador de +8.000 Aeropuertos IATA)
- Componente reutilizable empleado tanto en el buscador principal (`CreateAlertForm`) como en el formulario de edición inline de `AlertCard`.
- Implementa *debounce* de `160 ms` para consultar `GET /airports?q=...&limit=60` contra PostgreSQL a medida que el usuario escribe ciudad, país, nombre de aeropuerto o código IATA.
- Muestra el contador real de aeropuertos en base de datos (`8.021 aeropuertos IATA`), permite usar códigos IATA personalizados de 3 letras si el usuario escribe uno directamente y cuenta con fallback automático al catálogo en memoria si no hay conexión.

### 4.5. `CreateAlertForm.tsx` (Buscador por Patrones Semanales)
- Todos los campos inician vacíos con *placeholders* orientativos para obligar a una selección consciente y evitar envíos accidentales con valores por defecto.
- Incluye botón `⇄` para intercambiar origen y destino en un clic, y validaciones preventivas que impiden seleccionar el mismo aeropuerto de origen y destino o búsquedas de ida y vuelta en el mismo día.
- Incorpora selector obligatorio de **Escalas** (*✈️ Solo directo* vs. *🔄 Con escalas*), campo de **Presupuesto máximo opcional** (si se deja vacío, busca el vuelo más barato posible sin tope) y **píldoras de rango rápido** calculadas dinámicamente según la fecha actual (*Resto del mes actual*, *Mes actual completo* y *Próximo mes completo*).

### 4.6. `AlertCard.tsx` (Detalle, Edición Inline y Gráfica Comparativa)
Renderiza la radiografía completa de una alerta:
- **Cabecera y métricas:** Estado actual (incluyendo indicador de carga `Buscando chollos...` mientras dura la búsqueda inicial), patrón semanal (`Viernes ➔ Domingo`), indicador de escalas (`Solo directo` / `Con escalas`), número de pasajeros, **Mejor Precio** encontrado y **Objetivo Máx. (€)** (o *Sin límite / Más barato posible* si no se fijó tope).
- **Barra de acciones del ciclo de vida:**
  - *🔄 Actualizar tarifas* (`POST /alerts/:id/check`).
  - *🧭 Seguir buscando* (`ACTIVE`), *⏸ Pausar* (`PAUSED`) y *📥 Completar* (`COMPLETED`).
  - *✏️ Modificar*: Despliega un formulario inline precargado que permite editar origen, destino, días de salida/regreso, fechas, pasajeros, escalas y presupuesto, relanzando la búsqueda al guardar (`PATCH /alerts/:id`).
  - *📅 Desplegar / Ocultar fechas*: En la pestaña *Mis alertas* (`collapsibleDates`), las combinaciones de fechas y la gráfica permanecen plegadas por defecto y se despliegan al hacer clic en la tarjeta o en el botón correspondiente.
  - Si la alerta está en estado `COMPLETED`, se renderiza con un tema visual dorado/ámbar de alerta archivada y bloquea las acciones de edición o reactivación.
- **Grid de tuplas y Gráfica de barras comparativa:** Genera todas las combinaciones `(departureDate, returnDate)` del rango y dibuja una gráfica interactiva de barras proporcionales comparando el precio encontrado en cada fecha frente al umbral objetivo, con botón directo a **Reservar vuelo ↗** en Google Flights.

### 4.7. `AgentChatbot.tsx` (Widget Flotante Multi-Skill de "Vera")
- Se muestra minimizado por defecto en la esquina inferior derecha con indicador de estado en línea.
- Al abrirse, permite alternar entre **modo compacto** (`410x590 px`) y **modo ventana ampliada** (`760x760 px`), además de reiniciar la conversación en cualquier momento.
- Renderiza elementos interactivos enriquecidos según el contexto devuelto por el backend:
  - **Píldoras de sugerencias iniciales** (visibles solo al inicio de la conversación y ocultas automáticamente en cuanto el usuario empieza a escribir).
  - **Tarjetas clicables para los 5 destinos recomendados** en `DESTINATION_RECOMMENDER` con insignia de precio estimado (`desde X €`) y etiqueta de conexión verificada (`✈️ Vuelo directo` o `🔄 Con escalas`).
  - **Botones de elección rápida de presupuesto** (`👤 Máximo por persona` vs. `👥 Máximo total`) cuando `adults > 1`.
  - **Botones de elección rápida de escalas** (`✈️ Solo directo` vs. `🔄 Con escalas`).
  - **Panel de confirmación final** con botones para activar la alerta (`✓ Sí, activar alerta`), modificar datos o conmutar entre directo y con escalas en un clic.
  - **Cierre de ciclo conversacional:** Una vez creada la alerta (`alertCreated: true`), bloquea el envío de mensajes adicionales en esa sesión y muestra el botón destacado **✨ Nueva consulta**.
