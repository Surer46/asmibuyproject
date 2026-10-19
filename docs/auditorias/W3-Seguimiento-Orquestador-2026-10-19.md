# Seguimiento del orquestador — Promociones, segundo ciclo

ID W: W3-01 a W3-06 (hallazgos A2-3-01 a A2-3-04). Prioridades P0/P1. Estado: en revisión.
Autor de la entrega: Integrante 3. Revisor principal: Integrante 2. Revisores adicionales: Integrante 4 (cotización) e Integrante 1 (acceso). Versión revisada: `e6e0db5b80e7b931482c2327b9e8299e0b3dca66` en `main`.
Redacta: orquestador (Claude Code), 19-10-2026. Este documento no es una revisión humana ni aprueba ninguna tarea.

## Resultado y dependencias

Contrastar lo reportado en [W3-Auditoria-2](W3-Auditoria-2.md) y en [Auditoría 2 del integrante 3](../../Auditorias/Auditoria_2/Integrante_3_Promociones.md) con lo que se pudo verificar de forma independiente. Criterios relacionados: CW-06, CW-10, CW-13 y CW-14. Archivos afectados: `app/backend/src/services/promociones.service.ts`, `app/frontend/src/app/services/promociones.service.ts`, `docs/contratos/03-promociones.md` y `app/backend/src/scripts/verificar-auditoria2-w3.ts`.

Bloqueo de entorno: el equipo del orquestador no tiene PostgreSQL, Docker ni WSL, y `TEST_DATABASE_URL` no está definida. No fue posible ejecutar ninguna comprobación contra una base `asmibuy_test_*`.

## Niveles de evidencia

| Nivel | Significado |
| --- | --- |
| Reportado por el ejecutor | Lo que afirma el integrante 3 en sus documentos; no lo repitió el orquestador. |
| Verificado por el orquestador | Lo ejecutó o inspeccionó el orquestador el 19-10-2026 con los comandos indicados. |
| Aprobado por revisor humano | Ninguna decisión humana registrada a la fecha. |

## Comprobaciones realizadas

Entorno: Windows 11 Pro, Node.js v26.10.0, sin `DATABASE_URL` ni `.env` (los servicios usan `almacenMemoria`).

| Área | Reportado por el ejecutor | Verificado por el orquestador | Resultado |
| --- | --- | --- | --- |
| Compilación | Backend y frontend compilan; bundle 449.82 kB. | `npm run build:backend` y `npm run build:frontend` sobre `e6e0db5`: código de salida 0, 6 migraciones empaquetadas, bundle inicial 449.82 kB. | Coincide |
| Suites W3 de regresión | 162/162 en memoria. | `verificar-promociones-w3-02` 32, `verificar-calculo-w3-03` 36, `verificar-integracion-ventas-w3-05` 19, `verificar-promociones-integradas-w3-06` 33, `verificar-auditoria1-w3` 42: 162 PASS, 0 FAIL. Todas usan `almacenMemoria`. | Coincide, solo en memoria |
| Suite Auditoría 2 | 16/16 aprobadas. | `node app/backend/dist/scripts/verificar-auditoria2-w3.js`: **14/16, 2 fallos, código de salida 1**. Ver O3-01. | No coincide |
| PostgreSQL real | Protocolo de bloqueos y `clock_timestamp()` verificados (pruebas 9 a 12). | Las pruebas 9 a 12 y la de `clock_timestamp()` son inspección de texto del código fuente (`fs.readFileSync`), no ejecución. Ninguna de las seis suites abre conexión a PostgreSQL. | No acreditado |
| Navegador y dispositivos | Pendiente (A2-3-04). | No se probó. | Pendiente |

### Qué casos recorren realmente PostgreSQL

Ninguno. En `cotizarOrden` la rama `if (process.env.DATABASE_URL)` contiene los bloqueos `FOR UPDATE` sobre platillos, `FOR SHARE OF pr` sobre promociones y la consulta `SELECT clock_timestamp()`. Las seis suites recorren solo la rama de memoria, que usa `new Date()` y no bloquea. Por tanto A2-3-02 (hora posterior a los bloqueos) y A2-3-03 (protocolo sin interbloqueos 40P01) solo están respaldados por inspección de código.

## Hallazgos del orquestador

| ID | Gravedad | Hallazgo | Acción sugerida al integrante 3 |
| --- | --- | --- | --- |
| O3-01 | Alta (evidencia) | `verificar-auditoria2-w3.ts` depende de la fecha real. Las promociones de prueba usan ventanas fijas del 15-10-2026 (por ejemplo 10:00–18:00 UTC), pero `validarConsistenciaCotizacion` evalúa con la hora actual. El 19-10-2026 fallan «extender fechaFin» y «fechas idénticas»; la suite solo pasa si se ejecuta dentro de esa ventana. El resultado 16/16 no es reproducible. | Construir las ventanas relativas a la hora de ejecución o inyectar un reloj controlado en la prueba. |
| O3-02 | Media (falso positivo) | La prueba «modificar fechaInicio» solo exige un 409. Hoy pasa porque la promoción ya venció, no porque detecte el cambio de `fechaInicio`; no comprueba el motivo del rechazo. | Afirmar que la nueva cotización conserva la promoción y refleja la nueva `fechaInicio`. |
| O3-03 | Media (cobertura) | La prueba A2-3-02 provoca el «vencimiento» editando `fechaFin`, lo que ya cambia la huella. No reproduce una promoción que vence sin edición mientras la transacción espera bloqueos, que es el caso del hallazgo. | Prueba en PostgreSQL aislado: una transacción retiene el bloqueo del platillo, la promoción vence por tiempo y la confirmación concurrente recibe `COTIZACION_DESACTUALIZADA`. |
| O3-04 | Alta (evidencia) | A2-3-02 y A2-3-03 declarados «resueltos técnicamente» sin ejecución en PostgreSQL. | Ejecutar en una base `asmibuy_test_*` con `TEST_DATABASE_URL` las ventas concurrentes sobre el mismo platillo, la edición de receta y promoción concurrente y el vencimiento durante la espera; registrar versión de PostgreSQL y resultados sin credenciales. |
| O3-05 | Baja (coherencia, compartido con 2) | Los comentarios de `inventario.service.ts` (A2-2-01) y la resolución A2-2-01 dicen que la venta tiene `FOR SHARE` sobre platillos, pero `promociones.service.ts` aplica `FOR UPDATE`. El comportamiento no escala de SHARE a UPDATE, pero la documentación de los integrantes 2 y 4 no describe el mismo protocolo. | Unificar en el contrato y en los comentarios el protocolo vigente: platillos `FOR UPDATE` ascendente, promociones `FOR SHARE OF pr`, ingredientes `FOR UPDATE` ascendente. |

## Hallazgos y revisión

- Ninguna decisión humana registrada por los integrantes 2, 4 ni 1 para este ciclo.
- Lo verificado por el orquestador confirma la compilación y las 162 comprobaciones de regresión en memoria; no confirma el 16/16 de la suite de Auditoría 2 ni ningún comportamiento de PostgreSQL, Supabase o navegador.
- Las pruebas en memoria no acreditan bloqueos, concurrencia ni la hora del servidor de base de datos.

## Cierre

Estado: **en revisión**. A2-3-01 está implementado en el código (DTO, huella, contrato y frontend incluyen `fechaInicio`/`fechaFin`), pero su prueba no es reproducible (O3-01, O3-02). A2-3-02 y A2-3-03 siguen sin evidencia en PostgreSQL (O3-03, O3-04). A2-3-04 sigue pendiente de navegadores físicos y revisión humana. Siguiente paso: que el integrante 3 corrija O3-01 y O3-02 y que alguien con PostgreSQL local ejecute O3-04; después, decisión del integrante 2 y del integrante 4.
