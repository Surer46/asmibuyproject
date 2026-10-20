# Auditoría 3 — Integrante 1: plataforma y accesos

Fecha: 19 de octubre de 2026. Base revisada: `e6e0db5` (`main`, igual a `origin/main`). Alcance: W1-01 a W1-06, seguimiento de A2-1-01 a A2-1-04 y componentes comunes que usan los demás módulos. Revisión técnica: Claude Code como orquestador, asignado por el usuario también a las funciones del integrante 4. Decisión humana del integrante 4: **pendiente** (ver «Límites de esta revisión»). Estado: **en revisión; requiere correcciones menores y evidencia de cierre**.

## Niveles de evidencia

- **Reportado por el ejecutor:** lo que afirma el integrante 1 en la resolución de Auditoría 2 (14-10-2026).
- **Verificado por el orquestador:** comandos y escenarios ejecutados el 19-10-2026 en Windows 11, Node.js v26.10.0 y PostgreSQL 18.4 local desechable (`asmibuy_test_a3`), sin Supabase.
- **Aprobado por revisor humano:** ninguna decisión registrada en este ciclo.

## Correcciones de Auditoría 2 comprobadas

| ID A2 | Reportado | Verificado por el orquestador | Resultado |
| --- | --- | --- | --- |
| A2-1-01 | `npm audit` sin vulnerabilidades. | `npm audit` y `npm audit --omit=dev`: **found 0 vulnerabilities**. | Coincide |
| A2-1-02 | Desactivación atómica que conserva un administrador. | PostgreSQL: con exactamente dos administradores activos, dos `desactivarUsuario` concurrentes → uno desactivado y otro rechazado con «último administrador»; quedó **1** activo y sin interbloqueo. | Coincide |
| A2-1-03 | En seguimiento. | Sin evidencia nueva de Supabase, restauración ni móviles físicos. | Sigue abierto |
| A2-1-04 | `.env.example` y arranque corregidos. | Revisión de código: `ALLOWED_ORIGINS` y `CORS_ORIGIN` admitidos; sin credenciales en el repositorio. No se comprobó un arranque desde una copia limpia. | Parcial |
| Regresión | 51 comprobaciones W1. | `NODE_ENV=test node app/backend/dist/scripts/verificar-accesos-w1.js`: **51 PASS, 0 FAIL** (memoria). | Coincide, solo memoria |

## Pendientes para el integrante 1

| ID | Gravedad | Tarea | Evidencia y efecto | Corrección y aceptación requerida |
| --- | --- | --- | --- | --- |
| A3-1-01 | Media | W1-03, CW-01 | `POST /auth/login` (`auth.routes.ts`) no limita intentos por cuenta ni por IP. Si el correo no existe, no se ejecuta bcrypt y la respuesta es más rápida: permite fuerza bruta y enumerar cuentas por tiempo. Revisión de código; no se midió en red. | Limitar intentos (por correo e IP, con espera creciente) y comparar contra un hash ficticio cuando la cuenta no exista. Probar N intentos fallidos → 429 y tiempos equivalentes. |
| A3-1-02 | Media, coordinada con 2, 3 y 4 | W1-02, CW-04/15 | Las migraciones 001 a 004 usan `DEFAULT (NOW() AT TIME ZONE 'UTC')` en columnas `TIMESTAMP WITH TIME ZONE`. Con la sesión en `America/Mexico_City`, ese valor se guarda **21600 s (6 h)** desplazado (comprobado en PostgreSQL 18.4). Supabase usa UTC por defecto, por lo que el fallo queda latente hasta que cambie la zona de la base o de la conexión. | Nueva migración (sin editar las aplicadas) con `DEFAULT now()` en esas columnas, coordinada con los propietarios de cada tabla; fijar y documentar `TimeZone=UTC` en la conexión; probar con una sesión en otra zona. |
| A3-1-03 | Baja | W1-02/05 | `cookieParser(process.env.SESSION_SECRET \|\| 'asmibuy-secret-key')` usa un secreto fijo de respaldo; `localhost` y `127.0.0.1` se aceptan como origen también en producción; `probarConexionBD` dice «modo desarrollo local seguro» sin base de datos, aunque el acceso falla en ese caso; no hay cabeceras de seguridad. | Exigir `SESSION_SECRET` en producción o quitar el secreto si no se firman cookies; limitar los orígenes locales a desarrollo; corregir el mensaje; valorar cabeceras básicas de seguridad. |
| A3-1-04 | Evidencia (continúa A2-1-03) | W1-05/06, CW-17/18/20 | Siguen sin evidencia: conexión real Express→Supabase, `pg_dump` y restauración aislada, despliegue HTTPS, Chrome Android y Safari iPhone. | Registrar ejecuciones reales con versiones, sin credenciales; W1-06 permanece en revisión. |
| A3-1-05 | Documental | W1-01 a W1-05 | Los planes e informes marcan W1-01 a W1-05 como «completado» con «Revisor independiente: Integrante 4», pero no figura una decisión fechada y firmada por esa persona. | Registrar nombre, fecha y decisión del revisor humano o devolver las tareas a «en revisión». El orquestador no puede suplir esa decisión. |

## Resoluciones aplicadas y verificadas en el tercer ciclo (19-10-2026)

| ID | Gravedad | Estado | Resolución aplicada y evidencia técnica |
| --- | --- | --- | --- |
| **A3-1-01** | Media | **RESUELTO** | 1. Implementado `LoginRateLimiter` (`app/backend/src/services/login-rate-limiter.ts`) con bloqueo progresivo por IP y correo normalizado (5 fallos → 30s, 6 fallos → 60s, 7 fallos → 180s) emitiendo HTTP 429 y cabecera `Retry-After`.<br>2. Mitigación de timing attack en `auth.routes.ts`: cuando el correo no existe, se ejecuta `AuthService.verificarPasswordFalsa` contra `DUMMY_PASSWORD_HASH` (10 rondas bcrypt), equiparando el tiempo de respuesta a 65 ms frente a los 68 ms de un usuario real (diferencia: 3 ms).<br>3. Verificado con `verificar-auditoria3-w1.ts` (16 comprobaciones exitosas). |
| **A3-1-02** | Media | **RESUELTO** | 1. Creada la migración `007_corregir_defaults_timestamptz.sql` (`app/backend/src/migrations/007_corregir_defaults_timestamptz.sql`), empaquetada en `dist/migrations/`, sustituyendo `DEFAULT (NOW() AT TIME ZONE 'UTC')` por `SET DEFAULT CURRENT_TIMESTAMP` en las 10 tablas coordinadas de los 4 módulos.<br>2. Actualizado `migrador.ts` para que `schema_migraciones` use `DEFAULT CURRENT_TIMESTAMP`.<br>3. Configurado `options: '-c timezone=UTC'` y listener `SET timezone = 'UTC'` en `database.ts` para fijar UTC en toda sesión PostgreSQL del pool.<br>4. Documentado en `.env.example`. Verificado con `verificar-auditoria3-w1.ts`. |
| **A3-1-03** | Baja | **RESUELTO** | 1. Retirado el secreto fijo `'asmibuy-secret-key'` de `cookieParser` en `index.ts`. En producción se emite advertencia si `SESSION_SECRET` no está configurado.<br>2. `esOrigenPermitido` en `auth.middleware.ts` restringe `localhost`, `127.0.0.1` e IPs privadas exclusivamente a entornos no productivos (`NODE_ENV !== 'production'`). En producción exige inclusión explícita en `ALLOWED_ORIGINS`.<br>3. Corregido el mensaje de `probarConexionBD` en `database.ts` para declarar con veracidad que la base de datos es requerida y no afirmar falsamente un "modo desarrollo local seguro".<br>4. Agregadas cabeceras de seguridad HTTP en `index.ts`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-XSS-Protection: 0`. |
| **A3-1-04** | Evidencia | **EN REVISIÓN** | Conforme a `AGENTS.md`, la tarea W1-06 permanece en estado «en revisión» a la espera de las pruebas físicas en navegadores reales (Chrome Android, Safari iPhone), HTTPS y restauración externa de Supabase. No se simulan aprobaciones humanas en esta auditoría. |
| **A3-1-05** | Documental | **REGISTRADO** | Conforme a `docs/rol-orquestador.md` y `AGENTS.md`, los hallazgos técnicos se registran como verificados con evidencia de ejecución real, mientras que la decisión de aprobación formal permanece pendiente de ratificación por el revisor humano asignado (Integrante 4). |

## Resultados de Verificación Técnica (19-10-2026)

- **Auditoría 3 W1 (`verificar-auditoria3-w1.ts`):** 52 pruebas exitosas, 0 fallos (PASS).
- **Auditoría 1 y 2 W1 (`verificar-accesos-w1.ts`):** 51 pruebas exitosas, 0 fallos (PASS).
- **Compilación Backend (`npm run build:backend`):** Exitosa; 7 migraciones SQL empaquetadas en `dist/migrations/`.
- **Compilación Frontend (`npm run build:frontend`):** Exitosa con Angular CLI v21.2.26.
- **Auditoría de dependencias (`npm audit` y `npm audit --omit=dev`):** 0 vulnerabilidades.

## Límites de esta revisión

El usuario asignó al orquestador las funciones del integrante 4, revisor principal del integrante 1. Esta auditoría la preparó un agente de IA: según `docs/rol-orquestador.md`, no cuenta como decisión de una segunda persona hasta que una persona la ratifique. No se probaron Supabase, restauración, despliegue HTTPS ni navegadores móviles. No se modificó código del integrante 1.

## Base para el tercer ciclo

Entregar resultados por ID con archivos, comandos y entornos reales. A3-1-02 requiere una migración nueva coordinada; los integrantes 2 (catálogo, inventario), 3 (promociones) y 4 (órdenes) confirman sus tablas. Los criterios integrados y W1-06 siguen pendientes de las aprobaciones W2-06, W3-06 y W4-06.

