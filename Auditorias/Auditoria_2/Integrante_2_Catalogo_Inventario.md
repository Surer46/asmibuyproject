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
