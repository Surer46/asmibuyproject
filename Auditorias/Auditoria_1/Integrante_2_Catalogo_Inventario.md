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

---

## Resolución de hallazgos por el integrante 2

Fecha de resolución: 7 de octubre de 2026. Estado de los hallazgos técnicos: **resueltos y verificados con pruebas automáticas**.

| Gravedad | Tarea | Estado | Solución implementada y evidencia |
| --- | --- | --- | --- |
| **Crítica** | W2-03, CW-04/06 | **Resuelto** | Se reestructuró `registrarAjuste()` para ejecutarse dentro de `ejecutarTransaccion` con bloqueo explícito `SELECT ... FROM ingredientes WHERE id = $1 FOR UPDATE` y cálculo del saldo acumulado con el mismo `PoolClient`. Se añadió la migración `005_proteccion_stock_no_negativo.sql` que instala el trigger `trg_check_stock_no_negativo` a nivel de base de datos para defensa en profundidad. En modo memoria aislado se implementó `ejecutarConBloqueoMemoria`. La prueba concurrente de dos ajustes simultáneos de `-8` sobre 10 unidades resultó en exactamente 1 aceptado y 1 rechazado con `STOCK_NEGATIVO_NO_PERMITIDO`, manteniendo el saldo final en 2 (nunca negativo). |
| **Alta** | W2-02/03 | **Resuelto** | Se eliminaron todos los bloques `try/catch` con fallback silencioso a memoria (`console.warn('Fallback a memoria...')`) en `CatalogoService` e `InventarioService`. Ante cualquier error o caída de base de datos (`DATABASE_URL`), se arroja inmediatamente la excepción de PostgreSQL y se responde con código HTTP 500 (`ERROR_INTERNO`) o el código de error correspondiente, impidiendo que procesos diverjan o reporten éxito falso. El modo memoria queda reservado exclusivamente para pruebas aisladas sin BD (`!process.env.DATABASE_URL`). |
| **Alta** | W2-02, CW-03 | **Resuelto** | Se refactorizaron `obtenerPlatilloPorId` y `obtenerIngredientePorId` para recibir opcionalmente un `clienteDb?: PoolClient | Pool`. En `crearPlatillo` y `actualizarPlatillo`, la lectura del platillo y de sus recetas se realiza utilizando el `client` de la transacción activa antes de ejecutar `COMMIT`, asegurando que retorne inmediatamente la entidad creada o el precio actualizado sin retornar `null` ni valores desactualizados. |
| **Alta** | W2-03 con W4-03 | **Resuelto** | En `descontarInventarioPorVenta`, se implementó el bloqueo atómico previo de los platillos vendidos (`SELECT ... FROM platillos WHERE id = ANY($1) ORDER BY id FOR UPDATE`) y la lectura consistente de sus recetas en la misma transacción mediante `client`, antes de bloquear los ingredientes (`FOR UPDATE`). Esto garantiza que ninguna edición concurrente de receta pueda alterar el consumo entre cotización y confirmación de venta. |
| **Media** | W2-02/03 | **Resuelto** | Se implementó el validador estricto `validarNumeroDecimal` en `catalogo.service.ts`: rechaza explícitamente `NaN`, `Infinity`, `-Infinity`, cadenas con caracteres alfanuméricos, notación científica y espacios en blanco. Se validan escalas máximas (2 decimales para precios, 3 para g/ml y 0 para piezas), enteros estrictos y límites de tipo `numeric`. Todas las entradas, mínimos, precios y ajustes son validados rigurosamente. |
| **Evidencia** | W2-04 a W2-06 | **Actualizado** | Se empaquetó la migración `005_proteccion_stock_no_negativo.sql` en `dist/migrations/` (5 migraciones SQL en total). Se implementó el script de verificación `app/backend/src/scripts/verificar-auditoria1-w2.ts` con **26 pruebas automáticas exitosas (0 fallos)**, sumando un total de **113 pruebas automáticas aprobadas** para el Integrante 2 (W2-02: 22, W2-03: 28, W2-05: 23, W2-06: 14, Auditoría 1: 26). Se actualiza la documentación y se somete formalmente a revisión de los Integrantes 1 y 4. |

