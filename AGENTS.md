# AGENTS.md - Reglas de Desarrollo y Operación para Agentes de IA

Este repositorio sigue directrices estrictas de arquitectura, calidad de código y metodología de pruebas. Cualquier agente autónomo o asistente de código debe cumplir estas normas sin excepción.

---

## 1. Reglas Generales de Comportamiento
1. **Consulta de SPEC.md:** Todo código debe ajustarse a las definiciones de `SPEC.md`. Prohibido inventar campos o módulos no contemplados.
2. **TypeScript Estricto:** Prohibido el uso de `any`. Usa genéricos, tipos específicos o `unknown` con type narrowing. Mantén `"strict": true`.
3. **No romper compilación:** Cada iteración debe mantener el código libre de errores de sintaxis y tipos.
4. **Dependencias:** No instales paquetes sin necesidad directa del stack especificado.

---

## 2. Metodología Obligatoria: Test-Driven Development (TDD) Estricto
La lógica de negocio (cálculo de fechas, validación de alertas, mapeo de respuestas de APIs externas y adaptadores) debe desarrollarse siguiendo el ciclo **Red-Green-Refactor**.

### Ciclo de Ejecución:
1. **Fase 1: RED (Test que falle primero):**
   - Escribe la suite de pruebas unitarias en Jest (`*.spec.ts`) antes de crear la implementación.
   - El test debe fallar porque el método no existe o retorna una excepción de no implementación.
2. **Fase 2: GREEN (Código mínimo indispensable):**
   - Escribe únicamente el código necesario en el servicio para que los tests pasen exitosamente.
3. **Fase 3: REFACTOR & EDGE CASES:**
   - Limpia duplicidades y optimiza el código.
   - Incorpora pruebas para casos límite obligatorios:
     * Años bisiestos y rangos temporales que cruzan el cambio de año.
     * Rangos donde la fecha de vuelta sea anterior o igual a la de ida.
     * Respuestas vacías o con tarifas nulas desde la API externa.
     * Fallos por límite de cuota (HTTP 429) y caídas de red.

---

## 3. Patrones de Arquitectura en NestJS (Puertos y Adaptadores)
* Separa los módulos en capas claras:
  - `domain/`: Interfaces de proveedores (puertos) y entidades puras.
  - `infrastructure/`: Implementaciones concretas (adaptadores de Ignav, Telegram, Prisma).
  - `application/`: Servicios que orquestan los casos de uso.
* Valida todas las peticiones con DTOs utilizando `class-validator` y `class-transformer`.
* Maneja siempre las variables de entorno a través de `ConfigService`.

---

## 4. Formato de Respuesta del Agente
Cuando se te asigne una tarea de implementación de lógica:
1. **Especificación del Test (RED):** Muestra el código de la prueba unitaria fallando.
2. **Implementación Mínima (GREEN):** Muestra el código del servicio que resuelve el test.
3. **Casos Límite y Refactor:** Añade los tests de casos extremos y el refactor final.
4. **Comando de Verificación:** Proporciona el comando exacto para ejecutar los tests correspondientes.