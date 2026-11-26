# Acta de entrega — 2026-11-25

> **BORRADOR — pendiente de revisión del equipo.** Este documento no cierra la entrega ni aprueba nada; transcribe las decisiones escritas en las evidencias.

Etiquetas usadas: **reportado por el ejecutor** (texto de la evidencia, sin repetir el comando), **verificado (comando real)** (ejecutado por el orquestador sobre un clon limpio) y **aprobado por revisor humano** (decisión con nombre, fecha y decisión).

## a) Versión
- SHA de `main` **verificado en clon limpio** el 2026-11-25: `047f9d52747da4178e5388014ca60975e7b52277`.
- URL del despliegue (reportado por el ejecutor, integrante 3, 2026-11-25; detalle en `W1-06.md`): web https://asmibuyproject-1.onrender.com y API https://asmibuyproject.onrender.com, las dos con `833a2c3` (incluye PR #11). Health `OPERATIVO` «(Supabase)» en `production` y **TLS validado** (`DB_SSL_CA` + `DB_SSL_REJECT_UNAUTHORIZED=true`); health verificado también el 2026-11-25 a las 22:50 por la integrante 2. Estado posterior de P1-B1 (respaldo previo, migración 007, A6 sin sesión, A7) en `W1-06.md` (`f853fbc`).
- **Defecto abierto en este SHA:** QA-V-09 (PR #11, sin fusionar), reportado por el ejecutor: al recargar cualquier pantalla la app lleva al login aunque la sesión siga activa. Ninguna suite de la sección d) lo detecta.

## b) Alcance entregado
Spec 2.1 con los cuatro módulos (plataforma y accesos, catálogo e inventario, promociones, ventas e historial), con perfiles fijos ADMINISTRADOR y TRABAJADOR. Web móvil adaptable (Angular + Express + PostgreSQL con `pg`). Límites: Supabase Free como base objetivo, sin aplicaciones nativas, sin editor de roles ni notificaciones externas; Avisos es una vista del stock actual.

## c) Correcciones de esta entrega
Todas las evidencias declaran «en revisión», tengan o no decisión. Solo cuentan las decisiones presentes en `main`.

| ID | Commit | Revisor asignado | Estado |
| --- | --- | --- | --- |
| A-ENT-01 (dependencias) | `a12a440` | integrante 1 | en revisión; decisión del 1 |
| A-ENT-02 (proxy y límite por IP) | `ed03480` | integrante 1 | en revisión; decisión del 1 |
| A-ENT-03 (día de prueba en zona del negocio) | `09c8031` | integrante 3 | en revisión; decisión del 3 |
| A-ENT-04 (interfaz; `d8255db`, fusiones `3f6838c`, `75ca536`, evidencia `ce37c49`) | `d8255db` | integrante 1 (adicional: 4) | en revisión; decisiones del 1 y del 4 |
| DCU-01 (error de Avisos) | `ad39ea6` | integrante 2 | en revisión; sin decisión |
| DCU-02 (contraseña oculta) | `adccd10` | integrante 1 | en revisión; decisión del 1 |
| QA-L-01, QA-L-02, QA-L-03 | `d8353e6` | integrante 1 | en revisión; decisión del 1 |
| QA-L-04 (longitud al crear cuentas) | `90a9131` | integrante 1 | en revisión; incluida en la decisión del 1 sobre ENT-QA-L |
| C8 (estados devueltos a «en revisión», A3-1-05) | `df3ed32` | integrantes 1 (W1, W2, plan), 2 (W3) y 3 (W4) | en revisión; decisión solo del 1 |
| QA-V-01 (insumos inactivos en Avisos) | `4fec839` (PR #8) | integrante 1 (adicional: 4) | en revisión; decisiones del 1 y del 4 |
| QA-V-02 (objetivos táctiles de 44 px) | `24951a6` (PR #7) | integrante 4 (adicionales: 4 en Venta e Historial; 2 y 3 en Gestión) | en revisión; decisión del 4; faltan 2 y 3 |
| QA-V-03 (token CSRF entre pestañas) | `b1e23dd` | integrantes 1 y 3 | en revisión; decisión del 1; falta el 3 |
| QA-V-04 (catálogo y carrito vigentes) | `934444f` | integrante 3 | en revisión; sin decisión |
| QA-V-05 (metadescripción) | `b1e23dd` | integrante 1 | en revisión; decisión del 1 |
| QA-V-06 (encabezados de Avisos) | `934444f` | integrante 1 | en revisión; sin decisión |
| QA-V-07 (errores por campo en Gestión) | `934444f` | integrantes 1 y 2 | en revisión; sin decisión |
| QA-V-08 (cambio de cuenta entre pestañas) | `0e6cf78` | integrantes 1 y 3 | en revisión; decisión del 1; falta el 3; el 1 indica que depende del PR #11 |
| C9 (contratos 02 y 03, W3-05 y prueba de CW-16 en W2-06) | `abc937d` | integrantes 1 (contrato 02, W2-06) y 2 (contrato 03, W3-05) | en revisión; sin decisión |

Pull requests fusionados el 2026-11-25 (hora local); sus commits de fusión están firmados por Oscar Michel Matos May (integrante 4):

| PR | Fusión | Commits y autor | Revisor asignado | Estado |
| --- | --- | --- | --- | --- |
| #5 (QA CW-10 a CW-14 y revisiones del integrante 3) | `565aa23` | `b2024d4`, `038c7c9`; `Gaap72` (integrante 3) | ENT-W3: integrante 2 (adicional: 4) | en revisión; ENT-W3 con decisión del 4 (solo CW-14), falta el 2 |
| #7 (QA-V-02) | `76aa096` | `24951a6`; `Asahel-Pech20` (integrante 1) | integrante 4 y dueños de pantalla | en revisión; decisión del 4 en el archivo |
| #8 (QA-V-01) | `b3b4741` | `4fec839`; `NATALY3538` (integrante 2) | integrante 1 (adicional: 4) | en revisión; decisiones del 1 y del 4 |

Pull requests **abiertos** (no están en `main`; nada de ellos cuenta todavía):

| PR | Cabeza y autor | Contenido (según el PR) | Revisor asignado |
| --- | --- | --- | --- |
| #9 | `dbe7755`; integrante 3 | Despliegue en Render en `W1-06.md` y en esta acta; TLS de la base sin validar y migración 007 pendiente | integrantes 4 y 2 |
| #10 | `371f04d`; integrante 3 | Decisiones del integrante 3 (W4-01 a W4-06, QA-V-03, QA-V-04, C8, Gestión, QA-VISUAL y QA-LOCAL) | — (son decisiones) |
| #11 | `027f8c5`; integrante 1 | Corrección de QA-V-09 (recarga lleva al login) | integrante 4 (adicional: 3) |

## d) Verificación realizada
**Verificado (comando real)** el 2026-11-25 en un clon limpio de `047f9d5` (borrado al terminar), Windows 11, Node 26.10.0, npm 11.19.1, sin `.env` ni `DATABASE_URL`:
- `npm ci` sin errores.
- `npm audit --omit=dev`: **0 vulnerabilidades**. `npm audit`: **16 moderadas**, 0 altas y 0 críticas (todas de desarrollo, porque la auditoría de producción da 0).
- `npm run build:backend` y `npm run build:frontend` sin errores.

**Suites en memoria: 26 de 26 con código 0, 704/704 comprobaciones, 0 fallos** (las de W1 con `NODE_ENV=test`):

| Módulo o entrega | Resultados |
| --- | --- |
| W1 | accesos-w1 51/51; auditoria3-w1 52/52 |
| W2 | catalogo-w2-02 22/22; inventario-w2-03 28/28; minimos-avisos-w2-05 23/23; inventario-integrado-w2-06 19/19; auditoria1-w2 26/26; auditoria2-w2 14/14; auditoria3-w2 17/17 |
| W3 | promociones-w3-02 32/32; calculo-w3-03 36/36; integracion-ventas-w3-05 19/19; promociones-integradas-w3-06 33/33; auditoria1-w3 42/42; auditoria2-w3 16/16 |
| W4 | ventas-w4-03 36/36; historial-w4-04 15/15; anulacion-w4-05 21/21; recorrido-venta-w4-06 28/28; auditoria1-w4 37/37 |
| Entregas | entrega-a-ent-02 8/8; entrega-dcu-02 18/18; entrega-qa-l 18/18; entrega-qa-l-04 7/7; entrega-qa-v 55/55; entrega-qa-v-08 31/31 |

**PostgreSQL 18.4 local** (no Supabase), solo con `TEST_DATABASE_URL`, cada batería en una base temporal `asmibuy_test_*` eliminada al terminar; PostgreSQL detenido: **auditoria2-w4 47/47, auditoria3-w4 18/18, auditoria3-w3 18/18** (83/83, 0 fallos).

Estas suites no renderizan pantallas ni cubren Supabase o teléfonos.

**QA visual en Edge 158.0.4370.33 (reportado por el ejecutor, `QA-VISUAL-2026-11-25.md`)**, PostgreSQL local:
- **CW-03 a CW-18 pasan en L-PC.** CW-17 solo en PC (modo dispositivo 360 × 640). CW-07, solo la parte visual.
- Hallazgos: QA-V-03 (CW-06), QA-V-04 (CW-14), QA-V-05, 06 y 07 (CW-18). Sus correcciones son posteriores y no se han comprobado en navegador.
- QA-L-01 y QA-L-03 pasan; QA-L-02 pasa en la repetición en Edge sobre `565aa23`.
- La sección general de decisión está vacía; el revisor 4 no firma CW-03, 04, 08 y 09.

**Otras comprobaciones en navegador (reportadas por el ejecutor)**: ENT-W3, CW-10 a CW-14 en Chromium 156 con base local; ENT-QA-V-02, Edge 158 con Playwright (asistente); QA-V-01, prueba del revisor en Edge 158; QA-LOCAL, Zen Browser (no es Chrome ni Edge); UI-REV-02, Edge con emulación. Ningún CW en Supabase ni en teléfonos.

Estado de los criterios CW en `docs/matriz-aceptacion.md`: Pendiente 1, Parcial 19, Verificado 0, Aprobado 0.

## e) Aprobaciones humanas registradas
**31 decisiones** con nombre, fecha y decisión en secciones «Decisión del revisor» de `main` (la sección de ENT-A-ENT-04 contiene dos). Todas del 2026-11-25. Texto literal de revisor y decisión; las observaciones completas están en cada archivo.

| Archivo | Revisor | Fecha | Decisión | Límite citado literalmente |
| --- | --- | --- | --- | --- |
| `W1-01.md` | Matos May Oscar Michel (integrante 4) | 2026-11-25 | aprobado con observaciones | |
| `W1-02.md` | Matos May Oscar Michel (integrante 4) | 2026-11-25 | aprobado con observaciones | «la 007 falta en Supabase (P1-B1)» |
| `W1-03.md` | Matos May Oscar Michel (integrante 4) | 2026-11-25 | aprobado con observaciones | |
| `W1-04.md` | Matos May Oscar Michel (integrante 4) | 2026-11-25 | aprobado con observaciones | «CW-18 pendiente en Chrome/Edge y teléfonos» |
| `W2-01.md` | Pech Ake Santiago Asahel (integrante 1) | 2026-11-25 | aprobado | |
| `W2-01.md` | Matos May Oscar Michel (integrante 4) | 2026-11-25 | aprobado con observaciones | «Corregir el contrato antes del cierre.» |
| `W2-02.md` | Pech Ake Santiago Asahel (integrante 1) | 2026-11-25 | aprobado | |
| `W2-03.md` | Pech Ake Santiago Asahel (integrante 1) | 2026-11-25 | aprobado | |
| `W2-03.md` | Matos May Oscar Michel (integrante 4) | 2026-11-25 | aprobado con observaciones | «su suite no prueba FOR UPDATE ni rollback» |
| `W2-04.md` | Pech Ake Santiago Asahel (integrante 1) | 2026-11-25 | aprobado | |
| `W2-05.md` | Pech Ake Santiago Asahel (integrante 1) | 2026-11-25 | aprobado | |
| `W2-06.md` | Pech Ake Santiago Asahel (integrante 1) | 2026-11-25 | aprobado | |
| `W3-01.md` | Matos May Oscar Michel (integrante 4) | 2026-11-25 | aprobado con observaciones | «La corrección del contrato es condición para el cierre.» |
| `W3-03.md` | Matos May Oscar Michel (integrante 4) | 2026-11-25 | aprobado | «Falta S.» |
| `W3-05.md` | Matos May Oscar Michel (integrante 4) | 2026-11-25 | aprobado con observaciones | «Falta S.» |
| `W3-06.md` | Matos May Oscar Michel (integrante 4) | 2026-11-25 | aprobado con observaciones | «Faltan S y navegador.» |
| `ENT-A-ENT-01-2026-11-24.md` | Pech Ake Santiago Asahel (integrante 1) | 2026-11-25 | aprobado con observaciones | |
| `ENT-A-ENT-02-2026-11-24.md` | Pech Ake Santiago Asahel (integrante 1) | 2026-11-25 | aprobado con observaciones | |
| `ENT-A-ENT-04-2026-11-24.md` | Pech Ake Santiago Asahel (integrante 1) | 2026-11-25 | aprobado con observaciones | «La aprobación cubre solo la integración» |
| `ENT-A-ENT-04-2026-11-24.md` | Matos May Oscar Michel (integrante 4), Venta e Historial | 2026-11-25 | aprobado con observaciones | «esta firma es conformidad del dueño del módulo, no revisión independiente» |
| `ENT-C8-2026-11-25.md` | Pech Ake Santiago Asahel (integrante 1) | 2026-11-25 | aprobado con observaciones | «El integrante 1 no firma W1.» |
| `ENT-DCU-02-2026-11-24.md` | Pech Ake Santiago Asahel (integrante 1) | 2026-11-25 | aprobado | |
| `ENT-QA-L-2026-11-25.md` | Pech Ake Santiago Asahel (integrante 1) | 2026-11-25 | aprobado con observaciones | |
| `ENT-QA-V-2026-11-25.md` | Pech Ake Santiago Asahel (integrante 1) | 2026-11-25 | aprobado con observaciones | «Revisa QA-V-03 y QA-V-05.» |
| `ENT-QA-V-02-2026-11-25.md` | Matos May Oscar Michel (integrante 4) | 2026-11-25 | aprobado con observaciones | «Esta firma no cubre los cambios posteriores en Venta y Gestión (b1e23dd, 934444f, 0e6cf78), que hice yo.» |
| `ENT-QA-V-08-2026-11-25.md` | Pech Ake Santiago Asahel (integrante 1) | 2026-11-25 | aprobado con observaciones | «depende del PR #11 para comportarse como se describe» |
| `ENT-W3-2026-11-24.md` | Matos May Oscar Michel (integrante 4) | 2026-11-25 | aprobado con observaciones | «revisé solo CW-14.» |
| `ENT-W4-2026-11-24.md` | Gaap72 (integrante 3) | 2026-11-25 | aprobado | «El QA integrado en Supabase y en móviles sigue pendiente en W4-06.» |
| `QA-V-01.md` | Pech Ake Santiago Asahel (integrante 1) | 2026-11-25 | aprobado | «Revisión principal.» |
| `QA-V-01.md` | Matos May Oscar Michel (integrante 4) | 2026-11-25 | aprobado con observaciones | «como revisor adicional de consumo» |
| `UI-REV-02.md` | Matos May Oscar Michel (integrante 4) | 2026-11-25 | aprobado con observaciones | «Pendientes: flujos con escritura, diálogos, comprobante y teléfonos (PM).» |

| Revisor | Aprobado | Aprobado con observaciones | Total |
| --- | --- | --- | --- |
| Integrante 1 | 8 | 7 | 15 |
| Integrante 2 | 0 | 0 | 0 |
| Integrante 3 | 1 | 0 | 1 |
| Integrante 4 | 1 | 14 | 15 |

No firmado con nota (sección vacía; no cuenta):
- `W2-06.md`: «Revisor 4: no firmado. La prueba de CW-16 (verificar-inventario-integrado-w2-06.ts:123-142) no ejecuta ninguna anulación y pasa siempre; el encabezado anuncia idempotencia sin prueba; 2x1 y 3x1 escritos a mano; la fila de diseño (l. 46) no tiene evidencia. Hallazgo para el integrante 2»
- `QA-VISUAL-2026-11-25.md`: «Revisor 4: no firmado; no hay capturas de estos casos en el repositorio y CW-08 no llevó la carne a su mínimo. Pendiente de capturas del integrante 1 o de repetirlo en Edge»

Secciones vacías en `main`: `ENT-C9` (1 y 2); `ENT-DCU-01`; `ENT-QA-V` (2, 3 y 1 para QA-V-06 y 07); `ENT-QA-V-08` (3); `ENT-W3` (principal); `QA-LOCAL`; `QA-VISUAL` (general); `W1-05`, `W1-06`; `W3-01` a `W3-06` (principal); `W4-01` a `W4-06`.

Tampoco cuentan, por no ser una sección «Decisión del revisor» de `main`:
- `W4-Auditoria-3.md`, línea literal: «Decisión del revisor principal: Gaap72 (integrante 3) · 2026-11-25 · **aprobado**. Lista de comprobación en `ENT-W4-2026-11-24.md`. A3-4-05 (móviles físicos y Supabase) sigue abierto, y faltan las revisiones de los integrantes 2 y 1.»
- Tablas de `docs/casos-de-uso.md` (CU-13 a CU-22) y `docs/diagramas-de-clase.md` (D3 y D4): «Aprobado (Gaap72, 2026-11-25)».
- Decisiones del integrante 3 en el PR #10, sin fusionar.

## f) Pendientes conocidos

### Firmas que faltan en `main`
| Integrante | Como revisor principal | Como revisor adicional |
| --- | --- | --- |
| 1 | QA-V-06 y QA-V-07 (ENT-QA-V); C9 (contrato 02 y W2-06) | W4-01 a W4-06; W4-Auditoria-3 |
| 2 | W3-01 a W3-06; ENT-W3; DCU-01; QA-V-07 (promociones); C9 (contrato 03 y W3-05); C8 (W3) | W4-01 a W4-06; W4-Auditoria-3; Gestión en UI-REV-02 y ENT-QA-V-02; PR #9 |
| 3 | W4-01 a W4-06; QA-V-03 (venta), QA-V-04 y QA-V-08; C8 (W4) | Gestión en UI-REV-02 y ENT-QA-V-02; QA-V-09 (PR #11). Varias están escritas en el PR #10 |
| 4 | W1-05 y W1-06 (tras P1-B; PR #9); QA-V-09 (PR #11) | W2-06 (no firmado); QA-VISUAL CW-03, 04, 08 y 09 (no firmados), CW-17 y CW-18 |

`QA-VISUAL`: la columna de revisor asigna además CW-05, 06 y 10 a 13 al 2, y CW-07 y 14 a 17 al 3; CW-03, 04, 08 y 09 figuran para el 1, que ejecutó la QA. `QA-LOCAL`: sin revisor nominal en `main` (el PR #10 la atribuye al 3).

### Sin firmar por el revisor 4
| Sección | Por qué | Situación |
| --- | --- | --- |
| W2-06 | Prueba de CW-16 sin anulación, idempotencia anunciada sin prueba, 2x1 y 3x1 a mano, fila de diseño sin evidencia | C9 corrigió la prueba (19/19), el encabezado y las promociones; la fila de diseño sigue igual. El integrante 4 es autor de esa corrección y no ha registrado decisión |
| QA-VISUAL (CW-03, 04, 08 y 09) | No hay capturas de esos casos en el repositorio y CW-08 no llevó la carne a su mínimo | Faltan capturas del integrante 1 o repetir los casos en Edge |

### Trabajo pendiente por responsable
| Responsable | Pendiente | Riesgo |
| --- | --- | --- |
| 4 (revisa 3) | Revisar y decidir sobre QA-V-09 (PR #11): defecto presente en `main` | Alto |
| 4 | Comprobación visual de QA-V-03 a QA-V-08 en Chrome o Edge (QA-V-08, después del PR #11, como pide el integrante 1; el PR #10 informa QA-V-04 en Chromium 156) | Medio |
| 1 | P1-B1: Supabase, respaldo previo, migración 007 y despliegue HTTPS. En `main` pendiente; el PR #9 informa un despliegue con TLS sin validar. Además, ese PR modifica esta acta | Alto: sin S ningún criterio pasa a Verificado |
| 1 (revisa 4) | P1-B2: restauración, CW-20 | Alto: sin prueba de recuperación |
| 1 | El limitador de intentos guarda su estado en memoria: exige una sola instancia | Medio |
| 1 | Observaciones de A-ENT-02: `TRUST_PROXY=true`, `intentosRestantes` y comentario de `DB_SSL_CA` | Medio |
| 1 (decide) | QA-L-04: `crearCuentaNominal` hashea sin recortar y `restablecerPassword` recortado; no se pide cambio por ahora | Bajo |
| 1 | QA-V-07: el stock mínimo no se valida en la web y la receta no tiene etiquetas | Medio: accesibilidad |
| 1 | Límite de QA-V-08: ventana entre comprobación y envío; propuesta de que el servidor compare el usuario esperado y responda 409 (el 1 la deja para después de la entrega) | Medio |
| 1 y 2 | Límite de QA-V-08: Gestión no comprueba la cuenta antes de guardar; además puede recibir `CSRF_INVALIDO` desde una pestaña vieja | Medio |
| 2 | C9: un platillo inactivo se puede reactivar por API (enviando solo `activo`) con un insumo inactivo en la receta | Medio |
| 2 | C9: el consumo sin cliente transaccional en modo PostgreSQL no se persiste y no da error | Medio |
| 2 | C9: en el contrato 02, el mensaje de ejemplo de `STOCK_INSUFICIENTE` no coincide con el código y falta `INGREDIENTE_EN_USO` | Bajo |
| 3 | Decidir la fusión de los PR #9 y #10 con sus revisores | Medio |
| 1 y 4 | CW-01 y CW-02 como casos propios en Chrome/Edge (con la interfaz del trabajador sin Gestión); reconexión de CW-19 | Medio |
| Integrantes por módulo (CW-17: 1 y 4) | PM: Chrome Android y Safari iPhone (CW-01, 05, 07, 09, 17, 18 y 19 según corresponda) | Alto |
| Integrantes por módulo | Repetir en S los CW validados solo en L | Alto |
| Equipo | Documentos académicos sin seguimiento: decidir procedencia e inclusión (sección g) | Bajo |

## g) Documentos académicos locales sin seguimiento
`Documento_1`, `Documento_2`, `EV-01_EV-04`, `acta_validacion_cliente`, `DOC-DISENO` y `DOC-INT`: **pendiente de decisión del equipo sobre procedencia e inclusión**. No forman parte de este commit.

## h) Firmas
| Integrante | Nombre | Rol | Fecha | Conformidad |
| --- | --- | --- | --- | --- |
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | Matos May Oscar Michel | Ventas y reportes; orquestador | 2026-11-25 | conforme con observaciones: «Entrega con los pendientes declarados en f) y en W1-06.md: A6 con sesión, teléfonos (CW-17) y restauración (CW-20)» |
