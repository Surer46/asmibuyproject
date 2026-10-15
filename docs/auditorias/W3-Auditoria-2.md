# Segundo ciclo — Descuentos y promociones

ID W: W3-01 a W3-06. Prioridades P0/P1. Estado: en revisión. Fecha: 15-10-2026.
Responsable: Integrante 3. Revisor principal: Integrante 2 (Catálogo e Inventario); revisores adicionales: Integrante 4 (Ventas y Cotización) e Integrante 1 (Base Web y Accesos). Sin decisión humana registrada.

## Resultado y dependencias

Atender A2-3-01 a A2-3-04 de `Auditorias/Auditoria_2/Integrante_3_Promociones.md`. Alcance: snapshot de vigencia en cotización y contrato, hora de evaluación post-bloqueos en revalidación transaccional, protocolo determinista de bloqueos coordinado (sin deadlocks 40P01) y verificación técnica integral.

## Comprobaciones realizadas

| Área | Evidencia real | Resultado |
| --- | --- | --- |
| Estructura y compilación | `npm run build:backend` y `npm run build:frontend` | Compilan limpiamente (0 errores). Seis migraciones SQL empaquetadas. Bundle Angular: 449.82 kB. |
| Snapshot y huella de vigencia (A2-3-01) | `verificar-auditoria2-w3.ts` (Pruebas 1 a 5) | `PromocionAplicadaSnapshotDTO` incluye `fechaInicio` y `fechaFin`. Alterar `fechaInicio` o `fechaFin` manteniendo mismo ahorro y total altera la huella canónica y es rechazado con `COTIZACION_DESACTUALIZADA` (409). |
| Evaluación post-bloqueos (A2-3-02) | `verificar-auditoria2-w3.ts` (Pruebas 6 a 8) | En `t == fechaFin` exacto la promoción no es vigente (fin exclusivo CW-10). La revalidación transaccional (`bloquearParaConfirmacion = true`) obtiene `clock_timestamp()` tras asegurar bloqueos; detecta expiración de promo al 100% y rechaza con `COTIZACION_DESACTUALIZADA` (409), impidiendo confirmar a $0.00. |
| Protocolo de bloqueos (A2-3-03) | `verificar-auditoria2-w3.ts` (Pruebas 9 a 12) | Promociones adquiere `FOR UPDATE` en platillos en orden determinista `ORDER BY id ASC` y `FOR SHARE OF pr` en promociones. Inventario no adquiere `FOR UPDATE` sobre platillos (solo ingredientes). Catálogo adquiere platillo `FOR UPDATE` antes de modificar `receta_detalle`. No hay conversión SHARE→UPDATE ni riesgo de interbloqueo 40P01. |
| Regresión suites W3 | Cinco suites W3 existentes (`w3-02`, `w3-03`, `w3-05`, `w3-06`, `auditoria1-w3`) | **162/162** comprobaciones de memoria pasadas limpiamente. |
| Nueva suite Auditoría 2 | `verificar-auditoria2-w3.ts` | **16/16** comprobaciones aprobadas (0 fallos). |
| Total comprobaciones Integrante 3 | 6 suites ejecutadas en Node.js | **178/178** aprobadas (0 fallos). |

### Resultados por hallazgo

| ID | Archivos/cambio principal | Estado técnico y aceptación |
| --- | --- | --- |
| **A2-3-01** | `app/backend/src/services/promociones.service.ts`, `app/frontend/src/app/services/promociones.service.ts`, `docs/contratos/03-promociones.md` | **Resuelto técnicamente.** `PromocionAplicadaSnapshotDTO` incorpora `fechaInicio: string | null` y `fechaFin: string | null`. La huella comparada en `validarConsistenciaCotizacion` incluye ambos campos. Toda alteración de vigencia en promociones temporales (incluso con mismo total) es detectada y rechazada. |
| **A2-3-02** | `app/backend/src/services/promociones.service.ts` (`cotizarOrden`, `validarConsistenciaCotizacion`) | **Resuelto técnicamente.** En modo de confirmación (`bloquearParaConfirmacion = true`), la hora de evaluación se obtiene mediante `SELECT clock_timestamp() AS ahora` en PostgreSQL (o reloj local) inmediatamente después de adquirir los bloqueos. Si la promoción expira durante la espera, se descarta y arroja HTTP 409 `COTIZACION_DESACTUALIZADA`, previniendo ventas a total $0.00. |
| **A2-3-03** | `promociones.service.ts`, `inventario.service.ts`, `catalogo.service.ts`, `ventas.service.ts` | **Resuelto técnicamente.** Protocolo determinista sin escalada SHARE→UPDATE acordado con Integrantes 2 y 4: platillos bloqueados con `FOR UPDATE` ascendente desde la revalidación económica, promociones participantes con `FOR SHARE OF pr`, insumos con `FOR UPDATE` en Inventario. |
| **A2-3-04** | `docs/contratos/03-promociones.md`, `app/backend/src/scripts/verificar-auditoria2-w3.ts` | **En seguimiento / En revisión.** Contrato actualizado con Adenda Auditoría 2. Suite automatizada con 16 comprobaciones exitosas. Aprobación formal supeditada a la decisión independiente de los revisores humanos (Integrantes 2 y 4) y pruebas físicas en dispositivos móviles. |

### Ejecución reproducible

Desde la raíz del proyecto:

```powershell
# 1. Compilación limpia de backend y frontend
npm run build:backend
npm run build:frontend

# 2. Batería de resolución de Auditoría 2 (Integrante 3)
node app/backend/dist/scripts/verificar-auditoria2-w3.js

# 3. Regresión completa de suites existentes de Promociones (W3)
node app/backend/dist/scripts/verificar-promociones-w3-02.js
node app/backend/dist/scripts/verificar-calculo-w3-03.js
node app/backend/dist/scripts/verificar-integracion-ventas-w3-05.js
node app/backend/dist/scripts/verificar-promociones-integradas-w3-06.js
node app/backend/dist/scripts/verificar-auditoria1-w3.js
```

### Solicitud de revisión

Se solicita la revisión humana independiente a los Integrantes 2 y 4 conforme al protocolo de `AGENTS.md`. No se atribuyen aprobaciones no concedidas.
