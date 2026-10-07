# Plan del integrante 1

## Base web y acceso

Versión 2.1. Estado: completado. Responsable personal: Integrante 1. Revisor principal: integrante 4.

Entorno, aplicación web común, API, acceso con perfiles fijos, diseño compartido, despliegue y recuperación.

Leer [spec](../../spec.md), [reglas generales](../../AGENTS.md), [reglas locales](AGENTS.md), [arquitectura](../../docs/arquitectura-tecnica.md) y [matriz](../../docs/matriz-aceptacion.md). Usar [frontend](frontend/README.md) y [backend](backend/README.md). P0 y P1 son obligatorios; ejecutar por dependencias.

| ID | Prioridad | Tarea | Dependencias |
| --- | --- | --- | --- |
| W1-01 | P0 | Fijar entorno y contratos comunes | Sin prerrequisito; coordinar contratos |
| W1-02 | P0 | Crear la base ejecutable | W1-01 |
| W1-03 | P0 | Implementar acceso sencillo | W1-02 |
| W1-04 | P0 | Entregar navegación y diseño web | W1-02 |
| W1-05 | P1 | Preparar instalación y verificación | W1-03, W1-04 |
| W1-06 | P1 | Verificar entrega y recuperación | W1-05, W2-06, W3-06, W4-06 (en revisión) |

## W1-01 Fijar entorno y contratos comunes

Prioridad: P0. Estado: completado.

Dependencias: ninguna; coordinar los contratos iniciales en paralelo.

Resultado: Versiones compatibles, moneda, zona horaria y convenciones acordadas.

- [x] Fijar versiones compatibles de Node.js, TypeScript, Angular y Angular CLI, Express, `pg`, PostgreSQL y decimal.js. Registrar modalidad y límites vigentes del proyecto Supabase Free, dónde se alojarán Angular y Express y desde qué entorno alcanzarán la conexión directa de migraciones y `pg_dump`.
- [x] Acordar moneda de dos decimales, zona horaria, identificadores, errores y decimales como cadenas en API.
- [x] Definir contratos públicos y ruta de integración con los integrantes 2, 3 y 4. Documentar configuración sin secretos.
- [x] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [x] Completar `docs/auditorias/W1-01.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W1-02 Crear la base ejecutable

Prioridad: P0. Estado: completado.

Dependencias: W1-01.

Resultado: Web y API arrancan y consultan PostgreSQL desde una copia limpia.

- [x] Crear app/frontend con Angular/Angular CLI y app/backend con Express/Node.js, módulos locales y un workspace npm.
- [x] Configurar el proyecto PostgreSQL Supabase Free solo desde Express mediante `pg`, conexión cifrada, pool limitado, migraciones SQL, endpoint de salud y cliente API; publicar el cliente transaccional compartido.
- [x] Documentar comandos de arranque y verificar Angular→Express→PostgreSQL alojado, migración en base aislada y rollback con el mismo cliente `pg`.
- [x] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [x] Completar `docs/auditorias/W1-02.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W1-03 Implementar acceso sencillo

Prioridad: P0. Estado: completado.

Dependencias: W1-02.

Resultado: Inicio y cierre de sesión con administrador y trabajador fijos.

- [x] Crear cuentas nominales mediante una utilidad de instalación y mantenimiento, sin pantalla de usuarios o roles.
- [x] Implementar contraseñas con hash seguro y sesiones revocables en servidor mediante cookie HttpOnly y Secure en HTTPS.
- [x] Aplicar acceso fijo del spec en cada endpoint, protección CSRF, expiración, desactivación y rechazo de acceso directo.
- [x] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [x] Completar `docs/auditorias/W1-03.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W1-04 Entregar navegación y diseño web

Prioridad: P0. Estado: completado.

Dependencias: W1-02.

Resultado: Componentes comunes utilizables desde móvil y navegador de PC.

- [x] Crear navegación, formularios, mensajes y estados comunes con inspiración Cupertino, Roboto y Material Symbols Rounded.
- [x] Centralizar colores y estilos; admitir anchos desde 360 px, texto ampliado, teclado y foco visible.
- [x] Integrar los módulos por sus entradas públicas, sin duplicar menús, sesiones ni cliente HTTP.
- [x] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [x] Completar `docs/auditorias/W1-04.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W1-05 Preparar instalación y verificación

Prioridad: P1. Estado: completado.

Dependencias: W1-03, W1-04.

Resultado: Otro integrante puede instalar y ejecutar el proyecto con instrucciones.

- [x] Documentar configuración, build Angular, despliegue Express y web en un mismo origen HTTPS, migraciones, alta/desactivación de cuentas y conexión externa a Supabase sin publicar secretos.
- [x] Preparar datos de demostración, comandos de formato, análisis y pruebas pertinentes.
- [x] Definir exportación propia con `pg_dump` y restauración de PostgreSQL Supabase Free en una base aislada; registrar límites, pausa por inactividad y responsables, sin sobrescribir datos operativos.
- [x] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [x] Completar `docs/auditorias/W1-05.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W1-06 Verificar entrega y recuperación

Prioridad: P1. Estado: en revisión.

Dependencias: W1-05, W2-06, W3-06, W4-06 (supeditada al cierre de revisiones pendientes de los otros 3 módulos).

Resultado: Versión integrada comprobada y respaldo restaurado en una base aislada.

- [ ] Comprobar todos los criterios CW con evidencias integradas y resolver hallazgos con sus propietarios tras la aprobación de W2-06, W3-06 y W4-06.
- [ ] Restaurar un respaldo propio de Supabase en una base aislada y contrastar cuentas, catálogo, movimientos, promociones, órdenes e importes.
- [ ] Verificar el despliegue de prueba HTTPS y registrar navegadores, versiones, limitaciones y pasos de uso en Chrome Android y Safari iPhone.
- [x] Verificar estructura y comportamiento pertinente con evidencia real de W1 (script verificar-accesos-w1.ts con 41/41 pruebas aprobadas).
- [ ] Completar `docs/auditorias/W1-06.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente fechada del revisor 4 antes de cerrar.
