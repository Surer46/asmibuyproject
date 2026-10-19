# Auditoría 3 — Integrante 3: descuentos y promociones

Fecha: 19 de octubre de 2026. Base revisada: `e6e0db5` (commit del integrante 3 del 15-10-2026). Alcance: W3-01 a W3-06, seguimiento de A2-3-01 a A2-3-04 y CW-10/13/14. Revisores humanos: integrante 2 (principal) e integrante 4 (cotización). Revisión técnica: Claude Code como orquestador y en funciones del integrante 4. Seguimiento previo: [W3-Seguimiento-Orquestador-2026-10-19](../../docs/auditorias/W3-Seguimiento-Orquestador-2026-10-19.md). Estado: **en revisión; la lógica funciona en PostgreSQL, pero la evidencia propia no es reproducible**.

## Niveles de evidencia

- **Reportado por el ejecutor:** [W3-Auditoria-2](../../docs/auditorias/W3-Auditoria-2.md): 178/178 comprobaciones, incluida la suite de Auditoría 2 con 16/16.
- **Verificado por el orquestador:** ejecuciones del 19-10-2026 en memoria y con PostgreSQL 18.4 local desechable.
- **Aprobado por revisor humano:** ninguna decisión registrada.

## Correcciones de Auditoría 2 comprobadas

| ID A2 | Reportado | Verificado por el orquestador | Resultado |
| --- | --- | --- | --- |
| A2-3-01 | Huella con `fechaInicio`/`fechaFin`. | PostgreSQL: promoción vigente, cotizar, adelantar `fechaInicio` 1 h y confirmar → `COTIZACION_DESACTUALIZADA` y la nueva cotización **conserva la promoción** con la `fechaInicio` nueva. | Coincide en PostgreSQL |
| A2-3-02 | Hora tomada después de los bloqueos. | PostgreSQL: promoción del 100 % que vence a los 1.5 s; cotización con total 0.00; otra sesión retiene el platillo `FOR UPDATE` 2.5 s; al liberarlo, la confirmación recibe `COTIZACION_DESACTUALIZADA` y no se crea ninguna orden. | Coincide en PostgreSQL |
| A2-3-03 | Protocolo sin escalada SHARE→UPDATE. | Ventas concurrentes cruzadas y venta frente a edición de receta sin 40P01 (ver Auditoría 3 del integrante 2). | Coincide en PostgreSQL |
| A2-3-04 | En seguimiento. | Sin evidencia de navegador ni móviles. | Sigue abierto |
| Regresión | 162/162 en memoria. | Cinco suites anteriores: **162 PASS, 0 FAIL**. | Coincide, solo memoria |
| Suite A2 | 16/16. | `verificar-auditoria2-w3.js` el 19-10-2026: **14/16, código de salida 1**. | No coincide |

## Pendientes para el integrante 3

| ID | Gravedad | Tarea | Evidencia y efecto | Corrección y aceptación requerida |
| --- | --- | --- | --- | --- |
| A3-3-01 | Alta (evidencia) | W3-05/06 | `verificar-auditoria2-w3.ts` usa promociones con ventanas fijas del 15-10-2026, mientras `validarConsistenciaCotizacion` evalúa con la hora real. Fuera de esa ventana fallan «extender fechaFin» y «fechas idénticas». El 16/16 no es reproducible. | Construir las fechas relativas a la ejecución o inyectar un reloj controlado; adjuntar la ejecución repetida otro día. |
| A3-3-02 | Media (falso positivo) | W3-05 | La prueba «modificar fechaInicio» solo exige un 409; hoy pasa porque la promoción ya venció, no porque detecte el cambio. La prueba A2-3-02 provoca el vencimiento editando `fechaFin`, no por paso del tiempo. | Afirmar el motivo (la nueva cotización conserva la promoción y refleja el cambio) y añadir el escenario de vencimiento durante la espera de bloqueos en PostgreSQL, como el que ejecutó el orquestador. |
| A3-3-03 | Media (evidencia) | W3-05/06, CW-06/10 | Las seis suites de W3 solo recorren la rama de memoria; las «pruebas 9 a 12» y la de `clock_timestamp()` inspeccionan el texto del código. El comportamiento en PostgreSQL solo está respaldado por la ejecución del orquestador, no por evidencia del autor. | Incorporar una batería con `TEST_DATABASE_URL` (base `asmibuy_test_*`) que ejecute vencimiento durante la espera, cambio de vigencia y concurrencia, sin imprimir credenciales. |
| A3-3-04 | Baja | W3-03/05 | La cotización sin bloqueo usa el reloj de Node y la confirmación el de PostgreSQL (`clock_timestamp()`). Un desfase entre servidores puede rechazar o aceptar promociones justo en los límites. | Documentar en el contrato que la hora de referencia al confirmar es la de la base y que los servidores se sincronizan por NTP, o usar el mismo reloj en ambas rutas. |
| A3-3-05 | Evidencia (continúa A2-3-04) | W3-04/06, CW-17/18 | Sin capturas ni versiones del formulario en Chrome Android, Safari iPhone y navegador de PC. | Registrar el recorrido real y solicitar la decisión humana de los integrantes 2 y 4. |

## Límites

La verificación en PostgreSQL fue local y desechable, no en Supabase. La revisión del integrante 4 la preparó un agente de IA y requiere ratificación humana. No se modificó código del integrante 3.
