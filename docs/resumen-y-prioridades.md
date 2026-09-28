# Resumen y prioridades del MVP web móvil

El equipo desarrollará una web interna para vender platillos y administrar recetas, ingredientes, inventario y promociones en una sola sucursal. Se accederá desde el navegador del teléfono y también desde PC. El alcance tiene 24 tareas y 20 criterios de aceptación. **Se programa en TypeScript:** Angular en frontend y Express sobre Node.js en backend; PostgreSQL se aloja externamente en Supabase Free. **Se programa en TypeScript:** Angular en frontend y Express sobre Node.js en backend; PostgreSQL se aloja externamente en Supabase Free.

Se mantienen mínimos por ingrediente y descuentos temporales o permanentes, incluidos 2x1 y 3x1. Se retiran roles configurables, aplicaciones nativas, push, informes adicionales y promociones mezcladas. Hay dos perfiles fijos sin pantalla de roles; las cuentas se mantienen mediante una utilidad técnica.

P0 significa que desbloquea base o flujo central. P1 completa funciones o verifica la entrega. Ambos son obligatorios y siempre se respetan dependencias. Los nombres personales quedan por asignar. Codex apoya la coordinación y las auditorías cuando se le asigne un encargo; ver [rol de orquestador](rol-orquestador.md). Codex apoya la coordinación y las auditorías cuando se le asigne un encargo; ver [rol de orquestador](rol-orquestador.md).

## Integrante 1 Base web y acceso

Entorno, aplicación web común, API, acceso con perfiles fijos, diseño compartido, despliegue y recuperación. Revisor: integrante 4.

| ID | Prioridad | Tarea | Dependencias | Resultado |
| --- | --- | --- | --- | --- |
| W1-01 | P0 | Fijar entorno y contratos comunes | Ninguna | Versiones compatibles, moneda, zona horaria y convenciones acordadas. |
| W1-02 | P0 | Crear la base ejecutable | W1-01 | Web y API arrancan y consultan PostgreSQL desde una copia limpia. |
| W1-03 | P0 | Implementar acceso sencillo | W1-02 | Inicio y cierre de sesión con administrador y trabajador fijos. |
| W1-04 | P0 | Entregar navegación y diseño web | W1-02 | Componentes comunes utilizables desde móvil y navegador de PC. |
| W1-05 | P1 | Preparar instalación y verificación | W1-03, W1-04 | Otro integrante puede instalar y ejecutar el proyecto con instrucciones. |
| W1-06 | P1 | Verificar entrega y recuperación | W1-05, W2-06, W3-06, W4-06 | Versión integrada comprobada y respaldo restaurado en una base aislada. |

Detalle y casillas en [su plan](../modulos/plataforma-accesos/plan.md).

## Integrante 2 Catálogo e inventario

Ingredientes, platillos, recetas, existencias, movimientos, consumo y alertas dentro de la web. Revisor: integrante 1.

| ID | Prioridad | Tarea | Dependencias | Resultado |
| --- | --- | --- | --- | --- |
| W2-01 | P0 | Definir datos y contrato de inventario | Ninguna | Modelo de receta y contrato de consumo acordados con ventas. |
| W2-02 | P0 | Implementar catálogo y recetas | W1-02, W1-03, W2-01 | API de ingredientes y platillos con recetas válidas. |
| W2-03 | P0 | Implementar movimientos y consumo | W2-02 | Entradas, ajustes y ventas mantienen el saldo sin negativos. |
| W2-04 | P1 | Crear pantallas de gestión | W2-03, W1-04 | Administrador gestiona ingredientes, recetas y movimientos desde el móvil. |
| W2-05 | P1 | Implementar mínimos y Avisos | W2-03, W1-04 | Una condición de bajo stock por ingrediente, visible dentro de la web. |
| W2-06 | P1 | Verificar inventario integrado | W2-04, W2-05, W4-03 | Ventas y movimientos coinciden con existencias y alertas reales. |

Detalle y casillas en [su plan](../modulos/catalogo-inventario/plan.md).

## Integrante 3 Descuentos y promociones

Porcentaje y NxM por un mismo platillo, duración temporal o permanente y cálculo único en servidor. Revisor: integrante 2.

| ID | Prioridad | Tarea | Dependencias | Resultado |
| --- | --- | --- | --- | --- |
| W3-01 | P0 | Definir el contrato económico | Ninguna | Entradas y resultados de descuentos acordados con ventas. |
| W3-02 | P0 | Implementar administración de promociones | W1-02, W1-03, W2-02, W3-01 | API crea, edita, activa, desactiva y retira promociones. |
| W3-03 | P0 | Implementar cálculo exacto | W1-02, W3-01 | Porcentaje y NxM producen importes conocidos y reproducibles. |
| W3-04 | P1 | Crear formulario web de promociones | W3-02, W1-04 | Administrador configura duración, porcentaje o N y M desde móvil. |
| W3-05 | P0 | Integrar promociones con la venta | W3-02, W3-03, W4-01 | Cotización y confirmación usan las mismas reglas del servidor. |
| W3-06 | P1 | Verificar promociones integradas | W3-04, W3-05, W4-03 | Porcentaje y NxM funcionan en una venta real sin alterar el consumo. |

Detalle y casillas en [su plan](../modulos/promociones/plan.md).

## Integrante 4 Punto de Venta e historial

Carrito, cotización, cobro, comprobante en pantalla, historial, total por periodo y anulación sencilla. Revisor: integrante 3.

| ID | Prioridad | Tarea | Dependencias | Resultado |
| --- | --- | --- | --- | --- |
| W4-01 | P0 | Definir órdenes e integración | Ninguna | Contrato de cotizar, confirmar, recuperar y anular acordado. |
| W4-02 | P0 | Crear carrito y cotización web | W4-01, W1-02, W1-03, W1-04, W2-02 | Trabajador prepara una venta y consulta importes del servidor. |
| W4-03 | P0 | Confirmar venta y consumir stock | W4-02, W2-03, W3-05 | Orden e inventario se confirman una sola vez o se revierten juntos. |
| W4-04 | P1 | Crear comprobante e historial | W4-03 | Se consultan ventas y su detalle histórico por periodo. |
| W4-05 | P1 | Implementar anulación sencilla | W4-04 | Administrador anula toda la venta con motivo y conserva el original. |
| W4-06 | P1 | Verificar el recorrido de venta | W4-04, W4-05, W2-05, W3-05 | Venta completa comprobada en navegadores móviles y de PC. |

Detalle y casillas en [su plan](../modulos/ventas-reportes/plan.md).

## Primer paso y cierre

El integrante 1 comienza por W1-01 y entrega la base con W1-02; los otros tres definen contratos en paralelo. W4-03 alcanza la primera venta integrada; W1-06 cierra la entrega tras verificaciones de cada módulo. Cada tarea requiere auditoría y revisión independiente, sin ampliar el alcance para resolver un bloqueo.

Para reglas funcionales completas consultar [spec.md](../spec.md). Todos los estados de implementación están pendientes. Angular y Express se alojarán aparte de la base de datos Supabase; W1-01/W1-05 documentan esos entornos y W1-06 verifica restauración propia. Angular y Express se alojarán aparte de la base de datos Supabase; W1-01/W1-05 documentan esos entornos y W1-06 verifica restauración propia.
