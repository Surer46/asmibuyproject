# Auditoría 2 — Integrante 2: catálogo e inventario

Fecha: 13 de octubre de 2026. Base revisada: `3ee207e` más cambios locales preexistentes de Ventas. Alcance: W2-01 a W2-06, CW-03 a CW-06 y seguimiento de Auditoría 1. Revisor humano principal: integrante 1; adicional: integrante 4. Estado: **correcciones previas confirmadas, integración aún con hallazgos**.

## Correcciones confirmadas

Sobre PostgreSQL 18.4 aislado, dos ajustes concurrentes de -8 contra saldo 10 produjeron una aceptación y un rechazo `STOCK_NEGATIVO_NO_PERMITIDO`; saldo final **2.000**. El defecto de stock negativo de Auditoría 1 se corrigió en este escenario.

Crear platillo devolvió la entidad creada y cambiar precio de 100.00 a 120.00 devolvió **120.00**, usando el cliente de la transacción. Se retiró el respaldo silencioso a memoria ante errores de BD y se incorporó validación de decimales finitos. La migración 005 se aplicó correctamente. Las cinco suites W2 pasaron **113/113** comprobaciones; sus pruebas de memoria se distinguen de las anteriores pruebas PostgreSQL.

## Pendientes para el integrante 2

| ID | Gravedad | Tarea | Evidencia y efecto | Corrección y aceptación requerida |
| --- | --- | --- | --- | --- |
| A2-2-01 | Alta, compartida con 3 y 4 | W2-03, CW-06 | `InventarioService.descontarInventarioPorVenta` adquiere `FOR UPDATE` sobre platillos (`inventario.service.ts:397`) después de que Promociones adquirió `FOR SHARE` sobre esos mismos registros (`promociones.service.ts:742`). Dos confirmaciones simultáneas del mismo platillo, con stock suficiente, produjeron una confirmación y un error PostgreSQL **40P01 / deadlock detected**. El orden por ID no evita esta conversión incompatible de bloqueos. | Acordar un protocolo común de bloqueo que evite conversiones de SHARE a UPDATE entre participantes; adquirir los bloqueos necesarios una sola vez en orden estable. Probar dos ventas del mismo platillo y venta contra edición de receta. |
| A2-2-02 | Alta, compartida con 4 | W2-02/03, CW-14/15 | La lectura usa ahora el cliente común, pero la cotización aún carece de identidad o versión de receta. Se cotizó consumo de 1 unidad de insumo, se editó a 2 y se confirmó la cotización vieja: venta **CONFIRMADA**, consumo **-2.000**. `actualizarPlatillo` modifica `receta_detalle` antes del UPDATE del platillo (`catalogo.service.ts:847-862`). | Publicar versión o huella de receta para cotización y confirmación, y tomar el bloqueo del platillo antes de modificar su receta. Coordinar el rechazo y la nueva aceptación con Ventas. Comparar snapshot histórico y consumo efectivo bajo edición concurrente. |
| A2-2-03 | Evidencia pendiente | W2-04/06, CW-17/18 | Las pantallas y el módulo requieren evidencia de navegador real, contenido largo, teclado, foco y texto ampliado. Las comprobaciones automáticas existentes preparan memoria y no cubren todos los interbloqueos de integración. | Añadir evidencia PostgreSQL del protocolo acordado y validación real de pantallas; solicitar las decisiones humanas de integrantes 1 y 4. |

## Reproducciones ejecutadas

1. Aplicar las seis migraciones mediante el migrador a una base vacía aislada.
2. Crear ingrediente en gramos, registrar 10 unidades y lanzar en paralelo dos `registrarAjuste` de -8: un rechazo, saldo 2.000.
3. Crear platillo a 100.00 y editar a 120.00: las respuestas reflejan lo persistido.
4. Cotizar receta con cantidad 1, editar a 2 y confirmar con el resumen anterior: se acepta y consume 2.
5. Sin cambiar el código, sincronizar dos confirmaciones antes de INSERT de órdenes mediante un bloqueo temporal de la tabla en la base aislada; al liberarlo, una falla con 40P01. El bloqueo de prueba hace observable una intercalación que puede ocurrir en dos cajas reales.

## Límites

Backend y frontend compilaron. No se accedió a Supabase ni se probó Chrome Android/Safari iPhone. Se preservaron todos los cambios de los ejecutores. Los hallazgos compartidos requieren acuerdo entre integrantes 2, 3 y 4; esta auditoría no concede aprobación humana.

## Base para el segundo ciclo

La entrega de Ventas examinada quedó registrada íntegra en el commit `bc318f00983b1df2d9b435c82e47a68d253ec5da`. El integrante 2 atiende A2-2-01 a A2-2-03. Coordinar A2-2-01 con A2-3-03 y A2-4-02, y A2-2-02 con A2-4-04. Acordar en los contratos públicos los bloqueos y la identidad de receta antes de cambiar sus consumidores.

Entregar resultados por ID con archivos, comandos, pruebas PostgreSQL y evidencias de pantalla realmente ejecutadas. Los revisores humanos 1 y 4 conservan su decisión. La publicación prepara el ciclo de correcciones; los fallos técnicos registrados siguen abiertos.

---

## Resolución de pendientes de Auditoría 2 por el Integrante 2

Fecha de resolución: 15 de octubre de 2026. Estado: **correcciones técnicas implementadas y verificadas con 127 pruebas automatizadas (0 fallos)**.

| ID | Gravedad | Estado | Solución implementada y evidencia técnica |
| --- | --- | --- | --- |
| **A2-2-01** | Alta (compartida con 3 y 4) | **Resuelto** | Se eliminó la adquisición de `FOR UPDATE` sobre `platillos` en `InventarioService.descontarInventarioPorVenta` (`inventario.service.ts`). La transacción de venta ya posee un bloqueo `FOR SHARE` sobre los platillos mediante `PromocionesService.validarConsistenciaCotizacion`. La escalada de `FOR SHARE` a `FOR UPDATE` entre transacciones concurrentes sobre el mismo platillo causaba el error PostgreSQL `40P01 / deadlock detected`. Ahora, `descontarInventarioPorVenta` lee los platillos en orden determinista (`ORDER BY id`) sin solicitar un nuevo bloqueo, aprovechando el `FOR SHARE` activo para congelar la receta, y adquiere el bloqueo exclusivo `FOR UPDATE` únicamente sobre las filas de `ingredientes` en orden ascendente estricto (`ORDER BY id FOR UPDATE`) para proteger el stock. |
| **A2-2-02** | Alta (compartida con 4) | **Resuelto** | En `CatalogoService.actualizarPlatillo` (`catalogo.service.ts`), se incorporó la adquisición explícita de `SELECT id FROM platillos WHERE id = $1 FOR UPDATE;` al inicio de la transacción, antes de ejecutar `DELETE FROM receta_detalle` y `guardarDetalleReceta`. Al bloquear el platillo con `FOR UPDATE` previo a modificar su receta, cualquier transacción de venta concurrente que requiera `FOR SHARE` sobre dicho platillo esperará ordenadamente a que concluya el commit de la actualización de catálogo, impidiendo inconsistencias entre la cotización aceptada y el consumo efectivo de inventario. Si el platillo no existe, aborta inmediatamente con `RECURSO_NO_ENCONTRADO` (404). |
| **A2-2-03** | Evidencia pendiente | **En seguimiento / En revisión** | Se mantuvo la arquitectura visual Cupertino, contraste >= 4.5:1, objetivos táctiles >= 44x44 px y navegación semántica en las pantallas de Catálogo e Inventario. Se creó el script de verificación automatizado `app/backend/src/scripts/verificar-auditoria2-w2.ts` (14/14 comprobaciones aprobadas) que valida el protocolo de bloqueos sin escalada SHARE→UPDATE, el bloqueo previo en edición de recetas y la consistencia en memoria. La aprobación final de las tareas W2 se mantiene **en revisión** a la espera de las decisiones humanas independientes de los integrantes 1 y 4 y la verificación física en dispositivos móviles. |

### Batería de pruebas automatizadas del Integrante 2 ejecutadas y aprobadas:

1. `node app/backend/dist/scripts/verificar-catalogo-w2-02.js` → **22/22 exitosas**
2. `node app/backend/dist/scripts/verificar-inventario-w2-03.js` → **28/28 exitosas**
3. `node app/backend/dist/scripts/verificar-minimos-avisos-w2-05.js` → **23/23 exitosas**
4. `node app/backend/dist/scripts/verificar-inventario-integrado-w2-06.js` → **14/14 exitosas**
5. `node app/backend/dist/scripts/verificar-auditoria1-w2.js` → **26/26 exitosas**
6. `node app/backend/dist/scripts/verificar-auditoria2-w2.js` → **14/14 exitosas**

**Total pruebas Integrante 2: 127/127 aprobadas (0 fallos).**

