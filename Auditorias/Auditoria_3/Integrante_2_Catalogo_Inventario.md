# Auditoría 3 — Integrante 2: catálogo e inventario

Fecha: 19 de octubre de 2026. Base revisada: `e6e0db5`. Alcance: W2-01 a W2-06, seguimiento de A2-2-01 a A2-2-03, CW-03 a CW-06 y CW-08/09. Revisores humanos: integrante 1 (principal) e integrante 4 (consumo). Revisión técnica: Claude Code como orquestador y en funciones del integrante 4. Estado: **en revisión; requiere correcciones de concurrencia y marcas de tiempo**.

## Niveles de evidencia

- **Reportado por el ejecutor:** resolución de Auditoría 2 del 15-10-2026 (127 comprobaciones, 0 fallos).
- **Verificado por el orquestador:** ejecuciones del 19-10-2026 con PostgreSQL 18.4 local desechable y Node.js v26.10.0.
- **Aprobado por revisor humano:** ninguna decisión registrada.

## Correcciones de Auditoría 2 comprobadas

| ID A2 | Verificado por el orquestador en PostgreSQL | Resultado |
| --- | --- | --- |
| A2-2-01 | Seis ventas concurrentes de dos platillos con un ingrediente compartido, con el orden de partidas invertido entre cajas: **0 fallos**, sin 40P01; saldo compartido **99691.750**, igual al esperado. Dos cajas por la última unidad: 1 éxito, 1 `STOCK_INSUFICIENTE`, saldo **0.000**. | Coincide |
| A2-2-02 | Venta y edición de receta simultáneas: la edición se aplica, la venta recibe `COTIZACION_DESACTUALIZADA` y no quedan escrituras incoherentes. | Coincide |
| A2-2-03 | Sin evidencia de navegador real ni de móviles. | Sigue abierto |
| Regresión | `verificar-catalogo-w2-02` 22, `verificar-inventario-w2-03` 28, `verificar-minimos-avisos-w2-05` 23, `verificar-inventario-integrado-w2-06` 14, `verificar-auditoria1-w2` 26, `verificar-auditoria2-w2` 14: **127 PASS, 0 FAIL**, todas en memoria. | Coincide, solo memoria |

## Pendientes para el integrante 2

| ID | Gravedad | Tarea | Evidencia y efecto | Corrección y aceptación requerida |
| --- | --- | --- | --- | --- |
| A3-2-01 | Alta | W2-02, CW-14/15 | `CatalogoService.actualizarPlatillo` lee el platillo **fuera** de la transacción y antes del `FOR UPDATE`, y después reescribe nombre, precio y activo con esos valores. Reproducción en PostgreSQL: con el platillo bloqueado, se envían «precio 10→20» y luego «solo receta»; al liberar, el precio final es **10.00**: la edición de precio se pierde sin error. | Leer los valores actuales con el mismo cliente después de `SELECT … FOR UPDATE` y actualizar solo los campos recibidos. Repetir la reproducción: precio final 20.00 y receta nueva. |
| A3-2-02 | Media | W2-02, CW-03 | `actualizarIngrediente` comprueba «unidad inmutable» y «en uso por platillos activos» con `pool.query` y luego actualiza en otra sentencia, sin transacción ni bloqueo. Una alta de receta o un movimiento concurrente puede dejar un ingrediente inactivo en una receta activa o cambiar su unidad con referencias. Revisión de código; no se forzó la carrera. | Hacer comprobación y actualización en una transacción, bloqueando el ingrediente (`FOR UPDATE`) y las filas relacionadas en el orden acordado; probar la carrera en PostgreSQL. |
| A3-2-03 | Media, coordinada con A3-1-02 | W2-03, CW-04 | `registrarEntrada`, `registrarAjuste` y `descontarInventarioPorVenta` insertan `NOW() AT TIME ZONE 'UTC'` en una columna `timestamptz`. Con la sesión en `America/Mexico_City` el instante se desplaza **6 h** (comprobado). Latente en Supabase (UTC), pero afecta el historial de movimientos y su orden si cambia la zona de la sesión. | Usar `now()` (o el valor por defecto corregido en la migración de A3-1-02) y probar con una sesión en otra zona. |
| A3-2-04 | Baja, documental | W2-03, contratos | Los comentarios de `inventario.service.ts`/`catalogo.service.ts` y la resolución A2-2-01 dicen que la venta tiene `FOR SHARE` sobre platillos; el código vigente (`promociones.service.ts`) aplica `FOR UPDATE`. El encabezado de `modulos/catalogo-inventario/plan.md` dice «Estado: pendiente. Responsable: por asignar», contradictorio con tareas en revisión. | Unificar el protocolo en comentarios y en `docs/contratos/02-*`: platillos `FOR UPDATE` ascendente, promociones `FOR SHARE OF pr`, ingredientes `FOR UPDATE` ascendente. Corregir el encabezado del plan. |
| A3-2-05 | Evidencia (continúa A2-2-03) | W2-04/05/06, CW-17/18 | Sin capturas ni versiones de Chrome Android, Safari iPhone ni de navegador de PC para gestión y Avisos. | Registrar el recorrido real y solicitar la decisión humana de los integrantes 1 y 4. |

## Límites

Las conclusiones de PostgreSQL son de una base local desechable, no de Supabase. A3-2-02 es un hallazgo de revisión de código. La revisión del integrante 4 la preparó un agente de IA y requiere ratificación humana. No se modificó código del integrante 2.
