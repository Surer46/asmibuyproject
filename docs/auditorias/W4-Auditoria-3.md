# Tercer ciclo — Ventas e historial

ID W: W4-03 a W4-06. Prioridades P0/P1. Estado: en revisión. Fecha: 19-10-2026.
Responsable: integrante 4; ejecución técnica: Claude Code, asignado por el usuario a las funciones del integrante 4. Revisor principal: integrante 3; adicionales: 2 (consumo) y 1 (acceso). Sin decisión humana registrada.

## Resultado y dependencias

Atender A3-4-01 a A3-4-04 de `Auditorias/Auditoria_3/Integrante_4_Ventas_Reportes.md`. Alcance: errores de PostgreSQL sin recurso a memoria, validación de la clave de idempotencia, identidad de sesión sin valores por defecto e historial sin consultas N+1. Solo se tocaron archivos del módulo 4; no cambian contratos con los integrantes 2 y 3 ni migraciones.

Archivos: `app/backend/src/services/ventas.service.ts`, `app/backend/src/routes/ventas.routes.ts` y la nueva batería `app/backend/src/scripts/verificar-auditoria3-w4.ts`.

## Comprobaciones realizadas

Entorno: Windows 11 Pro, Node.js v26.10.0, PostgreSQL **18.4** local desechable (paquete `embedded-postgres` en el directorio temporal del agente, fuera del repositorio), base `asmibuy_test_a3`. Sin Supabase.

| Área | Evidencia real | Resultado |
| --- | --- | --- |
| Estructura | `npm run build:backend`, `npm run build:frontend`, `git diff --check` | Sin errores; seis migraciones empaquetadas; ninguna migración modificada. |
| Datos y errores (A3-4-01) | `verificar-auditoria3-w4.js`, fallo inyectado en la consulta de órdenes | Historial, detalle y anulación propagan el error; la orden sigue CONFIRMADA. Antes: historial 200 con 0 órdenes y detalle 404. |
| Idempotencia (A3-4-02) | Misma batería | Claves de 101/150 caracteres, con espacios o vacías → DATOS_INVALIDOS 400 sin escrituras; 100 caracteres confirma; reenvío con espacios externos recupera la misma orden; `/ventas/recuperar` con clave inválida → 400. |
| Acceso (A3-4-03) | Router de Ventas montado en Express con identidad incompleta | Sesión sin id → 401 sin venta; consulta sin id → 401. Recuperación propia con clave válida → misma orden. |
| Historial (A3-4-04) | Cuatro órdenes de dos partidas | Partidas del historial agrupado idénticas a la consulta individual; el trabajador solo ve las suyas; pool sin clientes retenidos. |
| Regresión PostgreSQL | `verificar-auditoria2-w4.js` | **47/47**. |
| Regresión memoria | Cinco scripts W4 y tres de integración | **137/137** y **87/87**. |
| Navegador | No ejecutado | Playwright no está disponible en esta máquina; el componente Angular no cambió. Chrome Android y Safari iPhone siguen pendientes. |

**Total ejecutado en este ciclo:** 18 (PostgreSQL, nuevas) + 47 (PostgreSQL, regresión) + 137 + 87 (memoria). No es aprobación humana.

### Ejecución reproducible

```powershell
npm run build:backend
npm run build:frontend

# TEST_DATABASE_URL apunta a una base LOCAL asmibuy_test_*; nunca a Supabase ni a datos operativos.
$env:DATABASE_URL = ''
node app/backend/dist/scripts/verificar-auditoria3-w4.js
node app/backend/dist/scripts/verificar-auditoria2-w4.js

# Regresión en memoria, sin DATABASE_URL:
node app/backend/dist/scripts/verificar-ventas-w4-03.js
node app/backend/dist/scripts/verificar-historial-w4-04.js
node app/backend/dist/scripts/verificar-anulacion-w4-05.js
node app/backend/dist/scripts/verificar-recorrido-venta-w4-06.js
node app/backend/dist/scripts/verificar-auditoria1-w4.js
```

La batería ejecuta el migrador y crea fixtures con correos `@pruebas.invalid`; no hace TRUNCATE ni DROP y no imprime conexiones.

## Hallazgos y revisión

- A3-4-01 a A3-4-04 están corregidos técnicamente; A3-4-05 (móviles físicos, Supabase y decisiones humanas) sigue abierto.
- Autor y auditor de este ciclo son el mismo agente: la revisión del integrante 3 es indispensable. Se solicita además al integrante 1 que confirme el manejo de sesión (A3-4-03) y al integrante 2 que la propagación de errores no afecte a Avisos.
- Solicitud de revisión: integrantes 3, 2 y 1, con fecha y decisión en este documento.

## Cierre

Estado: **en revisión**. No se cierran W4-03 a W4-06 mientras falten la revisión humana y las pruebas en Chrome Android, Safari iPhone y Supabase.
