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
