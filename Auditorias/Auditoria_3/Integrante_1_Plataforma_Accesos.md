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

## Límites de esta revisión

El usuario asignó al orquestador las funciones del integrante 4, revisor principal del integrante 1. Esta auditoría la preparó un agente de IA: según `docs/rol-orquestador.md`, no cuenta como decisión de una segunda persona hasta que una persona la ratifique. No se probaron Supabase, restauración, despliegue HTTPS ni navegadores móviles. No se modificó código del integrante 1.

## Base para el tercer ciclo

Entregar resultados por ID con archivos, comandos y entornos reales. A3-1-02 requiere una migración nueva coordinada; los integrantes 2 (catálogo, inventario), 3 (promociones) y 4 (órdenes) confirman sus tablas. Los criterios integrados y W1-06 siguen pendientes de las aprobaciones W2-06, W3-06 y W4-06.
