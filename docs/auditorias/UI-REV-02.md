# Auditoría de tarea · UI-REV-02

ID: UI-REV-02 (A-ENT-04 del diagnóstico del 24-11-2026). Prioridad: P1 (entrega). Estado: **en revisión**.
Autor: integrante 1 (Pech Ake Santiago Asahel), con asistente de IA (Claude). Revisor independiente: integrante 4 (Matos May Oscar Michel), pendiente. Revisiones adicionales solicitadas: integrante 4 (venta e historial), integrantes 2 y 3 (gestión).
Versión del cambio: rama `fix/ui-revision-interfaces-02`, commit de corrección `d8255db`, actualizada con `main` (`791ca90`) en `8aa09eb`.

## Resultado y dependencias

Corrige los 10 hallazgos H-01 a H-10 de la revisión de interfaces con agentes (paquete *revision-interfaces v2.2*, Unidad III). El informe con causa, corrección propuesta y criterios de aceptación está en la rama `docs/informe-correcciones-ui-01` (`docs/informe-correcciones-ui-01.md`).

| ID | Severidad | Criterio CW relacionado | Corrección |
| --- | --- | --- | --- |
| H-01 | Alta | CW-01, CW-18 | Login: estado como signals (Angular 21 sin zone.js); muestra el error 401/429 y permite reintentar sin recargar |
| H-02 | Media | CW-17 | Venta: buscador como signal; filtra sin acentos y muestra el estado vacío |
| H-03 | Media | CW-01, CW-17 | Guards esperan `GET /auth/me`; al recargar se conserva la ruta; `?volver=` sólo acepta rutas internas; Trabajador sigue sin Gestión |
| H-04 | Media | CW-18 | Directiva `DialogoModal` en los 8 diálogos: `role="dialog"`, `aria-modal`, foco inicial, Tab contenido, Esc, retorno de foco |
| H-05 | Media | CW-18 | Botones de editar/pausar/retirar con el nombre de la fila |
| H-06 | Baja | CW-18 | `aria-hidden="true"` en los 94 íconos Material Symbols; botones de sólo ícono con `aria-label` |
| H-07 | Baja | CW-18 | Botón «Salir» móvil sin `aria-label` distinto del texto visible |
| H-08 | Baja | CW-18 | `.badge-inactivo` con contraste 6.9:1 (antes 4.39:1) |
| H-09 | Media | CW-17 | Resumen fijo del carrito en pantallas < 900 px |
| H-10 | Baja | CW-17 | Pipes `etiquetaEstado` y `cantidad` (Gestión y Avisos) |

**Archivos (sólo frontend):** `components/login`, `components/venta` (módulo 4), `components/historial` (módulo 4), `components/gestion` (módulos 2 y 3), `components/avisos` (módulo 2), `components/navbar`, `guards/auth.guard.ts`, `services/auth.service.ts`, nuevos `directives/dialogo-modal.directive.ts` y `pipes/formato-inventario.pipe.ts`. No cambian backend, migraciones, contratos ni base de datos.

**Dependencias:** ninguna bloqueante. P2-A (Avisos con error) debe partir de esta versión de `avisos.component.ts` para evitar conflictos.

## Comprobaciones realizadas

Entorno: Windows 11, Node.js 24.12.0, Microsoft Edge (Chromium) con Playwright 1.65 y axe-core 4.14; copia local del proyecto con PostgreSQL 16 en Docker y **datos ficticios** (6 insumos, 5 platillos, 2 promociones, cuentas de prueba ADMINISTRADOR y TRABAJADOR). No se usó Supabase ni el despliegue.

| Área | Evidencia real | Resultado |
| --- | --- | --- |
| Estructura y alcance | `git diff --stat origin/main...HEAD`: 10 archivos, sólo frontend; `git diff --check` sin errores | Verificado |
| Compilación | `npm ci`, `npm run build:backend` y `npm run build:frontend` sobre `8aa09eb` el 24-11-2026: sin errores ni advertencias | Verificado |
| Funcionalidad y límites | 22/22 comprobaciones automáticas (11 en 390×844 y 11 en 1280×800) sobre `d8255db`: ver `evidencias/ui-rev-02/verificacion-correcciones.json` | Verificado (ejecutor) |
| Accesibilidad | axe-core (WCAG 2.0/2.1/2.2 A y AA) en 28 unidades: iteración 01 con violaciones en 12 unidades; iteración 02 con 0 | Verificado (ejecutor) |
| Acceso y sesión | Sin sesión → `/login?volver=%2Fhistorial` → tras login regresa a `/historial`; `volver=//evil.example` → `/venta`; Trabajador en `/gestion` → `/venta` | Verificado (ejecutor) |
| Datos y transacciones | No aplica: no se modificaron servicios de datos, backend ni migraciones | No aplica |
| Diseño y navegador | Capturas antes/después en `evidencias/ui-rev-02/`; sólo Edge de escritorio con emulación de tamaño. **No** se probó en Chrome Android ni Safari iPhone | Parcial |

Resultado de la rúbrica del paquete de revisión (mismo plan aprobado y mismo alcance en ambas iteraciones): **79.3/100 → 100/100**, 10/10 hallazgos resueltos, 0 persistentes, 0 nuevos, 0 regresiones (`evidencias/ui-rev-02/comparacion-01-02.json`).

Reproducir: iniciar backend y frontend, luego (1) contraseña incorrecta en login → aviso rojo y botón «Entrar al Sistema»; (2) escribir «taco» y «zzzz» en el buscador de Venta; (3) F5 en Historial; (4) Gestión → «Nuevo Insumo» → Tab y Esc; (5) vista de 390 px, agregar dos platillos → barra «2 artículos · $67.50 · Ver carrito».

## Hallazgos y revisión

- El merge de `main` (`8aa09eb`) sólo incorporó `docs/entrega/prompts-cierre-2026-11-24.md`; el código es idéntico al verificado en `d8255db`.
- Las comprobaciones las ejecutó el mismo asistente que aplicó las correcciones: **no cuentan como revisión independiente**.
- No se evaluaron flujos que escriben datos (confirmar venta, anular, guardar formularios) ni dispositivos físicos (CW-17/CW-18 en teléfono quedan para PM).

Revisión solicitada al integrante 4 (revisor principal del integrante 1) y aviso a los integrantes 2, 3 y 4 por los archivos de sus módulos.

## Decisión del revisor

Revisor: <nombre> (integrante 4) · Fecha: <AAAA-MM-DD> · Decisión: <aprobado | aprobado con observaciones | rechazado>
Observaciones: <texto>

## Cierre

En revisión. No se fusiona a `main` sin la decisión registrada por el revisor humano.
