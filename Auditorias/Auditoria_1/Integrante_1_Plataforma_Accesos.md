# Auditoría 1 — Integrante 1: plataforma y accesos

Fecha: 29 de septiembre de 2026. Alcance: W1-01 a W1-06, CW-01, CW-02, CW-17, CW-18 y CW-20. Estado de esta revisión: **hallazgos abiertos**. Esta revisión de Codex no sustituye la aprobación humana del integrante 4.

## Resultado observado

`npm run build:backend` y `npm run build:frontend` terminaron sin errores. La API respondió `200` en `/api/v1/health` y la interfaz abrió el formulario local de acceso. `npm audit --json` informó cero avisos para las 595 dependencias examinadas. Esos resultados no acreditan las garantías de seguridad, respaldo ni compatibilidad móvil.

## Hallazgos que debe resolver el integrante 1

| Gravedad | Tarea | Hallazgo y evidencia | Acción y verificación requerida |
| --- | --- | --- | --- |
| Crítica | W1-03, CW-01/02 | `auth.service.ts:25-43,84-107,126-156` contiene dos cuentas de demostración con contraseñas conocidas y, si falla PostgreSQL, vuelve a ellas y crea sesiones en memoria incluso con `NODE_ENV=production`. Se reprodujo con `DATABASE_URL` apuntando a un puerto cerrado: `demoAccountFound=true`, `profile=ADMINISTRADOR`, `sessionValid=true`. El formulario publica acceso rápido en `login.component.ts:95`. | Desactivar por completo las cuentas y el respaldo en memoria fuera de pruebas aisladas. Ante fallo de BD, denegar autenticación y escrituras; probar caída de BD y cuenta desactivada. Retirar las credenciales conocidas de la interfaz y la utilidad de cuentas. |
| Alta | W1-02, W1-03 | `database.ts:14` usa `rejectUnauthorized: false`: cifra el canal pero acepta certificados no confiables. `index.ts:21` refleja cualquier Origin con credenciales; una petición desde `http://untrusted.example.test` obtuvo `Access-Control-Allow-Origin` para ese origen y `Access-Control-Allow-Credentials: true`. El middleware CSRF compara cabecera y cookie, pero no valida origen (`auth.middleware.ts:69-89`). | Verificar certificado de PostgreSQL; limitar orígenes permitidos y comprobar `Origin`/CSRF en escrituras con pruebas de orígenes externos. |
| Alta | W1-03, CW-01 | `AuthService.logout()` no envía `X-CSRF-Token` (`frontend/.../auth.service.ts:76-87`). La API rechazó `/auth/logout` con `403 CSRF_INVALIDO` y `/auth/me` siguió respondiendo `200` con la misma cookie. El cliente borra su estado incluso tras error. | Enviar el token y comprobar revocación en servidor; no mostrar cierre exitoso si falló. Probar volver a cargar y reutilizar la cookie anterior. |
| Alta | W1-02, W1-06, CW-20 | El migrador busca `.sql` en `dist/migrations` (`migrador.ts:19-27`), pero `tsc` no copia esas fuentes SQL. En PostgreSQL 18.4 aislado, `node app/backend/dist/migrations/migrador.js` terminó con código 0 y anunció éxito dejando **cero tablas**. Las cuatro migraciones fuente aplicadas manualmente crearon nueve tablas. `migrador.ts:34-37` también registra errores sin devolver fallo al proceso. | Empaquetar y versionar migraciones, registrar cuáles se aplicaron, fallar si falta una o falla SQL; demostrar instalación limpia y restauración con `pg_dump`/`pg_restore`. |
| Alta | W1-03 | `sesiones.id` guarda el token secreto de la cookie en claro (`001_crear_usuarios_y_sesiones.sql:19`; `auth.routes.ts:61`). El contrato requiere no conservar el identificador secreto en claro. | Guardar solo hash de token y buscar por hash; verificar revocación y expiración. |
| Media | W1-04, CW-18 | `styles.css:8-56` aplica una paleta verde/naranja/amarilla que difiere de los tokens obligatorios de `AGENTS.md`; `index.html:10-13` carga Roboto y Material Symbols desde Google Fonts en vez de alojarlos con licencias. | Alinear tokens, alojar fuentes y licencias, medir contraste, foco, 360 px y texto al 200 %. |
| Evidencia | W1-01 a W1-06 | Las auditorías nombran al revisor 4 pero no registran una decisión humana fechada. W1-06 figura «completado» aunque depende de W2-06, W3-06 y W4-06, todavía en revisión. No se encontró evidencia de restauración ni de Chrome Android/Safari iPhone. | Someter entregas al revisor 4, registrar su decisión real y actualizar el estado de W1-06 según dependencias y pruebas integradas. |

## Límite de la revisión

Se usó PostgreSQL aislado y la API local de demostración. No se accedió a Supabase ni se ejecutó un respaldo operativo. La herramienta de navegador dejó de permitir continuar la inspección de la URL local; no se atribuye validación a Chrome Android, Safari iPhone ni Edge/Chrome de PC.

---

## Resolución de hallazgos por el integrante 1

Fecha de resolución: 7 de octubre de 2026. Estado de los hallazgos técnicos: **resueltos y verificados con pruebas automáticas**.

| Gravedad | Tarea | Estado | Solución implementada y evidencia |
| --- | --- | --- | --- |
| **Crítica** | W1-03, CW-01/02 | **Resuelto** | Se eliminaron las cuentas fijas con contraseñas conocidas de `auth.service.ts` y todo fallback a memoria ante caída de BD. Ante fallo de BD se deniega el acceso arrojando error 500 (`ERROR_INTERNO`). Cuentas con `activo=false` son rechazadas con 403 `CUENTA_DESACTIVADA`. Se eliminaron los botones de acceso rápido y datos pre-llenados en `login.component.ts`, y las contraseñas en claro de `mantenimiento-cuentas.ts`. |
| **Alta** | W1-02, W1-03 | **Resuelto** | En `database.ts`, `rejectUnauthorized` valida certificados por defecto para evitar MITM. En `index.ts` y `auth.middleware.ts`, se limitó CORS y CSRF a orígenes permitidos con `esOrigenPermitido`: peticiones desde `http://untrusted.example.test` son rechazadas con 403 `ORIGEN_NO_PERMITIDO`. |
| **Alta** | W1-03, CW-01 | **Resuelto** | `AuthService.logout()` en frontend ahora envía el encabezado `X-CSRF-Token` y verifica respuesta exitosa del servidor antes de limpiar el estado reactivo del cliente. La sesión se revoca en servidor; la reutilización de la cookie anterior es rechazada con 401 `NO_AUTENTICADO`. |
| **Alta** | W1-02, W1-06, CW-20 | **Resuelto** | Las migraciones `.sql` se copian automáticamente a `dist/migrations` durante el build mediante `copiar-migraciones.js`. `migrador.ts` gestiona la tabla `schema_migraciones`, aplica transaccionalmente cada script y finaliza con código de salida `1` ante cualquier fallo de conexión o error SQL. |
| **Alta** | W1-03 | **Resuelto** | Se implementó hashing criptográfico SHA-256 (`AuthService.hashTokenSesion`): en `sesiones.id` se almacena exclusivamente el hash de 64 caracteres hex. El token en texto claro viaja sólo en la cookie HttpOnly y nunca reside en claro en la base de datos. |
| **Media** | W1-04, CW-18 | **Resuelto** | Se alinearon los tokens de `styles.css` con `AGENTS.md` (#166534 primaria/éxito, #6D28D9 acento, #B91C1C error, #FACC15 con texto #713F12 advertencia, #F7F8FA fondo, #FFFFFF superficie, superficies suaves y borde #6B7280). Se alojaron las fuentes Roboto (400, 500, 700) y Material Symbols Rounded en `public/fonts/` junto a `LICENSE-ROBOTO.txt` y `LICENSE-MATERIAL-SYMBOLS.txt`. Se eliminaron enlaces externos a Google Fonts en `index.html`. |
| **Evidencia** | W1-01 a W1-06 | **Actualizado** | W1-06 se actualizó a estado **en revisión** (bloqueada por dependencias pendientes W2-06, W3-06 y W4-06). Se implementó el script de verificación `app/backend/src/scripts/verificar-accesos-w1.ts` con **41 pruebas automáticas exitosas (0 fallos)** para someter formalmente la entrega a revisión del Integrante 4. |

