# Plan del integrante 3

## Descuentos y promociones

Versión 2.1. Estado: en revisión. Responsable: Integrante 3. Revisor principal: Integrante 2. Revisor adicional: Integrante 4 (Ventas y Cotización).

Porcentaje y NxM por un mismo platillo, duración temporal o permanente y cálculo único en servidor.

Leer [spec](../../spec.md), [reglas generales](../../AGENTS.md), [reglas locales](AGENTS.md), [arquitectura](../../docs/arquitectura-tecnica.md) y [matriz](../../docs/matriz-aceptacion.md). Usar [frontend](frontend/README.md) y [backend](backend/README.md). P0 y P1 son obligatorios; ejecutar por dependencias.

| ID | Prioridad | Tarea | Dependencias | Estado |
| --- | --- | --- | --- | --- |
| W3-01 | P0 | Definir el contrato económico | Sin prerrequisito; coordinar contratos | En revisión |
| W3-02 | P0 | Implementar administración de promociones | W1-02, W1-03, W2-02, W3-01 | En revisión |
| W3-03 | P0 | Implementar cálculo exacto | W1-02, W3-01 | En revisión |
| W3-04 | P1 | Crear formulario web de promociones | W3-02, W1-04 | En revisión |
| W3-05 | P0 | Integrar promociones con la venta | W3-02, W3-03, W4-01 | En revisión |
| W3-06 | P1 | Verificar promociones integradas | W3-04, W3-05, W4-03 | En revisión |

## W3-01 Definir el contrato económico

Prioridad: P0. Estado: en revisión.

Dependencias: ninguna; coordinar los contratos iniciales en paralelo.

Resultado: Entradas y resultados de descuentos acordados con ventas.

- [x] Definir porcentaje y NxM aplicables a un solo platillo por promoción, sin mezclar productos.
- [x] Documentar elegibilidad, salida por partida, ahorro, total y copia histórica.
- [x] Coordinar tipos con W1-01, catálogo con W2-01 y consumo del resultado con W4-01.
- [x] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [x] Completar `docs/auditorias/W3-01.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W3-02 Implementar administración de promociones

Prioridad: P0. Estado: en revisión.

Dependencias: W1-02, W1-03, W2-02, W3-01.

Resultado: API crea, edita, activa, desactiva y retira promociones.

- [x] Crear migración y API con un platillo participante, tipo y parámetros válidos.
- [x] Implementar temporal con inicio y fin y permanente sin vencimiento, usando hora de servidor.
- [x] Restringir escritura al administrador y conservar las promociones referenciadas por ventas.
- [x] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [x] Completar `docs/auditorias/W3-02.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W3-03 Implementar cálculo exacto

Prioridad: P0. Estado: en revisión.

Dependencias: W1-02, W3-01.

Resultado: Porcentaje y NxM producen importes conocidos y reproducibles.

- [x] Calcular con decimal.js desde cadenas, redondeo a dos decimales y total no negativo.
- [x] Implementar grupos completos y sobrantes NxM; nunca cambiar unidades entregadas.
- [x] Seleccionar una sola promoción por orden con mayor ahorro y desempatar por identificador; probar ejemplos independientes.
- [x] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [x] Completar `docs/auditorias/W3-03.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W3-04 Crear formulario web de promociones

Prioridad: P1. Estado: en revisión.

Dependencias: W3-02, W1-04.

Resultado: Administrador configura duración, porcentaje o N y M desde móvil.

- [x] Crear lista y formulario con selector de platillo y Temporal/Permanente.
- [x] Mostrar fecha y zona horaria, estado efectivo y errores; ocultar campos que no aplican al tipo.
- [x] Comprobar guardar, suspender y retirar con API real y diseño común.
- [x] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [x] Completar `docs/auditorias/W3-04.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W3-05 Integrar promociones con la venta

Prioridad: P0. Estado: en revisión.

Dependencias: W3-02, W3-03, W4-01.

Resultado: Cotización y confirmación usan las mismas reglas del servidor.

- [x] Entregar evaluación bajo datos consistentes y copia de reglas aplicadas.
- [x] Detectar cambios de vigencia, precio o promoción entre cotización y confirmación.
- [x] Integrar con ventas y comprobar que una promoción retirada no cambia su historial.
- [x] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [x] Completar `docs/auditorias/W3-05.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W3-06 Verificar promociones integradas

Prioridad: P1. Estado: en revisión.

Dependencias: W3-04, W3-05, W4-03.

Resultado: Porcentaje y NxM funcionan en una venta real sin alterar el consumo.

- [x] Comprobar ejemplos 15 %, 2x1 y 3x1, fin exacto y promoción permanente desactivada.
- [x] Verificar una promoción por orden, descuento por partida, total cero e historial.
- [x] Contrastar unidades entregadas con consumo de inventario y entregar evidencia reproducible.
- [x] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [x] Completar `docs/auditorias/W3-06.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.
