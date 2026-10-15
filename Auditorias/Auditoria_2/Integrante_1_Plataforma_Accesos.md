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

## Complemento de arranque — A2-1-04

Gravedad: media. Tarea: W1-05. En el diagnóstico local del 13 de octubre, Angular y Express respondieron 200, pero PostgreSQL figuró desconectado y no existía `.env` en la raíz ni en `app/backend`. La ausencia de credenciales locales exige configuración por el responsable; no deben añadirse al repositorio.

`iniciar-asmibuy.bat` todavía anuncia cuentas de demostración retiradas y una IP fija. `app/backend/.env.example` promete almacenamiento seguro en memoria cuando falta la conexión y utiliza `CORS_ORIGIN`, mientras el código consulta `ALLOWED_ORIGINS`. Corregir esos mensajes e instrucciones, documentar configuración privada, migraciones y creación de cuentas, y comprobar el arranque desde una copia limpia con PostgreSQL. Este pendiente es adicional a A2-1-01 a A2-1-03.

## Base para el segundo ciclo

La entrega de Ventas examinada quedó registrada íntegra en el commit `bc318f00983b1df2d9b435c82e47a68d253ec5da`, para que los cuatro integrantes puedan reproducir la misma base. El integrante 1 atiende A2-1-01 a A2-1-04 y coordina configuración, app/ y compartido/. Los acuerdos de bloqueos y receta de integrantes 2, 3 y 4 deben reflejarse en los contratos públicos antes de integrar cambios.

Entregar resultados por ID con archivos, comandos, entornos reales y pendientes. Mantener revisión humana y criterios integrados pendientes mientras falte su evidencia. La publicación prepara el ciclo de correcciones; los fallos técnicos registrados siguen abiertos.

---

## Resolución de pendientes de Auditoría 2 por el Integrante 1

Fecha de resolución: 14 de octubre de 2026. Estado: **correcciones técnicas implementadas y verificadas con 51 pruebas automatizadas**.

| ID | Gravedad | Estado | Solución implementada y evidencia técnica |
| --- | --- | --- | --- |
| **A2-1-01** | Seguridad (devDep) | **Resuelto** | Se actualizaron `@angular/build` y `@angular/cli` a `21.2.26`. Se configuraron `overrides` en `package.json` para `piscina` (^5.3.2), `@modelcontextprotocol/sdk` (^1.31.0), `http-cache-semantics` (4.3.0) y `source-map-js` (1.2.2). Se ejecutó `npm audit fix`. Resultado actual: **`found 0 vulnerabilities`** tanto en `npm audit` como en `npm audit --omit=dev`. Compilaciones limpias en frontend y backend. |
| **A2-1-02** | Alta | **Resuelto** | Se implementó `AuthService.desactivarUsuario(id)` de forma atómica: en PostgreSQL bloquea con `SELECT ... FOR UPDATE` a los administradores activos y verifica que `count > 1` antes de proceder; si es el último administrador activo, aborta la transacción con error y no modifica el registro. Además revoca atómicamente todas las sesiones del usuario desactivado. Se incorporó `AuthService.restablecerPassword(id, nuevaClave)` con hash bcrypt y revocación de sesiones previas. `mantenimiento-cuentas.ts` soporta `desactivar`, `activar` y `password <id> <nueva_contraseña>`. Probado con éxito en la batería automatizada. |
| **A2-1-03** | Evidencia | **En seguimiento** | Se mantienen pendientes los criterios físicos en dispositivos móviles (Chrome Android, Safari iPhone) y la restauración de respaldo de Supabase en base aislada, supeditados a la integración final del equipo. |
| **A2-1-04** | Media | **Resuelto** | Se actualizó `iniciar-asmibuy.bat` eliminando la IP fija (sustituida por instrucción dinámica con `ipconfig`) y retirando las credenciales de prueba obsoletas. Se corrigió `app/backend/.env.example` y se creó `.env.example` en la raíz eliminando promesas falsas de memoria, documentando la obligatoriedad de PostgreSQL, y configurando `ALLOWED_ORIGINS` junto con soporte para `CORS_ORIGIN`. `auth.middleware.ts` ahora admite ambos nombres como alias. |

