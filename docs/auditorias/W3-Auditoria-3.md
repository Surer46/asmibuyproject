# Tercer ciclo — Descuentos y promociones

ID W: W3-01 a W3-06. Prioridades P0/P1. Estado: en revisión. Fecha: 19-10-2026.
Responsable: Integrante 3. Revisor principal: Integrante 2 (Catálogo e Inventario); revisores adicionales: Integrante 4 (Ventas y Cotización) e Integrante 1 (Base Web y Accesos). Sin decisión humana registrada.

## Resultado y dependencias

Atender `A3-3-01` a `A3-3-05` de [`Auditorias/Auditoria_3/Integrante_3_Promociones.md`](../../Auditorias/Auditoria_3/Integrante_3_Promociones.md). Alcance: reproducibilidad en cualquier fecha de `verificar-auditoria2-w3.ts` con ventanas relativas y reloj controlado, afirmación del motivo de rechazo al modificar `fechaInicio` (conservando la promoción vigente), vencimiento real por paso del tiempo durante espera de bloqueos `FOR UPDATE` en PostgreSQL (`clock_timestamp()`), nueva batería transaccional `verificar-auditoria3-w3.ts` sobre `TEST_DATABASE_URL` (`asmibuy_test_*`), y unificación/documentación del reloj de referencia `clock_timestamp()` y sincronización NTP en `03-promociones.md`.

Archivos del módulo 3: `app/backend/src/services/promociones.service.ts`, `app/backend/src/scripts/verificar-auditoria2-w3.ts`, `app/backend/src/scripts/verificar-auditoria3-w3.ts`, `docs/contratos/03-promociones.md` y `Auditorias/Auditoria_3/Integrante_3_Promociones.md`.

## Comprobaciones realizadas

Entorno: Windows 11, Node.js v24.19.0, PostgreSQL **18.4** local desechable (`embedded-postgres` ejecutado desde directorio temporal externo al repositorio), base aislada `asmibuy_test_w3_a3` con `TimeZone=UTC`. Sin credenciales impresas.

| Área | Evidencia real | Resultado |
| --- | --- | --- |
| Estructura y compilación | `npm run build:backend`, `npm run build:frontend`, `git diff --check` | Compilan sin errores; 7 migraciones SQL empaquetadas en `dist/migrations/`; bundle inicial Angular 449.82 kB. |
| Reproducibilidad de suite A2 (`A3-3-01`) | `node app/backend/dist/scripts/verificar-auditoria2-w3.js` el 19-10-2026 y repetida simulando `2026-11-25T15:30:00.000Z` | **16/16** aprobadas en ambas fechas (0 fallos). Ventanas relativas a la ejecución y validación con reloj controlado (`fechaReferencia`). |
| Afirmación de motivo y expiración real (`A3-3-02`) | `verificar-auditoria2-w3.js` y `verificar-auditoria3-w3.js` | Al modificar `fechaInicio` o `fechaFin`, el 409 conserva `promocionAplicada` activa con el mismo ahorro/total y refleja la nueva fecha.En expiración real (200 ms en memoria y 1.5 s bajo bloqueo `FOR UPDATE` de 2.3 s en PostgreSQL), la promoción vence sin editar `fechaFin`, rechaza con 409 (`promocionAplicada: null`, total `$120.00`) y no crea orden. |
| Batería PostgreSQL con `TEST_DATABASE_URL` (`A3-3-03`) | `node app/backend/dist/scripts/verificar-auditoria3-w3.js` contra `asmibuy_test_w3_a3` | **18/18** comprobaciones en PostgreSQL 18.4: 7 migraciones, `TimeZone=UTC`, cambio de vigencia, vencimiento durante espera de bloqueo `FOR UPDATE`, 6 ventas concurrentes cruzadas con desempate `CW-13` sin `40P01`, venta frente a edición de promoción sin `40P01`, y pool sin clientes retenidos. |
| Reloj unificado y contrato (`A3-3-04`) | `promociones.service.ts` y `docs/contratos/03-promociones.md` | En modo PostgreSQL, tanto la cotización sin bloqueo como la confirmación con bloqueo consultan `SELECT clock_timestamp() AS ahora` en UTC. Contrato actualizado con Adenda Auditoría 3 y sincronización NTP. |
| Regresión en memoria W3 | Cinco suites previas (`w3-02`, `w3-03`, `w3-05`, `w3-06`, `auditoria1-w3`) + `auditoria2-w3` | **162/162** + **16/16** = **178/178** comprobaciones en memoria aprobadas (0 fallos). |
| Navegador y dispositivos (`A3-3-05`) | En seguimiento (continúa `A2-3-04`) | Sin Chrome Android ni Safari iPhone físicos en este entorno; pendiente de recorrido real en dispositivos móviles y decisión humana de los integrantes 2 y 4. |

**Total ejecutado en este ciclo:** **18/18** (PostgreSQL 18.4, nuevas) + **16/16** (suite Auditoría 2 reproducible hoy y en fecha futura `2026-11-25`) + **162/162** (regresión en memoria W3) = **196/196 comprobaciones automatizadas exitosas (0 fallos)**. No sustituye la aprobación humana.

### Ejecución reproducible

```powershell
# 1. Compilación limpia de backend y frontend
npm run build:backend
npm run build:frontend

# 2. Batería en PostgreSQL local desechable (TEST_DATABASE_URL apunta a asmibuy_test_* local; nunca a Supabase)
$env:DATABASE_URL = ''
$env:TEST_DATABASE_URL = 'postgresql://postgres:<password>@127.0.0.1:5432/asmibuy_test_w3_a3'
node app/backend/dist/scripts/verificar-auditoria3-w3.js

# 3. Suite de Auditoría 2 reproducible en cualquier fecha (y repetición simulando otro día: 2026-11-25)
$env:TEST_DATABASE_URL = ''
node app/backend/dist/scripts/verificar-auditoria2-w3.js
node -e "const o=Date.now,d=new Date('2026-11-25T15:30:00Z').getTime()-o(),D=global.Date;Date.now=()=>o()+d;global.Date=class extends D{constructor(...a){a.length?super(...a):super(D.now())}static now(){return o()+d}};require('./app/backend/dist/scripts/verificar-auditoria2-w3.js');"

# 4. Regresión completa de suites W3 en memoria
node app/backend/dist/scripts/verificar-promociones-w3-02.js
node app/backend/dist/scripts/verificar-calculo-w3-03.js
node app/backend/dist/scripts/verificar-integracion-ventas-w3-05.js
node app/backend/dist/scripts/verificar-promociones-integradas-w3-06.js
node app/backend/dist/scripts/verificar-auditoria1-w3.js
```

## Hallazgos y revisión

- `A3-3-01`, `A3-3-02`, `A3-3-03` y `A3-3-04` están corregidos técnicamente y verificados en memoria y en PostgreSQL 18.4 local desechable (`asmibuy_test_w3_a3`).
- `A3-3-05` (pruebas en Chrome Android, Safari iPhone, navegador de PC conectado a Supabase y decisiones humanas) permanece en seguimiento.
- Se solicita formalmente la revisión humana independiente del **Integrante 2** (revisor principal) y del **Integrante 4** (revisor adicional de cotización) con fecha y decisión registrada.

## Cierre

Estado: **en revisión**. Conforme a `AGENTS.md`, las tareas `W3-01` a `W3-06` permanecen en revisión hasta contar con las pruebas en dispositivos físicos, Supabase y la ratificación humana de los integrantes 2 y 4.
