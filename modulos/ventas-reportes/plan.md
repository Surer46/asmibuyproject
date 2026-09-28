# Plan del integrante 4

## Punto de Venta e historial

Versión 2.1. Estado: pendiente. Responsable personal: por asignar. Revisor principal: integrante 3.

Carrito, cotización, cobro, comprobante en pantalla, historial, total por periodo y anulación sencilla.

Leer [spec](../../spec.md), [reglas generales](../../AGENTS.md), [reglas locales](AGENTS.md), [arquitectura](../../docs/arquitectura-tecnica.md) y [matriz](../../docs/matriz-aceptacion.md). Usar [frontend](frontend/README.md) y [backend](backend/README.md). P0 y P1 son obligatorios; ejecutar por dependencias.

| ID | Prioridad | Tarea | Dependencias |
| --- | --- | --- | --- |
| W4-01 | P0 | Definir órdenes e integración | Sin prerrequisito; coordinar contratos |
| W4-02 | P0 | Crear carrito y cotización web | W4-01, W1-02, W1-03, W1-04, W2-02 |
| W4-03 | P0 | Confirmar venta y consumir stock | W4-02, W2-03, W3-05 |
| W4-04 | P1 | Crear comprobante e historial | W4-03 |
| W4-05 | P1 | Implementar anulación sencilla | W4-04 |
| W4-06 | P1 | Verificar el recorrido de venta | W4-04, W4-05, W2-05, W3-05 |

## W4-01 Definir órdenes e integración

Prioridad: P0. Estado: pendiente.

Dependencias: ninguna; coordinar los contratos iniciales en paralelo.

Resultado: Contrato de cotizar, confirmar, recuperar y anular acordado.

- [ ] Definir datos históricos, folio, idempotencia y estados CONFIRMADA y ANULADA.
- [ ] Acordar la transacción completa con inventario y evaluación económica con promociones.
- [ ] Coordinar tipos con W1-01 y definir recuperación de respuesta incierta sin venta sin conexión.
- [ ] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [ ] Completar `docs/auditorias/W4-01.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W4-02 Crear carrito y cotización web

Prioridad: P0. Estado: pendiente.

Dependencias: W4-01, W1-02, W1-03, W1-04, W2-02.

Resultado: Trabajador prepara una venta y consulta importes del servidor.

- [ ] Crear catálogo, carrito y cantidades enteras positivas, sin reservar stock.
- [ ] Mostrar subtotal, descuento, total y errores; integrar promociones cuando W3-05 esté disponible.
- [ ] Conservar la clave de una confirmación pendiente en el navegador, sin guardar credenciales allí.
- [ ] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [ ] Completar `docs/auditorias/W4-02.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W4-03 Confirmar venta y consumir stock

Prioridad: P0. Estado: pendiente.

Dependencias: W4-02, W2-03, W3-05.

Resultado: Orden e inventario se confirman una sola vez o se revierten juntos.

- [ ] Implementar una transacción con validación de usuario, versiones, receta, precio, promoción y demanda conjunta.
- [ ] Confirmar importes aceptados y registrar folio, copias históricas y consumos, incluido lo bonificado.
- [ ] Resolver idempotencia y respuesta perdida con consulta/reintento de la misma clave; probar rollback y competencia por stock.
- [ ] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [ ] Completar `docs/auditorias/W4-03.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W4-04 Crear comprobante e historial

Prioridad: P1. Estado: pendiente.

Dependencias: W4-03.

Resultado: Se consultan ventas y su detalle histórico por periodo.

- [ ] Mostrar comprobante en pantalla con folio, fecha, cajero, partidas, descuento, total y método registrado.
- [ ] Crear historial por fechas y total de ventas confirmadas del periodo; trabajador ve las propias y administrador todas.
- [ ] Comprobar que editar catálogo o promociones no modifica ventas anteriores.
- [ ] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [ ] Completar `docs/auditorias/W4-04.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W4-05 Implementar anulación sencilla

Prioridad: P1. Estado: pendiente.

Dependencias: W4-04.

Resultado: Administrador anula toda la venta con motivo y conserva el original.

- [ ] Registrar anulación total idempotente con responsable, motivo y fecha; impedir editar o borrar la venta.
- [ ] Mantener el consumo original; no realizar reintegros automáticos ni clasificar preparaciones.
- [ ] Excluir anuladas del total vigente; explicar que una recuperación física se registra por ajuste justificado de inventario y que no se reembolsa dinero automáticamente.
- [ ] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [ ] Completar `docs/auditorias/W4-05.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W4-06 Verificar el recorrido de venta

Prioridad: P1. Estado: pendiente.

Dependencias: W4-04, W4-05, W2-05, W3-05.

Resultado: Venta completa comprobada en navegadores móviles y de PC.

- [ ] Probar venta, promociones, alertas, anulación, historial y accesos con los módulos reales.
- [ ] Probar doble clic, dos sesiones compitiendo por stock, pérdida de respuesta y recarga de página.
- [ ] Verificar Chrome Android, Safari iPhone y Chrome/Edge de PC; registrar versiones y evidencia para el cierre W1-06.
- [ ] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [ ] Completar `docs/auditorias/W4-06.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.
