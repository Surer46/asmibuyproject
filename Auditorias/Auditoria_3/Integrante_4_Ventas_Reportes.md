# Auditoría 3 — Integrante 4: punto de venta e historial

Fecha: 19 de octubre de 2026. Base revisada: `e6e0db5`. Alcance: W4-01 a W4-06, seguimiento de A2-4-01 a A2-4-07, CW-05 a CW-07 y CW-14 a CW-19. Revisores humanos: integrante 3 (principal), adicionales 2 (consumo) y 1 (acceso). Estado: **correcciones técnicas aplicadas; en revisión humana**.

**Conflicto de funciones declarado:** el usuario asignó a Claude Code las funciones del integrante 4 y del orquestador. Este mismo agente detectó y corrigió los hallazgos A3-4-xx, por lo que esta auditoría no es independiente. La revisión del integrante 3 (y de 2 y 1 en sus áreas) es obligatoria antes de cerrar.

## Correcciones de Auditoría 2 comprobadas

| ID A2 | Verificado en PostgreSQL 18.4 desechable (19-10-2026) | Resultado |
| --- | --- | --- |
| A2-4-01 a A2-4-06 | `verificar-auditoria2-w4.js` repetido: **47/47** (14 ventas por encima del pool, dos cajas, 12 envíos con la misma clave, cambio de receta, rollback, periodo con zona horaria). | Se reproduce |
| A2-4-02/04 | Escenarios adicionales: última unidad con dos cajas (1 éxito, saldo 0), ventas cruzadas con ingrediente compartido (sin 40P01) y venta frente a edición de receta (coherente). | Se reproduce |
| A2-4-07 | Sin Chrome Android, Safari iPhone ni decisiones humanas. Playwright no está instalado en esta máquina: no se repitió la prueba Edge de recuperación. | Sigue abierto |

## Hallazgos del tercer ciclo

| ID | Gravedad | Tarea | Evidencia y efecto | Corrección y aceptación requerida |
| --- | --- | --- | --- | --- |
| A3-4-01 | Alta | W4-04/05, CW-15/16 | Con `DATABASE_URL` configurada, `listarHistorial` y `obtenerPorId` atrapaban cualquier error de PostgreSQL y recurrían al almacén en memoria. Reproducción con un fallo inyectado en la consulta de órdenes: el historial respondía con éxito, **0 órdenes y total 0.00**, y el detalle respondía `ORDEN_NO_ENCONTRADA` (404). Un fallo de base se mostraba como un periodo sin ventas. | Propagar el error en modo PostgreSQL; no responder datos de memoria. |
| A3-4-02 | Media | W4-03, CW-07/19 | La clave de idempotencia no se validaba en formato ni longitud; la columna es `VARCHAR(100)`. Una clave de 150 caracteres producía el error PostgreSQL **22001** sin controlar (500); la interfaz lo clasifica como incierto y bloquea la caja de forma indefinida. | Validar en servidor de 1 a 100 caracteres `[A-Za-z0-9_-]` y rechazar con `DATOS_INVALIDOS` (400) antes de consultar o escribir; también en `/ventas/recuperar`. |
| A3-4-03 | Media (defensa en profundidad) | W4-03/05, CW-02 | Las rutas usaban `usuario?.id \|\| 1` y perfiles por defecto (`'ADMINISTRADOR'` en anulación). Si una identidad llegara incompleta, la operación se atribuiría al usuario 1 o al perfil supuesto. | Tomar usuario y perfil solo de la sesión validada; sin identidad válida, responder 401. |
| A3-4-04 | Baja (rendimiento) | W4-04 | El historial hacía una consulta de partidas por orden (N+1). En Supabase Free con un pool de 10, un periodo largo multiplica los viajes a la base. | Una sola consulta `orden_id = ANY($1)` agrupada en memoria. |
| A3-4-05 | Evidencia (continúa A2-4-07) | W4-06, CW-17/19 | Faltan Chrome Android y Safari iPhone físicos, integración con Supabase y decisiones humanas de 3, 2 y 1. | Registrar las pruebas reales y las decisiones fechadas; no cerrar W4-06 antes. |

---

## Resolución de pendientes de Auditoría 3 por el integrante 4

Fecha de resolución: 19 de octubre de 2026. Ejecutor: Claude Code en funciones del integrante 4. Estado: **correcciones técnicas implementadas y verificadas; en revisión de 3, 2 y 1**. Detalle y comandos en [docs/auditorias/W4-Auditoria-3.md](../../docs/auditorias/W4-Auditoria-3.md).

| ID | Estado | Solución y evidencia |
| --- | --- | --- |
| **A3-4-01** | **Corregido técnicamente** | `ventas.service.ts`: se eliminaron los `try/catch` con recurso a memoria en `obtenerPorId` y `listarHistorial` cuando `DATABASE_URL` está configurada. Con un fallo inyectado, historial, detalle y anulación propagan el error (57P01) y la orden sigue `CONFIRMADA`. |
| **A3-4-02** | **Corregido técnicamente** | `VentasService.normalizarClaveIdempotencia` (1–100 caracteres `[A-Za-z0-9_-]`, recorta espacios externos) se aplica en `confirmarVenta` y en `GET /ventas/recuperar/:clave`. Claves de 101 y 150 caracteres, con espacios o vacías → `DATOS_INVALIDOS` 400 sin escrituras; una clave de 100 caracteres confirma y su reenvío con espacios recupera la misma orden. La interfaz ya trata `DATOS_INVALIDOS` como rechazo definitivo; los UUID del navegador (36) no cambian. |
| **A3-4-03** | **Corregido técnicamente** | `ventas.routes.ts`: helper `usuarioDeSesion` sin valores por defecto; una sesión sin id o con un perfil desconocido → 401 `NO_AUTENTICADO`, sin crear venta. |
| **A3-4-04** | **Corregido técnicamente** | Partidas del historial con una sola consulta `ANY($1)`; las partidas de cada orden son idénticas a las de la consulta individual y el trabajador solo recibe las suyas. |
| **A3-4-05** | **Abierto** | Requiere dispositivos físicos, Supabase y revisores humanos. |

Verificación: `verificar-auditoria3-w4.js` **18/18** y `verificar-auditoria2-w4.js` **47/47** en PostgreSQL 18.4 desechable; regresión en memoria W4 **137/137** (36+15+21+28+37) más **87/87** de integración W3/W2 (19+42+26); `npm run build:backend` y `npm run build:frontend` sin errores; `git diff --check` limpio. No constituye aprobación humana.
