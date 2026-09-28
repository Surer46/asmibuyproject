# Plan del integrante 3

## Descuentos y promociones

Versión 2.1. Estado: pendiente. Responsable personal: por asignar. Revisor principal: integrante 2.

Porcentaje y NxM por un mismo platillo, duración temporal o permanente y cálculo único en servidor.

Leer [spec](../../spec.md), [reglas generales](../../AGENTS.md), [reglas locales](AGENTS.md), [arquitectura](../../docs/arquitectura-tecnica.md) y [matriz](../../docs/matriz-aceptacion.md). Usar [frontend](frontend/README.md) y [backend](backend/README.md). P0 y P1 son obligatorios; ejecutar por dependencias.

| ID | Prioridad | Tarea | Dependencias |
| --- | --- | --- | --- |
| W3-01 | P0 | Definir el contrato económico | Sin prerrequisito; coordinar contratos |
| W3-02 | P0 | Implementar administración de promociones | W1-02, W1-03, W2-02, W3-01 |
| W3-03 | P0 | Implementar cálculo exacto | W1-02, W3-01 |
| W3-04 | P1 | Crear formulario web de promociones | W3-02, W1-04 |
| W3-05 | P0 | Integrar promociones con la venta | W3-02, W3-03, W4-01 |
| W3-06 | P1 | Verificar promociones integradas | W3-04, W3-05, W4-03 |

## W3-01 Definir el contrato económico

Prioridad: P0. Estado: pendiente.

Dependencias: ninguna; coordinar los contratos iniciales en paralelo.

Resultado: Entradas y resultados de descuentos acordados con ventas.

- [ ] Definir porcentaje y NxM aplicables a un solo platillo por promoción, sin mezclar productos.
- [ ] Documentar elegibilidad, salida por partida, ahorro, total y copia histórica.
- [ ] Coordinar tipos con W1-01, catálogo con W2-01 y consumo del resultado con W4-01.
- [ ] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [ ] Completar `docs/auditorias/W3-01.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W3-02 Implementar administración de promociones

Prioridad: P0. Estado: pendiente.

Dependencias: W1-02, W1-03, W2-02, W3-01.

Resultado: API crea, edita, activa, desactiva y retira promociones.

- [ ] Crear migración y API con un platillo participante, tipo y parámetros válidos.
- [ ] Implementar temporal con inicio y fin y permanente sin vencimiento, usando hora de servidor.
- [ ] Restringir escritura al administrador y conservar las promociones referenciadas por ventas.
- [ ] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [ ] Completar `docs/auditorias/W3-02.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W3-03 Implementar cálculo exacto

Prioridad: P0. Estado: pendiente.

Dependencias: W1-02, W3-01.

Resultado: Porcentaje y NxM producen importes conocidos y reproducibles.

- [ ] Calcular con decimal.js desde cadenas, redondeo a dos decimales y total no negativo.
- [ ] Implementar grupos completos y sobrantes NxM; nunca cambiar unidades entregadas.
- [ ] Seleccionar una sola promoción por orden con mayor ahorro y desempatar por identificador; probar ejemplos independientes.
- [ ] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [ ] Completar `docs/auditorias/W3-03.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W3-04 Crear formulario web de promociones

Prioridad: P1. Estado: pendiente.

Dependencias: W3-02, W1-04.

Resultado: Administrador configura duración, porcentaje o N y M desde móvil.

- [ ] Crear lista y formulario con selector de platillo y Temporal/Permanente.
- [ ] Mostrar fecha y zona horaria, estado efectivo y errores; ocultar campos que no aplican al tipo.
- [ ] Comprobar guardar, suspender y retirar con API real y diseño común.
- [ ] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [ ] Completar `docs/auditorias/W3-04.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W3-05 Integrar promociones con la venta

Prioridad: P0. Estado: pendiente.

Dependencias: W3-02, W3-03, W4-01.

Resultado: Cotización y confirmación usan las mismas reglas del servidor.

- [ ] Entregar evaluación bajo datos consistentes y copia de reglas aplicadas.
- [ ] Detectar cambios de vigencia, precio o promoción entre cotización y confirmación.
- [ ] Integrar con ventas y comprobar que una promoción retirada no cambia su historial.
- [ ] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [ ] Completar `docs/auditorias/W3-05.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W3-06 Verificar promociones integradas

Prioridad: P1. Estado: pendiente.

Dependencias: W3-04, W3-05, W4-03.

Resultado: Porcentaje y NxM funcionan en una venta real sin alterar el consumo.

- [ ] Comprobar ejemplos 15 %, 2x1 y 3x1, fin exacto y promoción permanente desactivada.
- [ ] Verificar una promoción por orden, descuento por partida, total cero e historial.
- [ ] Contrastar unidades entregadas con consumo de inventario y entregar evidencia reproducible.
- [ ] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [ ] Completar `docs/auditorias/W3-06.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.
