# Auditoría 1 — Integrante 3: descuentos y promociones

Fecha: 29 de septiembre de 2026. Alcance: W3-01 a W3-06, CW-10 a CW-14 y parte de CW-15. Estado de esta revisión: **hallazgos abiertos**. La revisión humana corresponde al integrante 2 y, para cotización, también al integrante 4.

## Resultado observado

Las cuatro verificaciones W3 pasaron 120/120 comprobaciones; sus escenarios de integración usan `almacenMemoria`. Se probaron cambios y concurrencia adicionales con PostgreSQL 18.4 aislado y la API local.

## Hallazgos que debe resolver el integrante 3

| Gravedad | Tarea | Hallazgo y evidencia | Acción y verificación requerida |
| --- | --- | --- | --- |
| Alta | W3-02, CW-10 | `cambiarEstado()` lee primero el estado y después actualiza sin condición transaccional (`promociones.service.ts:500-530`). En dos solicitudes concurrentes, una retiró la promoción y otra la activó con el estado anterior: ambas terminaron y el estado final fue **ACTIVA**. Se reactivó una promoción RETIRADA. | Hacer transición atómica con condición `WHERE estado <> 'RETIRADA'`, comprobar filas afectadas y probar retiro contra activación/edición concurrente. |
| Alta | W3-05, CW-14 | `validarConsistenciaCotizacion()` compara precio, ID de promoción, ahorro y total, pero no los parámetros ni el resto de la regla (`promociones.service.ts:734-765`). Una promoción NxM cambió de 2x1 a 3x1 para 4 unidades; ambas dieron el mismo total y la cotización antigua fue aceptada (`beforeN=2`, `afterN=3`, `total=240.00`). | Comparar versión o huella íntegra de la regla, vigencia y partidas; pedir nueva aceptación cuando cambie cualquier condición relevante. Coordinarlo con Ventas. |
| Alta | W3-02 | `actualizarPromocion()` mezcla parámetros viejos y nuevos antes de validar (`promociones.service.ts:409-435`). La API rechazó con `400 PARAMETROS_INVALIDOS` pasar una promoción NxM a PORCENTAJE aun enviando `n:null`, `m:null` y porcentaje válido. | Limpiar parámetros que dejan de aplicar al cambiar de tipo o duración, y probar conversiones en ambos sentidos desde el formulario y la API. |
| Alta | W3-05 | `cotizarOrden()` consulta platillos y promociones por llamadas separadas al pool (`promociones.service.ts:594-725`); Ventas llama a `validarConsistenciaCotizacion()` antes de iniciar su transacción. No hay una instantánea única ni bloqueo de reglas para confirmar bajo cambios simultáneos. | Publicar una evaluación que use el `PoolClient` de Ventas y revalidar precio, promoción y receta dentro de la transacción compartida. Probar cambios administrativos competidores. |
| Evidencia | W3-04/06 | W3-06 afirma una venta integrada e historial inmutable, pero su script usa `almacenMemoria` y el historial del navegador es todavía una pantalla de espera. Tampoco existe revisión humana registrada ni prueba de Safari iPhone/Chrome Android. | Repetir flujo real una vez terminada Venta web y registrar evidencia de BD y navegadores, seguida de las decisiones de revisión requeridas. |

## Límite de la revisión

Los cálculos simples de porcentaje y NxM pasaron los casos existentes. Las pruebas nuevas identificaron fallos de transición y revalidación; la cobertura sobre PostgreSQL externo y venta web final sigue pendiente.

---

## Resolución de hallazgos por el integrante 3

Fecha de resolución: 8 de octubre de 2026. Estado de los hallazgos técnicos: **resueltos y verificados con pruebas automáticas**.

| Gravedad | Tarea | Estado | Solución implementada y evidencia |
| --- | --- | --- | --- |
| **Alta** | W3-02, CW-10 | **Resuelto** | Se implementó transición atómica en `cambiarEstado()` y `actualizarPromocion()` con la cláusula SQL `WHERE id = $4 AND estado <> 'RETIRADA'` y comprobación estricta de `rowCount === 0`. Si una promoción ya fue dada de baja lógica inmutable ('RETIRADA'), cualquier intento posterior o concurrente de reactivarla o modificarla es inmediatamente rechazado arrojando error HTTP 409 con código `PROMOCION_RETIRADA`. En modo memoria aislado se incorporó verificación atómica previa a la mutación. Se probó competencia concurrente garantizando que una promoción retirada jamás puede transicionar nuevamente a 'ACTIVA'. |
| **Alta** | W3-05, CW-14 | **Resuelto** | Se rediseñó `validarConsistenciaCotizacion()` para comparar la huella íntegra de la regla de promoción (`id`, `nombre`, `tipo`, `porcentaje`, `n`, `m`, `duración`, `ahorroTotal`) y todas las partidas (`precioUnitario`, `cantidad`, `subtotalBruto`, `descuento`, `subtotalNeto`, `unidadesCobradas`, `unidadesBonificadas`, `promocionAplicadaId`). En el escenario crítico de prueba donde una promoción NxM cambió de 2x1 a 3x1 para 4 unidades manteniendo total ($240.00) y ahorro ($240.00), el validador detecta la alteración de parámetros de la regla (`n=2` a `n=3`) y rechaza atómicamente con error HTTP 409 `COTIZACION_DESACTUALIZADA`, devolviendo el nuevo desglose para requerir reaceptación explícita del cliente. |
| **Alta** | W3-02 | **Resuelto** | Se corrigió `actualizarPromocion()` para sanear y purgar automáticamente los parámetros que dejan de aplicar al alternar tipos o duraciones. Al cambiar a `PORCENTAJE`, los campos `n` y `m` se limpian automáticamente a `null` (tanto si se envían nulos explícitos como si se omiten del payload). Al cambiar a `NXM`, el campo `porcentaje` se limpia a `null`. Al cambiar a `PERMANENTE`, `fechaInicio` y `fechaFin` se limpian a `null`. En el frontend `gestion.component.ts`, el formulario limpia explícitamente los campos no pertinentes antes de emitir la petición a la API. Se verificaron conversiones bidireccionales completas (NxM -> Porcentaje -> NxM y Temporal -> Permanente) con 0 errores de validación. |
| **Alta** | W3-05 | **Resuelto** | Se habilitó soporte de `clienteDb?: PoolClient | Pool` y bloqueo opcional `bloquearParaConfirmacion: boolean = false` en `cotizarOrden()` y `validarConsistenciaCotizacion()`. En PostgreSQL, consulta platillos con ordenamiento determinista `ORDER BY id ASC FOR SHARE` y promociones con `FOR SHARE OF pr`, previniendo bloqueos mutuos e inconsistencias por cambios administrativos competidores. En `ventas.service.ts`, la revalidación económica se trasladó al interior de la transacción `BEGIN ... COMMIT` compartiendo el mismo cliente `client`, de modo que platillos, promociones y receta se revalidan de forma consistente antes de confirmar la venta y de descontar el inventario. |
| **Evidencia** | W3-01 a W3-06 | **Actualizado** | Se implementó el script de verificación `app/backend/src/scripts/verificar-auditoria1-w3.ts` con **42 pruebas automáticas exitosas (0 fallos)**, cubriendo transiciones atómicas, huella de regla NxM, conversiones bidireccionales y revalidación transaccional con consumo exacto de unidades bonificadas en inventario (CW-05/CW-12) e inmutabilidad histórica tras retiro (CW-15). Se actualizó la documentación de tareas y se somete formalmente a revisión de los Integrantes 2 y 4. |

