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

---

## Resolución de pendientes de Auditoría 3 por el Integrante 3

Fecha de resolución: 19 de octubre de 2026. Estado: **correcciones técnicas implementadas y verificadas en memoria (178/178) y en PostgreSQL 18.4 local desechable (18/18), total 196/196 pruebas automatizadas exitosas (0 fallos); en revisión humana de los integrantes 2 y 4**. Detalle completo y comandos reproducibles en [docs/auditorias/W3-Auditoria-3.md](../../docs/auditorias/W3-Auditoria-3.md).

| ID | Gravedad | Estado | Solución implementada y evidencia técnica |
| --- | --- | --- | --- |
| **A3-3-01** | Alta (evidencia) | **Resuelto** | 1. En `app/backend/src/scripts/verificar-auditoria2-w3.ts`, se reemplazaron todas las fechas fijas del `15-10-2026` por ventanas relativas al instante de ejecución (`Date.now() ± N horas`).<br>2. En `PromocionesService.validarConsistenciaCotizacion` (`promociones.service.ts`), se añadió el parámetro opcional `fechaReferencia?: Date` para pruebas con reloj controlado sin bloqueo.<br>3. Se ajustó la inspección del bloqueo de `CatalogoService` en la prueba 12 para contemplar `SELECT id, nombre, precio, activo FROM platillos WHERE id = $1 FOR UPDATE;` (actualizado en `A3-2-01`).<br>4. Se ejecutó `verificar-auditoria2-w3.js` el `19-10-2026` (**16/16 PASS**) y se repitió simulando otra fecha (`2026-11-25T15:30:00.000Z`, **16/16 PASS**), además de probar +12 días en memoria y +20 días en PostgreSQL. |
| **A3-3-02** | Media (falso positivo) | **Resuelto** | 1. En la prueba «modificar `fechaInicio`» (`verificar-auditoria2-w3.ts` y `verificar-auditoria3-w3.ts`), se afirma explícitamente el motivo del rechazo HTTP 409 (`COTIZACION_DESACTUALIZADA`): se comprueba que `err.detalles.nuevaCotizacion.promocionAplicada` **no es nulo**, conserva la misma promoción vigente (`id`), mantiene intactos el ahorro y el total (`$192.00` / `$48.00`), y refleja la nueva `fechaInicio`.<br>2. En la prueba `A2-3-02` de `verificar-auditoria2-w3.ts`, se eliminó la edición de `fechaFin` y se reemplazó por una ventana de 200 ms reales que vence por paso natural del tiempo (espera de 320 ms) con `fechaFin` inalterada.<br>3. En `verificar-auditoria3-w3.ts` (sección 2), se incorporó y ejecutó en PostgreSQL 18.4 el escenario real de espera de bloqueos: promoción del 100 % que vence en `1.5 s`, cotización a `$0.00`, otra sesión retiene `SELECT id FROM platillos WHERE id = $1 FOR UPDATE` durante `2.3 s`; al liberar, `confirmarVenta` evalúa `clock_timestamp()` post-bloqueos, rechaza con `COTIZACION_DESACTUALIZADA` (409, `promocionAplicada: null`, total `$120.00`) y **no crea ninguna orden**. |
| **A3-3-03** | Media (evidencia) | **Resuelto** | Se creó la batería `app/backend/src/scripts/verificar-auditoria3-w3.ts` que exige `TEST_DATABASE_URL` apuntando exclusivamente a una base local desechable `asmibuy_test_*` (rechaza `DATABASE_URL` operativa y no imprime credenciales ni cadenas de conexión). Ejecutada sobre PostgreSQL **18.4** (`asmibuy_test_w3_a3`), aprobó **18/18** comprobaciones: aplicación de las 7 migraciones reales, `TimeZone=UTC`, cambio de `fechaInicio` y `fechaFin` conservando promoción, vencimiento durante espera de bloqueo `FOR UPDATE`, 6 ventas concurrentes cruzadas con desempate `CW-13` sin `40P01`, venta concurrente frente a edición de promoción sin `40P01`, conservación de marcas `TIMESTAMPTZ` bajo `America/Mexico_City` (desfase 0.001 s) y liberación completa del pool (`idleCount === totalCount`). |
| **A3-3-04** | Baja | **Resuelto** | 1. En `PromocionesService.cotizarOrden` (`promociones.service.ts`), cuando `DATABASE_URL` está configurada, tanto la cotización sin bloqueo (cuando no se fuerza una `fechaEvaluacion` fija de prueba) como la revalidación con bloqueo (`bloquearParaConfirmacion = true`) consultan `SELECT clock_timestamp() AS ahora` en PostgreSQL, utilizando el mismo reloj en ambas rutas.<br>2. En [`docs/contratos/03-promociones.md`](../../docs/contratos/03-promociones.md) se añadió la **Adenda de integración — Auditoría 3**, documentando que la hora de referencia al confirmar es `clock_timestamp()` de la base de datos en UTC y que los servidores se sincronizan mediante **NTP**. |
| **A3-3-05** | Evidencia (continúa A2-3-04) | **En seguimiento / En revisión** | El frontend Angular compila limpiamente (`npm run build:frontend`, bundle inicial `449.82 kB`). Conforme a `AGENTS.md`, no se atribuyen pruebas en dispositivos físicos no disponibles en este entorno (Chrome Android y Safari iPhone) ni se inventan aprobaciones humanas. Se solicita formalmente la revisión y decisión humana de los **Integrantes 2 y 4** sobre [W3-Auditoria-3](../../docs/auditorias/W3-Auditoria-3.md). |

### Batería de pruebas automatizadas del Integrante 3 ejecutadas y aprobadas (19-10-2026)

1. `node app/backend/dist/scripts/verificar-auditoria3-w3.js` (PostgreSQL 18.4 local `asmibuy_test_w3_a3`) → **18/18 exitosas**
2. `node app/backend/dist/scripts/verificar-auditoria2-w3.js` (ejecución `19-10-2026` y repetición en fecha simulada `25-11-2026`) → **16/16 exitosas**
3. `node app/backend/dist/scripts/verificar-promociones-w3-02.js` → **32/32 exitosas**
4. `node app/backend/dist/scripts/verificar-calculo-w3-03.js` → **36/36 exitosas**
5. `node app/backend/dist/scripts/verificar-integracion-ventas-w3-05.js` → **19/19 exitosas**
6. `node app/backend/dist/scripts/verificar-promociones-integradas-w3-06.js` → **33/33 exitosas**
7. `node app/backend/dist/scripts/verificar-auditoria1-w3.js` → **42/42 exitosas**

**Total pruebas Integrante 3: 196/196 aprobadas (18 en PostgreSQL 18.4 + 178 en memoria, 0 fallos).**
