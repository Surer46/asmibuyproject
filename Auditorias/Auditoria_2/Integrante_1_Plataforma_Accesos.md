# Auditoría 2 — Integrante 1: plataforma y accesos

Fecha: 13 de octubre de 2026. Base revisada: `3ee207e` más los cambios locales preexistentes de Ventas. Alcance: W1-01 a W1-06 y seguimiento de Auditoría 1. Revisión técnica: Codex por encargo del usuario. Decisión humana del integrante 4: pendiente. Estado: **requiere correcciones y evidencia de cierre**.

## Correcciones confirmadas

Se retiraron las cuentas fijas de demostración y el respaldo silencioso de autenticación. El token de sesión se guarda mediante SHA-256. En la API local conectada a PostgreSQL 18.4 aislado, login devolvió 200, el token en claro no existió en `sesiones.id`, logout con CSRF devolvió 200 y reutilizar la cookie devolvió 401. Desactivar una cuenta causó 401 en la siguiente solicitud. Una escritura desde un origen externo y una escritura administrativa de trabajador devolvieron 403.

El migrador aplicó las seis migraciones a una base vacía, creó `schema_migraciones` y las omitió correctamente en la segunda ejecución. Backend y frontend compilaron sin errores. Las 41 comprobaciones existentes de W1 pasaron; sus simulaciones no equivalen a todas las pruebas anteriores sobre PostgreSQL.

Los tokens visuales generales, fuentes locales y licencias fueron incorporados. W1-06 ahora conserva estado en revisión y reconoce dependencias pendientes.

## Pendientes para el integrante 1

| ID | Gravedad | Tarea | Evidencia y efecto | Corrección y aceptación requerida |
| --- | --- | --- | --- | --- |
| A2-1-01 | Seguridad: crítica/alta según aviso del proveedor | W1-01/05 | `npm audit --json` terminó con código 1: seis entradas, dos críticas y cuatro altas. Están en la cadena de herramientas de Angular/desarrollo. `npm audit --omit=dev --json` informó cero avisos de producción. Versiones instaladas: `@angular/build` y `@angular/cli` 21.2.24, Piscina 5.2.0, MCP SDK 1.30.0, http-cache-semantics 4.2.0 y source-map-js 1.2.1. | Actualizar las dependencias compatibles y el lockfile, verificar instalación limpia y builds, y volver a auditar. No se probó explotación ni se atribuye ejecución remota al servidor Express por estos avisos. |
| A2-1-02 | Alta | W1-03 | `app/backend/src/scripts/mantenimiento-cuentas.ts:40-52` permite desactivar cualquier cuenta mediante un UPDATE directo. Sobre la base aislada, desactivar al único administrador terminó con código 0 y dejó **0 administradores activos**, contrario a spec.md. | Impedir de manera atómica desactivar al último administrador; probar dos desactivaciones concurrentes. Incorporar el restablecimiento de contraseña requerido por la utilidad de mantenimiento. |
| A2-1-03 | Evidencia pendiente | W1-05/06, CW-17/18/20 | No se encontró evidencia nueva de restauración de respaldo de Supabase, conexión externa verificada ni pruebas físicas de Chrome Android y Safari iPhone. Un build no demuestra contraste, foco o texto al 200 %. | Coordinar los cierres de módulos, probar instalación/HTTPS, conexión externa y restauración aislada, y registrar versiones, capturas y decisión humana real. Mantener los criterios pendientes hasta disponer de esa evidencia. |

## Avisos de dependencias comprobados

El aviso de [Piscina](https://github.com/advisories/GHSA-67c8-pqhq-4rmx) afecta su versión instalada y requiere condiciones adicionales de contaminación de prototipos. Los otros avisos corresponden al [MCP TypeScript SDK](https://github.com/advisories/GHSA-6qxp-vccf-f47h), [http-cache-semantics](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) y [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). Las seis entradas de npm incluyen los paquetes directos afectados por estas dependencias; no son seis vulnerabilidades independientes de la aplicación.

## Evidencia y límites

Comandos ejecutados: `npm run build:backend`, `npm run build:frontend`, `node app/backend/dist/scripts/verificar-accesos-w1.js`, `npm audit --json`, `npm audit --omit=dev --json`, y dos ejecuciones del migrador compilado contra una base PostgreSQL vacía y aislada. También se probaron rutas HTTP locales y la utilidad de desactivación sobre datos desechables.

La segunda auditoría completa ejecutó 16 scripts existentes con 453 comprobaciones exitosas, además de escenarios PostgreSQL y HTTP independientes. No se probaron Supabase, restauración ni navegadores móviles reales. Esta revisión no modifica código, planes, casillas ni aprobaciones de las tareas W.
