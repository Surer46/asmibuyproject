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
