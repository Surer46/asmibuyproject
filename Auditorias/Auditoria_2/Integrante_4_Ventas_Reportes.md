# Auditoría 2 — Integrante 4: punto de venta e historial

Fecha: 13 de octubre de 2026. Base revisada: `3ee207e` más cambios locales preexistentes de Ventas, incluida la migración 006 y `verificar-auditoria1-w4.ts`. Alcance: W4-01 a W4-06, CW-05 a CW-07 y CW-14 a CW-19. Revisores humanos: integrante 3, adicionales 2 y 1. Estado: **requiere correcciones antes de validar la aplicación integrada**.

## Correcciones confirmadas

En la API conectada a PostgreSQL aislado, recuperar una venta ajena devolvió 403. La discrepancia de cantidades entre carrito y cotización fue rechazada con `DISCREPANCIA_CARRITO_COTIZACION`. Cambiar el método de pago al reintentar la clave dio `IDEMPOTENCIA_CONFLICTO`. Dos anulaciones concurrentes devolvieron el primer motivo y conservaron el stock. La migración 006 se aplicó mediante el migrador y añade datos históricos y FK de movimientos a órdenes.

Los componentes Angular de Venta e Historial tienen ahora implementación. Frontend y backend compilaron. Los cinco scripts W4 pasaron **137/137** comprobaciones de memoria. Existe la auditoría W4-06, pero la ejecución de scripts de servicios no verifica el comportamiento del componente del navegador.

## Pendientes para el integrante 4

| ID | Gravedad | Tarea | Evidencia y efecto | Corrección y aceptación requerida |
| --- | --- | --- | --- | --- |
| A2-4-01 | Crítica | W4-03, CW-07/19 | En la rama PostgreSQL de `confirmarVenta`, el cliente solo se libera en `catch` (`ventas.service.ts:300-538`). En éxito no hay `finally`. Nueve ventas consecutivas retuvieron nueve conexiones; la décima terminó con **timeout exceeded when trying to connect**, aunque había hecho COMMIT. La BD conservó **10 órdenes**, y el solicitante recibió error en la décima. | Liberar siempre el cliente con `finally` y construir la respuesta sin depender de otra conexión después del commit. Repetir más ventas que el tamaño del pool y verificar que el conteo de conexiones ociosas se recupera y cada resultado coincide con lo persistido. |
| A2-4-02 | Alta, compartida con 2 y 3 | W4-03, CW-06/07 | La revalidación toma SHARE y el consumo convierte a UPDATE sobre el mismo platillo. Dos ventas concurrentes con stock suficiente produjeron un éxito y **40P01 / deadlock detected**. La captura añadida para 23505 no resuelve esta carrera. | Acordar el protocolo único de bloqueos, eliminar conversiones incompatibles y comprobar dos cajas, misma clave y claves distintas en PostgreSQL. |
| A2-4-03 | Alta | W4-02/03, CW-07/19 | Inspección del componente: `confirmarVenta` borra la clave pendiente en **todo error**, incluido fallo de red (`venta.component.ts:1281-1284`). La clave se guarda en `sessionStorage` común a todos los usuarios (`:1346`), mientras una recarga crea un UUID nuevo (`:1098`) y no lo restaura como clave activa. Recuperación borra el pendiente aun si no encontró la orden (`:1376`); también se permite descartarlo sin resolver su resultado (`:1394-1396`). Esto deja sin identidad recuperable una venta con respuesta incierta y permite otra operación. | Conservar clave y solicitud pendientes por usuario hasta obtener resultado definitivo. Reutilizar esa identidad al consultar/reintentar; bloquear una venta nueva mientras la anterior sea incierta. Probar respuesta perdida después de COMMIT, recarga, navegación, cierre de sesión y cambio de usuario en navegador real. |
| A2-4-04 | Alta, compartida con 2 | W4-03, CW-14/15 | Cotizar receta con consumo 1, editar a 2 y confirmar el resumen antiguo todavía produjo `CONFIRMADA` y movimiento **-2.000**. Tener una lectura dentro de BEGIN no detecta por sí mismo el cambio respecto del resumen aceptado. | Incorporar y verificar identidad/versionado de receta en la cotización; requerir nueva aceptación y asegurar coincidencia entre snapshot y movimientos. |
| A2-4-05 | Alta: exposición de credenciales | W4-06 | `app/backend/src/scripts/verificar-auditoria1-w4.ts:448` imprime `process.env.DATABASE_URL` completa cuando está configurada. Una URL PostgreSQL normalmente incluye credenciales. No se ejecutó esa rama con credenciales operativas en esta auditoría. | Mostrar solo modalidad de entorno y redactar secretos. Separar una base de pruebas obligatoria de la configuración operativa y evitar adjuntar conexiones a logs/auditorías. |
| A2-4-06 | Media, pendiente de Auditoría 1 | W4-04 | `parsearRangoFechas` convierte fechas cortas a medianoche/final del día **UTC** (`ventas.service.ts:204-231`), sin zona del negocio. Para un negocio en America/Mexico_City, por ejemplo, una venta de 19:30 local pertenece al día UTC siguiente y queda fuera del filtro del día local. | Configurar la zona del negocio y convertir límites del periodo al servidor; rechazar fechas inválidas y probar horas cercanas a medianoche. |
| A2-4-07 | Evidencia/documentación | W4-06 | La resolución de Auditoría 1 afirma recuperación en `localStorage`, pero el código usa `sessionStorage` y elimina el pendiente ante errores. El plan marca Chrome Android/Safari iPhone verificados aunque W4-06 los reconoce pendientes. Tampoco hay decisión humana registrada. | Ajustar afirmaciones y casillas mediante el proceso del equipo, adjuntar pruebas reales de respuesta incierta y navegadores, y solicitar revisión humana de 3, 2 y 1. |

## Reproducción principal de conexiones

En un proceso de prueba nuevo, con el pool normal de máximo 10 y stock suficiente, cotizar un platillo y confirmar diez claves distintas secuencialmente. Después de cada éxito se observó `pool.totalCount` creciente y una sola conexión ociosa: 2/1, 3/1, hasta 10/1. En la décima confirmación falló la consulta de nombre de cajero que ocurre después del COMMIT (`ventas.service.ts:472-475`). Una consulta posterior contó diez órdenes persistidas. La prueba finalizó el proceso aislado para no conservar las conexiones retenidas.

## Límites

Se ejecutaron pruebas PostgreSQL 18.4 y HTTP locales contra datos desechables. La recuperación en el navegador se auditó por código, sin atribuirle una prueba visual ejecutada. No se probaron Supabase, Chrome Android, Safari iPhone ni restauración. La revisión global ejecutó 453 comprobaciones existentes exitosas; los fallos aquí descritos surgieron de escenarios adicionales. No se modificó código, planes ni casillas del ejecutor.

## Complemento: informe del ejecutor del primer ciclo

El usuario aportó el informe de ejecución del integrante 4 fechado el 12 de octubre de 2026. Se conserva como evidencia declarada de autoría y alcance del primer ciclo. El informe identifica los mismos archivos de Ventas y confirma que sus 137 comprobaciones se ejecutaron en memoria aislada. No aporta una ejecución adicional sobre PostgreSQL ni una decisión humana de aprobación.

La comparación con el código y la segunda auditoría conserva estas discrepancias:

- El informe afirma liberación de cliente mediante `finally`; la rama PostgreSQL solo libera en `catch`, origen de A2-4-01.
- Afirma detectar cambios de receta; la reproducción PostgreSQL siguió aceptando la receta modificada, A2-4-04.
- Describe recuperación en `localStorage`; el componente usa `sessionStorage` y elimina el pendiente ante errores, A2-4-03 y A2-4-07.
- Describe cierre de periodo completo; la normalización implementada usa UTC y aún requiere la zona del negocio, A2-4-06.

Las compilaciones y las comprobaciones de memoria ya están incluidas en el resultado anterior. El complemento no aumenta el número de pruebas verificadas ni cierra los hallazgos de la segunda auditoría.

## Base para el segundo ciclo

La entrega del primer ciclo examinada quedó registrada íntegra en el commit `bc318f00983b1df2d9b435c82e47a68d253ec5da`. El integrante 4 atiende A2-4-01 a A2-4-07. Coordinar A2-4-02 con A2-2-01 y A2-3-03, y A2-4-04 con A2-2-02. Los cambios de contratos y de archivos compartidos requieren coordinación con sus propietarios.

Entregar resultados por ID con archivos, comandos, PostgreSQL aislado para concurrencia/rollback y pruebas reales de recuperación en navegador. Los revisores humanos 3, 2 y 1 conservan sus decisiones. La publicación prepara el ciclo de correcciones; los fallos técnicos registrados siguen abiertos.

---

## Resolución de pendientes de Auditoría 2 por el Integrante 4

Fecha de resolución: 15 de octubre de 2026. Estado: **correcciones técnicas implementadas y verificadas (en revisión de revisores independientes 3, 2 y 1)**.

Se conservan intactos los hallazgos y reproducciones originales anteriores. La entrega técnica completa, comandos y solicitudes de revisión se detallan en [docs/auditorias/W4-Auditoria-2.md](../../docs/auditorias/W4-Auditoria-2.md).

| ID | Gravedad | Estado | Solución implementada y evidencia técnica |
| --- | --- | --- | --- |
| **A2-4-01** | Crítica | **Resuelto** | Se aseguró la liberación estricta del cliente PostgreSQL mediante bloque `finally { client.release(); }` en `VentasService.confirmarVenta` (`ventas.service.ts`). Además, la consulta de nombre del usuario cajero se ejecuta antes del `COMMIT` utilizando el mismo cliente transaccional, eliminando la necesidad de solicitar una conexión adicional del pool tras el commit. Verificado en PostgreSQL 18.4 aislado con 14 ventas consecutivas (superando el pool máximo de 10): el pool recupera todas las conexiones ociosas (`pool.idleCount === pool.totalCount`, `pool.waitingCount === 0`) y cada respuesta coincide exactamente con lo persistido. |
| **A2-4-02** | Alta (compartida con 2 y 3) | **Resuelto** | Se eliminó la conversión incompatible SHARE→UPDATE sobre platillos mediante el protocolo acordado: la revalidación transaccional (`PromocionesService.validarConsistenciaCotizacion`) adquiere `FOR UPDATE` ordenado por ID ascendente en platillos desde el inicio; la serialización de confirmaciones concurrentes se garantiza mediante `SELECT pg_advisory_xact_lock(hashtextextended($1, 4))` sobre la clave de idempotencia antes de tomar bloqueos de negocio. Verificado en PostgreSQL: dos cajas sobre el mismo platillo con claves distintas logran dos confirmaciones sin deadlocks (40P01), y 12 envíos concurrentes de la misma clave generan una sola orden sin agotar el pool. |
| **A2-4-03** | Alta | **Resuelto** | Se refactorizó la gestión de transacciones en vuelo en `VentaComponent` (`venta.component.ts`): la clave y la copia inmutable de la solicitud aceptada (`ConfirmarVentaInput`) se persisten por usuario en `localStorage` (`asmibuy_venta_pendiente:<usuarioId>`). Los errores de red, respuestas inciertas o fallos de servidor preservan la clave y solicitud, bloqueando el inicio de una nueva venta (`operacionBloqueada()`). Se eliminó el botón o flujo de descarte arbitrario; la orden solo se limpia tras confirmación fehaciente en el servidor o rechazo definitivo. Se implementó restauración automática tras recarga/navegación y aislamiento estricto por usuario en inicio/cierre de sesión. Verificado en Microsoft Edge real (15/15 pruebas automatizadas con intercepción de red tras COMMIT y abortos previos). |
| **A2-4-04** | Alta (compartida con 2) | **Resuelto** | Se incorporó `recetaHuella` canónica a cada partida de cotización (`PromocionesService`), representando la validez y los insumos ordenados con cantidades decimales normalizadas. La revalidación dentro de `confirmarVenta` recalcula y contrasta esta huella: si la receta fue editada en Catálogo (ej. consumo 1 a 2), la cotización previa es rechazada con `COTIZACION_DESACTUALIZADA` (409) sin escrituras ni consumos erróneos, exigiendo reaceptar el nuevo resumen. La nueva cotización aceptada genera un snapshot de receta de 2 y movimiento de -2.000. Probado en PostgreSQL 18.4. |
| **A2-4-05** | Alta (exposición de credenciales) | **Resuelto** | Se eliminó la impresión de `DATABASE_URL` y variables de conexión en `verificar-auditoria1-w4.ts`. Dicha suite se restringió estrictamente al modo de memoria aislado y aborta inmediatamente si detecta `DATABASE_URL`. Las pruebas con PostgreSQL real se aislaron en `verificar-auditoria2-w4.ts` requiriendo obligatoriamente `TEST_DATABASE_URL` local dedicada (`asmibuy_test_*`), redactando secretos y sin volcar credenciales ni objetos `pg` a logs ni auditorías. |
| **A2-4-06** | Media | **Resuelto** | Se implementó el servicio `periodo-ventas.ts` con la función `normalizarPeriodo`, configurado para utilizar la zona horaria del negocio `BUSINESS_TIME_ZONE` (predeterminada `America/Mexico_City`). Las fechas cortas `YYYY-MM-DD` se convierten a límites del día local (inicio inclusivo y fin exclusivo al inicio del día siguiente en UTC). Se validan estrictamente formatos, se rechazan fechas imposibles (ej. 2026-02-30) y rangos invertidos con `PERIODO_INVALIDO` (400). Verificado en PostgreSQL con ventas a las 19:30 local y límites de microsegundos incluidos. |
| **A2-4-07** | Evidencia/documentación | **En seguimiento / En revisión** | Se rectificó el informe histórico de Auditoría 1 aclarando que sus afirmaciones no constituían aprobación vigente. Se actualizaron los planes y reportes de auditoría W4-02 a W4-06 manteniendo las casillas abiertas para revisión independiente humana. Se generó el informe de segundo ciclo `docs/auditorias/W4-Auditoria-2.md` con evidencia real en navegador Edge (15/15) y PostgreSQL 18.4 (47/47). Las decisiones humanas de los integrantes 3, 2 y 1 se mantienen en estado `en revisión` conforme a las reglas del proyecto, sin atribuir aprobaciones no concedidas ni pruebas en dispositivos móviles físicos no realizadas. |

### Batería de pruebas automatizadas del Integrante 4 ejecutadas y aprobadas:

1. `node app/backend/dist/scripts/verificar-ventas-w4-03.js` → **36/36 exitosas**
2. `node app/backend/dist/scripts/verificar-historial-w4-04.js` → **15/15 exitosas**
3. `node app/backend/dist/scripts/verificar-anulacion-w4-05.js` → **21/21 exitosas**
4. `node app/backend/dist/scripts/verificar-recorrido-venta-w4-06.js` → **28/28 exitosas**
5. `node app/backend/dist/scripts/verificar-auditoria1-w4.js` → **37/37 exitosas**
6. `node app/backend/dist/scripts/verificar-integracion-ventas-w3-05.js` → **19/19 exitosas**
7. `node app/backend/dist/scripts/verificar-auditoria1-w3.js` → **42/42 exitosas**
8. `node app/backend/dist/scripts/verificar-auditoria1-w2.js` → **26/26 exitosas**
9. `node app/backend/dist/scripts/verificar-auditoria2-w2.js` → **14/14 exitosas**
10. `node app/backend/dist/scripts/verificar-auditoria2-w4.js` → **47/47 comprobaciones en PostgreSQL 18.4 aislado**
11. `node app/frontend/scripts/verificar-recuperacion-a2-w4.cjs` → **15/15 pruebas de recuperación en Microsoft Edge 155 real**

**Total reportado por el ejecutor: 300 comprobaciones exitosas (238 en memoria/inspección de código, 47 en PostgreSQL aislado y 15 en Edge), según las cifras enumeradas. No representa aprobación humana independiente. Frontend y backend compilan limpiamente.**
