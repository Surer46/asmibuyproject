# Auditoría 1 — Integrante 2: catálogo e inventario

Fecha: 29 de septiembre de 2026. Alcance: W2-01 a W2-06, CW-03 a CW-06, CW-08 y CW-09. Estado de esta revisión: **hallazgos abiertos**. La decisión humana corresponde al integrante 1 y, para consumo, también al integrante 4.

## Resultado observado

El backend y frontend compilaron. Las cuatro verificaciones W2 ejecutadas pasaron 87/87 casos. Al inspeccionar sus fuentes se comprobó que preparan `almacenMemoria`, por lo que no prueban atomicidad ni competencia en PostgreSQL. Se ejecutaron escenarios adicionales en PostgreSQL 18.4 aislado con las migraciones fuente aplicadas solo a esa base de prueba.

## Hallazgos que debe resolver el integrante 2

| Gravedad | Tarea | Hallazgo y evidencia | Acción y verificación requerida |
| --- | --- | --- | --- |
| Crítica | W2-03, CW-04/06 | `registrarAjuste()` calcula saldo antes de insertar sin transacción ni bloqueo (`inventario.service.ts:127-166`). Con 10 unidades y dos ajustes simultáneos de `-8`, **ambos terminaron correctamente y el saldo final fue `-6.000`** en PostgreSQL real. | Leer saldo y registrar ajuste con el mismo `PoolClient` y bloqueo estable; agregar protección de integridad en BD y repetir dos ajustes competidores, venta contra ajuste y rollback. |
| Alta | W2-02/03 | Varias consultas y escrituras convierten errores de PostgreSQL en operaciones de memoria (`catalogo.service.ts:123-148,287-318,710-719`; `inventario.service.ts:64-108,159-205`). Una operación puede responder éxito sin persistirse y el estado de distintos procesos puede divergir. | Mantener memoria solo en un entorno de pruebas expresamente aislado; en operación, devolver error y no confirmar cambios si falla la BD. |
| Alta | W2-02, CW-03 | Dentro de `ejecutarTransaccion`, `crearPlatillo()` y `actualizarPlatillo()` leen por `pool.query` a través de `obtenerPlatilloPorId()` antes del `COMMIT` (`catalogo.service.ts:707,820`). Reproducción en PostgreSQL: crear platillo devolvió `null` pese a quedar persistido; cambiar precio de `100.00` a `120.00` devolvió `100.00` aunque quedó guardado `120.00`. | Leer con el mismo cliente transaccional o tras el commit; probar respuestas y estado persistido de creación y edición. |
| Alta | W2-03 con W4-03 | `descontarInventarioPorVenta()` obtiene recetas mediante `CatalogoService.obtenerPlatilloPorId()` (`inventario.service.ts:334`), que usa el pool fuera de la transacción de Ventas, y solo después bloquea ingredientes (`:359-385`). Una edición de receta puede cambiar el consumo entre cotización y cobro; se confirmó venta aceptada tras cambiar la receta de 1 a 2 unidades de insumo. | Coordinar con integrante 4 una lectura consistente y versión de receta, junto con bloqueos antes de aceptar el resumen. |
| Media | W2-02/03 | `new Decimal(...)` acepta valores no finitos: la API de memoria aceptó un ingrediente con mínimo `"NaN"` y respondió `201`. También deben revisarse cantidades y precio. | Exigir decimal finito, formato y escala antes de escribir; probar `NaN`, infinito, notación inesperada y límites de `numeric`. |
| Evidencia | W2-04 a W2-06 | Las auditorías reportan integración, diseño móvil y stock con promociones, pero los scripts verificados operan en memoria y la revisión independiente sigue pendiente. No hay registros reales de versiones/capturas de navegadores móviles. | Sustituir las afirmaciones integradas por evidencia PostgreSQL y navegadores reales, y solicitar las revisiones humanas requeridas. |

## Límite de la revisión

La prueba PostgreSQL se hizo en una base aislada creada para esta auditoría. No se probó Supabase ni se pudo completar la inspección en navegadores móviles reales. El defecto de saldo negativo demuestra que CW-04 y CW-06 no están cerrados.
