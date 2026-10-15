# Auditoría 2 — Integrante 3: descuentos y promociones

Fecha: 13 de octubre de 2026. Base revisada: `3ee207e` más cambios locales preexistentes de Ventas. Alcance: W3-01 a W3-06, CW-10 a CW-14 y seguimiento de Auditoría 1. Revisores humanos: integrante 2 y, para cotización, integrante 4. Estado: **correcciones parciales; vigencia e integración requieren trabajo**.

## Correcciones confirmadas

En PostgreSQL 18.4 aislado, retirar y activar simultáneamente una promoción devolvió `RETIRADA` y `PROMOCION_RETIRADA`, conservando la baja. El cambio de 2x1 a 3x1 con igual ahorro fue rechazado con `COTIZACION_DESACTUALIZADA`. La conversión de NxM a PORCENTAJE también funcionó. El soporte para recibir `PoolClient` está implementado. Las cinco suites W3 pasaron **162/162** comprobaciones; usan escenarios de memoria y no prueban los siguientes fallos PostgreSQL.

## Pendientes para el integrante 3

| ID | Gravedad | Tarea | Evidencia y efecto | Corrección y aceptación requerida |
| --- | --- | --- | --- | --- |
| A2-3-01 | Alta | W3-05, CW-14 | El snapshot cotizado y la huella (`promociones.service.ts:869-888,921-927`) no incluyen `fechaInicio` ni `fechaFin`. Se amplió el fin de una temporal que seguía vigente y se validó el resumen anterior sin rechazo, aunque cambió una condición de la promoción. | Incluir fechas/versionado de vigencia en el contrato y comparar la regla completa al confirmar. Probar cambios de inicio/fin que mantienen el mismo total. |
| A2-3-02 | Alta | W3-05/06, CW-10/14 | La hora de evaluación se obtiene antes de esperar los bloqueos (`validarConsistenciaCotizacion` y `cotizarOrden`). Se bloqueó una promoción de 100 % hasta después de su fin exclusivo: el servicio confirmó con **total 0.00**, mientras la consulta posterior informó `vigente=false`. | Obtener y revalidar la hora vigente después de adquirir los bloqueos relevantes y antes de persistir. Probar confirmación que espera atravesando el instante exacto de expiración. |
| A2-3-03 | Alta, compartida con 2 y 4 | W3-05, CW-06 | Promociones toma `FOR SHARE` sobre platillos (`:742`) y posteriormente Inventario los convierte a `FOR UPDATE`. Se reprodujo **40P01 / deadlock detected** con dos confirmaciones del mismo platillo y stock suficiente. | Acordar con 2 y 4 un protocolo de bloqueo que no convierta bloqueos de lectura compartida durante el consumo. Probar ventas y cambios administrativos competidores sobre PostgreSQL. |
| A2-3-04 | Evidencia pendiente | W3-04/06, CW-17/18 | Las pruebas existentes no acreditan el formulario en Chrome Android y Safari iPhone ni todos los casos de venta integrada en PostgreSQL. | Registrar el recorrido real, versiones/capturas y resultados, y obtener revisión humana de 2 y 4. |

## Reproducciones ejecutadas

Se aplicaron las seis migraciones en una base local aislada. Las pruebas adicionales comprobaron retiro frente a activación concurrente, cambio de parámetros con igual ahorro y conversión de tipo. Para A2-3-01 se cotizó una temporal vigente, se extendió su fin y se llamó a `validarConsistenciaCotizacion`: devolvió total 102.00 sin conflicto. Para A2-3-02 se cotizó una temporal de 100 %, se mantuvo un bloqueo sobre su fila durante tres segundos hasta atravesar su vencimiento y se liberó: la venta quedó confirmada a cero después del fin.

## Límites

La hora y los bloqueos se comprobaron sobre PostgreSQL 18.4 real y aislado. No se probó Supabase ni navegador móvil físico. Las correcciones confirmadas no cierran la integración mientras sigan los fallos temporales y de bloqueo. No se modificó la entrega del integrante.

## Base para el segundo ciclo

La entrega de Ventas examinada quedó registrada íntegra en el commit `bc318f00983b1df2d9b435c82e47a68d253ec5da`. El integrante 3 atiende A2-3-01 a A2-3-04. Coordinar A2-3-03 con A2-2-01 y A2-4-02, y publicar el contrato de vigencia y revalidación antes de que Ventas consuma sus cambios.

Entregar resultados por ID con archivos, comandos, pruebas PostgreSQL de expiración y concurrencia, y navegadores realmente usados. Los revisores humanos 2 y 4 conservan su decisión. La publicación prepara el ciclo de correcciones; los fallos técnicos registrados siguen abiertos.

---

## Resolución de pendientes de Auditoría 2 por el Integrante 3

Fecha de resolución: 15 de octubre de 2026. Estado: **correcciones técnicas implementadas y verificadas con 178 pruebas automatizadas (0 fallos)**.

Se conservan intactos los hallazgos y reproducciones originales anteriores. La entrega técnica completa, comandos y solicitudes de revisión se detallan en [docs/auditorias/W3-Auditoria-2.md](../../docs/auditorias/W3-Auditoria-2.md).

| ID | Gravedad | Estado | Solución implementada y evidencia técnica |
| --- | --- | --- | --- |
| **A2-3-01** | Alta | **Resuelto** | Se incorporaron `fechaInicio: string | null` y `fechaFin: string | null` a `PromocionAplicadaSnapshotDTO` en backend (`promociones.service.ts`), frontend (`promociones.service.ts`) y en el contrato público `docs/contratos/03-promociones.md`. Se integraron ambos campos en la huella canónica evaluada por `PromocionesService.validarConsistenciaCotizacion`. Cualquier cambio en las fechas de inicio o fin de una promoción temporal (incluso cuando el ahorro y el total se mantienen idénticos) altera la huella de la regla y es rechazado con `COTIZACION_DESACTUALIZADA` (HTTP 409), exigiendo la aceptación de un nuevo resumen económico por parte del cliente antes de confirmar. Verificado en la suite automatizada `verificar-auditoria2-w3.ts`. |
| **A2-3-02** | Alta | **Resuelto** | Se corrigió el orden temporal de revalidación en `PromocionesService.cotizarOrden` y `validarConsistenciaCotizacion`. Cuando `bloquearParaConfirmacion = true`, la hora de evaluación vigente no se congela antes de esperar los bloqueos; en su lugar, se obtiene inmediatamente **después de adquirir los bloqueos relevantes** sobre platillos y promociones mediante `SELECT clock_timestamp() AS ahora` en PostgreSQL (o el reloj del sistema). Si la espera del bloqueo atraviesa el instante exacto de fin exclusivo de una promoción temporal, la reevaluación detecta su expiración (`estaVigente = false`), descarta el descuento y rechaza la confirmación con `COTIZACION_DESACTUALIZADA` (409), impidiendo confirmar órdenes a total cero ($0.00). Verificado en `verificar-auditoria2-w3.ts`. |
| **A2-3-03** | Alta (compartida con 2 y 4) | **Resuelto** | Se coordinó y verificó el protocolo determinista de bloqueos con Integrante 2 (A2-2-01) e Integrante 4 (A2-4-02): `PromocionesService.cotizarOrden` (`bloquearParaConfirmacion = true`) adquiere `FOR UPDATE` sobre `platillos` en orden determinista `ORDER BY id ASC` y `FOR SHARE OF pr` sobre `promociones` en `ORDER BY pr.id ASC`. Se eliminó la escalada incompatible `FOR SHARE` → `FOR UPDATE` en Inventario (`descontarInventarioPorVenta` lee platillos sin re-bloquear y toma `FOR UPDATE` sobre ingredientes), y Catálogo adquiere `FOR UPDATE` sobre platillo antes de mutar recetas (`actualizarPlatillo`). Esto erradica el error PostgreSQL `40P01 / deadlock detected` en ventas concurrentes y modificaciones administrativas. |
| **A2-3-04** | Evidencia pendiente | **En seguimiento / En revisión** | Se creó el script de verificación automatizado `app/backend/src/scripts/verificar-auditoria2-w3.ts` (16/16 comprobaciones aprobadas) que valida A2-3-01, A2-3-02, A2-3-03 y precisión exacta con decimal.js. Se actualizó el contrato público `docs/contratos/03-promociones.md` con su Adenda de integración Auditoría 2. Se mantienen el contraste >= 4.5:1, objetivos táctiles >= 44x44 px y navegación semántica. La aprobación formal de las tareas W3 se mantiene **en revisión** a la espera de las decisiones humanas independientes de los integrantes 2 y 4 y las pruebas físicas en dispositivos móviles. |

### Batería de pruebas automatizadas del Integrante 3 ejecutadas y aprobadas:

1. `node app/backend/dist/scripts/verificar-promociones-w3-02.js` → **44/44 exitosas**
2. `node app/backend/dist/scripts/verificar-calculo-w3-03.js` → **24/24 exitosas**
3. `node app/backend/dist/scripts/verificar-integracion-ventas-w3-05.js` → **19/19 exitosas**
4. `node app/backend/dist/scripts/verificar-promociones-integradas-w3-06.js` → **33/33 exitosas**
5. `node app/backend/dist/scripts/verificar-auditoria1-w3.js` → **42/42 exitosas**
6. `node app/backend/dist/scripts/verificar-auditoria2-w3.js` → **16/16 exitosas**

**Total pruebas Integrante 3: 178/178 aprobadas (0 fallos).**
