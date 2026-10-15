# Segundo ciclo — Ventas e historial

ID W: W4-02 a W4-06. Prioridades P0/P1. Estado: en revisión. Fecha: 15-10-2026.
Responsable: integrante 4; asistencia técnica de OpenCode. Revisor principal: integrante 3; adicionales: 2 (stock/receta) y 1 (acceso). Sin decisión humana registrada.

## Resultado y dependencias

Atender A2-4-01 a A2-4-07 de `Auditorias/Auditoria_2/Integrante_4_Ventas_Reportes.md`. Alcance: liberación de conexiones, concurrencia, recuperación por usuario, identidad de receta, pruebas sin secretos y periodo en zona del negocio.

Cambios compartidos propuestos para revisión de 1/2/3: API de cotización con huella de receta; bloqueo exclusivo ordenado de platillos antes de recetas y consumo; serialización de claves en Ventas. No implica aprobación de los propietarios.

## Comprobaciones realizadas

| Área | Evidencia real | Resultado |
| --- | --- | --- |
| Estructura | `npm run build:backend` y `npm run build:frontend` | Compilan sin errores; seis migraciones empaquetadas. No se alteraron migraciones aplicadas. |
| Datos y concurrencia | Nueva batería `verificar-auditoria2-w4.js`, PostgreSQL **18.4**, clúster local desechable con base dedicada `asmibuy_test_*` | **47/47**; migrador real; pool máximo 10; 14 ventas consecutivas y recuperación de todas las conexiones ociosas; dos cajas sobre el mismo platillo con claves distintas; 12 envíos concurrentes de la misma clave sin duplicados; rollback tras consumo y por falta de stock. |
| Receta histórica | Cotizar consumo 1, editar receta a 2 mediante Catálogo, confirmar cotización anterior y luego aceptar la nueva | La anterior devuelve COTIZACION_DESACTUALIZADA sin escrituras. La nueva conserva snapshot 2 y movimiento -2.000. |
| Periodo | Día local 15-10-2026 en America/Mexico_City, último microsegundo, días inválidos, rango invertido y DST de Nueva York | 19:30 local incluido aunque sea el día UTC siguiente; fin exclusivo excluye las 00:00 locales siguientes e incluye 23:59:59.999999. Día DST de 23 h correcto. |
| Regresión en memoria | Cinco scripts W4 existentes (36+15+21+28+37) | **137/137**, memoria; no son pruebas PostgreSQL ni del componente web. |
| Integración adicional en memoria | `verificar-integracion-ventas-w3-05.js` (19), `verificar-auditoria1-w3.js` (42), `verificar-auditoria1-w2.js` (26) | **87/87**; no equivalen a integración Supabase. |
| Acceso y recuperación en navegador | `verificar-recuperacion-a2-w4.cjs`, **Microsoft Edge 155.0.4283.45**, Windows, headless, 1280×900 y 360×800 | **15/15**, frontend compilado con API Express y PostgreSQL reales. Capturas y metadatos en [evidencias/w4-a2](evidencias/w4-a2/resultado.json). |
| Secretos | La batería antigua rechaza DATABASE_URL configurada; prueba con credencial ficticia y captura de stdout/stderr | No aparece el secreto ficticio. Nueva batería exige TEST_DATABASE_URL local dedicada, no imprime conexiones ni objetos pg. |

### Resultados por hallazgo

| ID | Archivos/cambio principal | Estado técnico y aceptación |
| --- | --- | --- |
| A2-4-01 | `app/backend/src/services/ventas.service.ts`: `finally`, respuesta preparada con cliente transaccional antes del COMMIT | Corregido y comprobado con 14 ventas (> máximo 10) y respuestas contrastadas con persistencia. Pool sin clientes retenidos tras cada venta/rollback. |
| A2-4-02 | `promociones.service.ts`: platillos FOR UPDATE desde el inicio; `catalogo.service.ts`: bloqueo previo a editar receta; `ventas.service.ts`: advisory lock de clave y reconsulta transaccional | Corregido en los escenarios PostgreSQL de dos cajas y misma clave. Protocolo propuesto en contratos 02/03/04; requiere revisión de propietarios 2/3/1 (A2-2-01, A2-3-03). |
| A2-4-03 | `app/frontend/src/app/components/venta/venta.component.ts`: solicitud inmutable por usuario, restauración de clave activa, rechazo de descarte, bloqueo y reintento idéntico; recuperación backend sin fallback silencioso | Corregido y probado en Edge real: pérdida después de COMMIT, pérdida antes de llegar, recarga, navegación, cierre/cambio de usuario y almacenamiento bloqueado. Compatibilidad conservadora con claves legadas sin solicitud. |
| A2-4-04 | DTO y servicio de Promociones backend/frontend: recetaHuella canónica; Catálogo: bloqueo previo a mutación | Corregido; receta modificada exige nueva aceptación y los movimientos coinciden con el snapshot. Revisión compartida con 2 pendiente (A2-2-02). |
| A2-4-05 | `verificar-auditoria1-w4.ts`, nueva batería `verificar-auditoria2-w4.ts` | Corregido: no se registra URL; la batería original solo admite memoria y la nueva usa base local de pruebas obligatoria. |
| A2-4-06 | `app/backend/src/services/periodo-ventas.ts`, `ventas.service.ts`, `.env.example` | Corregido; BUSINESS_TIME_ZONE configurable, predeterminada America/Mexico_City; calendario/rango estrictos, límites convertidos en servidor. |
| A2-4-07 | Plan W4, informes W4-02/03/04/06, rectificación de Auditoría 1, contratos y esta evidencia | Afirmaciones y casillas ajustadas; capturas reales adjuntas. No se fabrican aprobaciones ni validación Android/iPhone. Solicitud de revisión preparada abajo; aceptación humana pendiente. |

### Ejecución reproducible

Desde la raíz del proyecto, con Node/npm y PostgreSQL local desechable:

```powershell
npm run build:backend
npm run build:frontend

# Configurar TEST_DATABASE_URL fuera de los documentos/logs con una base LOCAL asmibuy_test_*.
# No usar una conexión operativa. La batería ejecuta el migrador y crea fixtures; no hace TRUNCATE ni DROP.
$env:DATABASE_URL = ''
node app/backend/dist/scripts/verificar-auditoria2-w4.js

# Playwright debe estar disponible (instalado aparte o mediante PLAYWRIGHT_MODULE).
# En esta ejecución se reutilizó la instalación de herramientas existente, sin añadir dependencias al proyecto.
# BROWSER_CHANNEL predeterminado: msedge. El script inicia y detiene su propia API y proxy estático.
node app/frontend/scripts/verificar-recuperacion-a2-w4.cjs

# Regresión de memoria, siempre sin DATABASE_URL operativa:
node app/backend/dist/scripts/verificar-ventas-w4-03.js
node app/backend/dist/scripts/verificar-historial-w4-04.js
node app/backend/dist/scripts/verificar-anulacion-w4-05.js
node app/backend/dist/scripts/verificar-recorrido-venta-w4-06.js
node app/backend/dist/scripts/verificar-auditoria1-w4.js
node app/backend/dist/scripts/verificar-integracion-ventas-w3-05.js
node app/backend/dist/scripts/verificar-auditoria1-w3.js
node app/backend/dist/scripts/verificar-auditoria1-w2.js
```

Las cifras reportadas no acumulan ejecuciones repetidas. El clúster de prueba se creó separado del de la auditoría previa; sus datos son ficticios. No se consultaron conexiones operativas ni Supabase.

### Prueba de respuesta incierta en navegador

1. Entrar como Caja A y aceptar una cotización real. Interceptar únicamente la respuesta de confirmación: `route.fetch()` obtiene **HTTP 200 después del COMMIT**, y entonces `route.abort()` impide que llegue al navegador.
2. Comprobar por SQL exactamente una orden persistida y comparar el JSON pendiente con la solicitud enviada. La UI muestra incertidumbre, sin éxito ni posibilidad de descartar/iniciar otra venta.
3. Navegar a Historial/Venta y recargar: permanece la misma identidad. Cerrar sesión, entrar como Caja B: no aparece el pendiente de A y la consulta directa de su clave devuelve **403**. Al regresar a A se restaura el pendiente.
4. Simular una consulta todavía negativa: no limpia la identidad. Reintentar: se transmite el payload exacto y PostgreSQL sigue teniendo una sola orden.
5. Repetir con solicitud abortada **antes de llegar** al servidor: consulta real negativa conserva el pendiente y el reintento posterior confirma una sola venta.
6. Verificar consulta de una clave legada: solo la orden propia confirmada permite limpiar; una clave antigua no encontrada mantiene el bloqueo y requiere revisión manual, pues el primer ciclo no conservó su solicitud. Si el almacenamiento está bloqueado, no se envía confirmación.

Capturas: `01-respuesta-incierta-pc.png`, `02-recuperada-pc.png`, `03-pendiente-360px-edge-pc.png`. La tercera es Edge de PC con viewport estrecho: **no es Chrome Android ni Safari iPhone**.

## Hallazgos y revisión

Los siete hallazgos quedan **en revisión** con correcciones/evidencia técnica; falta la decisión humana. Solicitud preparada para el equipo, no enviada por cuenta propia:

- Integrante 3: revisar recuperación, reaceptación de receta y protocolo de cotización; registrar nombre, fecha y decisión.
- Integrante 2: revisar bloqueos compartidos, consumo y huella de receta (A2-2-01/A2-2-02/A2-3-03); repetir concurrencia y rollback si propone cambios.
- Integrante 1: revisar aislamiento por usuario, sesión/cambio de cuenta y almacenamiento de solicitudes sin credenciales.

## Cierre y límites

No se marca ninguna tarea terminada. Pendientes: revisión humana 3/2/1, Chrome Android/Safari iPhone físicos, integración Supabase y recorrido integrado restante. No se probó restauración ni se reabrió su alcance. La evidencia de Edge cubre recuperación, no todas las pantallas ni toda la matriz visual/accesible del MVP. No se modificaron los documentos ajenos que ya estaban sin seguimiento en Git.
