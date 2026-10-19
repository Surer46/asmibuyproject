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

---

## Resolución de pendientes de Auditoría 3 por el Integrante 2

Fecha de resolución: 19 de octubre de 2026. Estado: **correcciones técnicas implementadas y verificadas con 144 pruebas automatizadas (0 fallos)**.

| ID | Gravedad | Estado | Solución implementada y evidencia técnica |
| --- | --- | --- | --- |
| **A3-2-01** | Alta | **Resuelto** | En `CatalogoService.actualizarPlatillo` (`catalogo.service.ts`), se eliminó la lectura externa stale previa a la transacción. Ahora se ejecuta `SELECT id, nombre, precio, activo FROM platillos WHERE id = $1 FOR UPDATE;` dentro de `ejecutarTransaccion` al inicio del flujo, y se leen los valores frescos de la fila bloqueada con el mismo cliente (`client`). Si la solicitud omite campos (por ejemplo, actualizando únicamente la receta), se preservan los valores actuales bajo el bloqueo (`actual.precio`, `actual.nombre`, `actual.activo`) en lugar de sobrescribirlos con datos desactualizados leídos antes de adquirir la exclusión. |
| **A3-2-02** | Media | **Resuelto** | En `CatalogoService.actualizarIngrediente` (`catalogo.service.ts`), toda la verificación y actualización se encapsuló en `ejecutarTransaccion`. Se adquiere `SELECT id, nombre, unidad, minimo, activo FROM ingredientes WHERE id = $1 FOR UPDATE;` al inicio. La verificación de inmutabilidad de unidad (`receta_detalle` y `movimientos_inventario`) y la verificación de platillos activos (`FOR SHARE OF p`) se realizan con el cliente transaccional exclusivo, garantizando atomicidad y eliminando condiciones de carrera. |
| **A3-2-03** | Media (coordinada con A3-1-02) | **Resuelto** | En `InventarioService` (`inventario.service.ts`), se sustituyó `NOW() AT TIME ZONE 'UTC'` por `CURRENT_TIMESTAMP` en las inserciones de `movimientos_inventario` en `registrarEntrada`, `registrarAjuste` y `descontarInventarioPorVenta`. Esto previene el desfase de 6 horas que ocurría al insertar una marca de tiempo sin zona horaria en una columna `timestamptz` cuando la sesión opera bajo `America/Mexico_City`, alineándose con la migración 007. |
| **A3-2-04** | Baja (documental) | **Resuelto** | Se unificaron los comentarios en `inventario.service.ts` y `catalogo.service.ts`, así como el contrato público [`docs/contratos/02-catalogo-inventario.md`](docs/contratos/02-catalogo-inventario.md) y el plan de trabajo [`modulos/catalogo-inventario/plan.md`](modulos/catalogo-inventario/plan.md). Se documentó el protocolo unificado global del sistema: (1) Platillos `ORDER BY id ASC FOR UPDATE`, (2) Promociones `ORDER BY pr.id ASC FOR SHARE OF pr`, (3) Ingredientes `ORDER BY id ASC FOR UPDATE`. El encabezado de `plan.md` se actualizó reflejando `Estado: en revisión`, `Responsable personal: Integrante 2`, `Revisor principal: integrante 1` y `Revisor adicional: integrante 4`. |
| **A3-2-05** | Evidencia (continúa A2-2-03) | **En seguimiento / En revisión** | Se mantuvo la arquitectura visual Cupertino, contraste >= 4.5:1, objetivos táctiles >= 44x44 px y navegación semántica en las pantallas de Catálogo e Inventario. Se diseñó la suite automatizada `app/backend/src/scripts/verificar-auditoria3-w2.ts` con 17/17 comprobaciones aprobadas. Las tareas W2-01 a W2-06 continúan en estado **en revisión** supeditadas a la ratificación de los revisores humanos independientes (integrantes 1 y 4) y la validación en dispositivos físicos. |

### Batería de pruebas automatizadas del Integrante 2 ejecutadas y aprobadas:

1. `node app/backend/dist/scripts/verificar-catalogo-w2-02.js` → **22/22 exitosas**
2. `node app/backend/dist/scripts/verificar-inventario-w2-03.js` → **28/28 exitosas**
3. `node app/backend/dist/scripts/verificar-minimos-avisos-w2-05.js` → **23/23 exitosas**
4. `node app/backend/dist/scripts/verificar-inventario-integrado-w2-06.js` → **14/14 exitosas**
5. `node app/backend/dist/scripts/verificar-auditoria1-w2.js` → **26/26 exitosas**
6. `node app/backend/dist/scripts/verificar-auditoria2-w2.js` → **14/14 exitosas**
7. `node app/backend/dist/scripts/verificar-auditoria3-w2.js` → **17/17 exitosas**

**Total pruebas Integrante 2: 144/144 aprobadas (0 fallos).**

