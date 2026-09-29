# Auditoría 1 — Integrante 4: punto de venta e historial

Fecha: 29 de septiembre de 2026. Alcance: W4-01 a W4-06, CW-05 a CW-07 y CW-14 a CW-19. Estado de esta revisión: **hallazgos abiertos**. El revisor humano principal es el integrante 3; los integrantes 2 y 1 revisan consumo y acceso.

Los archivos de W4 inspeccionados eran cambios locales previos de otro ejecutor. Esta auditoría no modificó su código, planes ni auditorías W.

## Resultado observado

Los cuatro scripts W4 disponibles pasaron 100/100 comprobaciones y compila el backend. Las pruebas usan `almacenMemoria`. La ruta de Venta y la de Historial muestran todavía componentes de espera (`frontend/.../venta/venta.component.ts:17-38`; `historial/historial.component.ts:16-35`), visible también en el navegador local. No existe `docs/auditorias/W4-06.md` aunque el plan marca la tarea verificada.

## Hallazgos que debe resolver el integrante 4

| Gravedad | Tarea | Hallazgo y evidencia | Acción y verificación requerida |
| --- | --- | --- | --- |
| Crítica | W4-03, CW-07/14 | `confirmarVenta()` comprueba los `items` enviados, pero `validarConsistenciaCotizacion()` reconstruye la venta desde `cotizacionAceptada.partidas` (`ventas.service.ts:110-184`; `promociones.service.ts:734-740`). En PostgreSQL real se solicitaron **4** unidades con cotización de **1**: el servidor confirmó y consumió **1**. | Comparar exactamente carrito, cotización aceptada y resumen actual dentro de la transacción; rechazar diferencias de IDs, cantidades, método e importes. |
| Crítica | W4-03/04, CW-02 | `GET /ventas/recuperar/:claveIdempotencia` usa solo `exigirAutenticacion` y devuelve `buscarPorClaveIdempotencia()` sin validar propietario (`ventas.routes.ts:37-47`). Con dos sesiones de demostración, el trabajador recibió `200` y el detalle de una venta del administrador; `/ventas/:id` devolvió `403`. | Exigir propietario de la clave y venta o perfil administrador antes de devolver datos; probar recuperación cruzada con dos usuarios. |
| Alta | W4-03, CW-07 | La búsqueda de idempotencia ocurre antes de `BEGIN` y la restricción única de BD solo lanza error en la carrera (`ventas.service.ts:153-180,192-225`; migración 004:11). Con dos confirmaciones concurrentes de igual clave, una confirmó y otra terminó con código SQL `23505`, sin recuperar el resultado original. La comparación omite el método: reintentar la misma clave cambiando EFECTIVO por EXTERNO devolvió la venta original como si fuera la misma solicitud. | Guardar huella completa por usuario, resolver conflicto único consultando la operación original y distinguir una solicitud diferente; repetir doble clic y respuesta perdida sobre PostgreSQL. |
| Alta | W4-03, CW-14/15 | Cambiar receta después de cotizar se aceptó sin nueva conformidad y consumió la receta nueva. `ventas.service.ts:180-196,275-278` revalida importes fuera de `BEGIN`; inventario consulta receta por otra conexión. | Revalidar receta, precio y promoción de una instantánea consistente dentro de la transacción y conservar el consumo histórico por orden. |
| Alta | W4-05, CW-16 | `anularVenta()` lee antes de actualizar y su `UPDATE ... WHERE id = $4` no condiciona `estado='CONFIRMADA'` (`ventas.service.ts:605-626`). Dos anulaciones concurrentes sobrescribieron motivo/autor: el motivo final fue `Second reason`. | Ejecutar actualización condicional y devolver el original en reintentos; probar anulación concurrente y rollback. |
| Alta | W4-02/04/06, CW-17/19 | El carrito, la confirmación, el comprobante y el historial no están implementados en Angular: Venta e Historial son textos de espera. No hay conservación de clave pendiente ni recuperación tras recarga en el cliente. El plan W4-02 a W4-06 marca casillas de interfaz y navegadores `[x]` sin la función correspondiente. | Implementar flujo web, errores y estados de respuesta incierta, y verificarlo en Chrome Android, Safari iPhone y Chrome/Edge PC con capturas y versiones. Corregir las casillas mediante el proceso del equipo. |
| Alta | W4-01/04, CW-15 | La migración 004 solo copia nombre, tipo y ahorro promocional (`ordenes`), pero no porcentaje, N, M ni vigencia requeridos para la copia histórica. `movimientos_inventario.orden_id` tampoco tiene FK a `ordenes` y no hay snapshot de receta por partida. | Acordar migraciones nuevas con integrantes 2 y 3; conservar reglas y consumo exactos sin modificar migraciones aplicadas. |
| Media | W4-04 | El filtro por periodo compara `creado_en` con `new Date(filtro.fechaInicio/Fin)` (`ventas.service.ts:532-540`), sin zona del negocio configurada ni cierre de día exclusivo. | Definir zona horaria del negocio y límites del periodo; probar ventas cercanas a medianoche y cambios de horario. |
| Evidencia | W4-06 | Falta la auditoría W4-06. Las auditorías W4-01 a W4-05 siguen «en revisión» sin decisión humana. Los scripts de memoria no prueban concurrencia, pérdida de respuesta ni un navegador móvil real. | Crear evidencia W4-06 desde la plantilla cuando exista el recorrido completo y someter todas las tareas a sus revisores humanos. |

## Límite de la revisión

Las pruebas de carrera y consumo se hicieron sobre PostgreSQL 18.4 aislado. No se usó Supabase ni un navegador móvil real. La herramienta de navegador bloqueó continuar la navegación local; solo se observó antes la pantalla de Venta en el navegador integrado, sin adjudicarle equivalencia con Chrome/Edge PC.
