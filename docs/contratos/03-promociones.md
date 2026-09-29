# Contrato de Descuentos y Promociones (Integrante 3)
**Versión:** 2.1  
**Fecha:** 29 de septiembre de 2026  
**Autor:** Integrante 3 (Descuentos y Promociones)  
**Revisor Principal:** Integrante 2 (Catálogo e Inventario)  
**Revisores Adicionales:** Integrante 4 (Ventas y Cotización) e Integrante 1 (Base Web y Acceso)

Este documento establece la especificación formal del modelo de datos, tipos TypeScript (DTOs), reglas matemáticas de cálculo exacto, contratos de API REST y protocolos de integración entre el módulo de Promociones y los módulos de Ventas (Integrante 4) y Catálogo e Inventario (Integrante 2), en estricto cumplimiento con `spec.md` v2.1 y las reglas de `AGENTS.md`.

---

## 1. Esquema de Datos y Persistencia

El módulo de Promociones es propietario exclusivo de la tabla `promociones` en PostgreSQL (Supabase Free):

### 1.1 Tabla `promociones`
Almacena las reglas promocionales configuradas por el administrador.
* `id` (`SERIAL PRIMARY KEY`): Identificador numérico único de la promoción. Utilizado como criterio determinista de desempate en caso de igualdad de ahorro efectivo (menor `id` gana).
* `nombre` (`VARCHAR(100) NOT NULL`): Nombre comercial o descriptivo de la promoción (ej. *"Martes 2x1 en Clásica"*).
* `platillo_id` (`INTEGER NOT NULL REFERENCES platillos(id) ON DELETE RESTRICT`): Platillo participante único. No se permite mezclar platillos en una misma promoción.
* `tipo` (`VARCHAR(20) NOT NULL CHECK (tipo IN ('PORCENTAJE', 'NXM'))`): Modalidad de la promoción.
* `porcentaje` (`NUMERIC(5, 2) NULL CHECK (porcentaje > 0 AND porcentaje <= 100)`): Valor porcentual de descuento ($0 < p \le 100$). Obligatorio si `tipo = 'PORCENTAJE'`, nulo si `tipo = 'NXM'`.
* `n` (`INTEGER NULL CHECK (n > 1)`): Unidades del paquete en promociones NxM. Obligatorio si `tipo = 'NXM'`, nulo si `tipo = 'PORCENTAJE'`.
* `m` (`INTEGER NULL CHECK (m >= 1)`): Unidades que se cobran en promociones NxM. Obligatorio si `tipo = 'NXM'`, nulo si `tipo = 'PORCENTAJE'`. Debe cumplir `n > m`.
* `duracion` (`VARCHAR(20) NOT NULL CHECK (duracion IN ('TEMPORAL', 'PERMANENTE'))`): Tipo de vigencia.
* `fecha_inicio` (`TIMESTAMP WITH TIME ZONE NULL`): Instante UTC de inicio inclusivo. Obligatorio si `duracion = 'TEMPORAL'`, nulo si `duracion = 'PERMANENTE'`.
* `fecha_fin` (`TIMESTAMP WITH TIME ZONE NULL`): Instante UTC de fin exclusivo. Obligatorio si `duracion = 'TEMPORAL'`, nulo si `duracion = 'PERMANENTE'`. Debe cumplir `fecha_fin > fecha_inicio`.
* `estado` (`VARCHAR(20) NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'INACTIVA', 'RETIRADA'))`): Estado operativo. Una promoción `RETIRADA` es inmutable y no se puede reactivar ni eliminar físicamente para preservar la integridad referencial histórica de ventas.
* `usuario_id` (`INTEGER NOT NULL REFERENCES usuarios(id)`): Identificador del usuario administrador que creó o modificó la promoción.
* `creado_en` (`TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')`): Fecha y hora de creación en UTC.
* `actualizado_en` (`TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')`): Fecha y hora de última modificación en UTC.

---

## 2. Tipos e Interfaces DTO (TypeScript)

Conforme a las convenciones financieras de `AGENTS.md` y `01-plataforma-accesos.md`, **todo importe monetario, ahorro y porcentaje viaja como cadena de texto** (`string`) en las respuestas JSON hacia el cliente.

```ts
export type TipoPromocion = 'PORCENTAJE' | 'NXM';
export type DuracionPromocion = 'TEMPORAL' | 'PERMANENTE';
export type EstadoPromocion = 'ACTIVA' | 'INACTIVA' | 'RETIRADA';

export interface PromocionDTO {
  id: number;
  nombre: string;
  platilloId: number;
  nombrePlatillo: string;
  precioPlatillo: string; // ej. "120.00"
  tipo: TipoPromocion;
  porcentaje: string | null; // ej. "15.00" si PORCENTAJE
  n: number | null; // ej. 2 si 2x1
  m: number | null; // ej. 1 si 2x1
  duracion: DuracionPromocion;
  fechaInicio: string | null; // ISO 8601 UTC
  fechaFin: string | null; // ISO 8601 UTC
  estado: EstadoPromocion;
  vigente: boolean; // Calculado en servidor según hora actual UTC
  usuarioId: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CrearPromocionInput {
  nombre: string;
  platilloId: number;
  tipo: TipoPromocion;
  porcentaje?: string | number | null;
  n?: number | null;
  m?: number | null;
  duracion: DuracionPromocion;
  fechaInicio?: string | null;
  fechaFin?: string | null;
}

export interface ActualizarPromocionInput {
  nombre?: string;
  platilloId?: number;
  tipo?: TipoPromocion;
  porcentaje?: string | number | null;
  n?: number | null;
  m?: number | null;
  duracion?: DuracionPromocion;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  estado?: EstadoPromocion;
}

// ==========================================
// DTOs PARA COTIZACIÓN Y EVALUACIÓN DE ORDEN
// ==========================================

export interface ItemCotizacionInput {
  platilloId: number;
  cantidad: number; // Entero positivo
}

export interface CotizarVentaInput {
  items: ItemCotizacionInput[];
}

export interface PartidaCotizacionDTO {
  platilloId: number;
  nombrePlatillo: string;
  precioUnitario: string; // ej. "100.00"
  cantidad: number; // Cantidad física entregada q
  subtotalBruto: string; // q * precio
  descuento: string; // Ahorro aplicado a esta partida
  subtotalNeto: string; // subtotalBruto - descuento
  unidadesCobradas: number; // Unidades facturadas
  unidadesBonificadas: number; // Unidades bonificadas (q - unidadesCobradas)
  promocionAplicadaId: number | null;
}

export interface PromocionAplicadaSnapshotDTO {
  id: number;
  nombre: string;
  tipo: TipoPromocion;
  porcentaje: string | null;
  n: number | null;
  m: number | null;
  duracion: DuracionPromocion;
  ahorroTotal: string; // ej. "200.00"
}

export interface ResultadoCotizacionDTO {
  subtotalBruto: string; // Suma de subtotalBruto de todas las partidas
  descuentoTotal: string; // Descuento de la promoción ganadora
  total: string; // subtotalBruto - descuentoTotal (nunca negativo)
  promocionAplicada: PromocionAplicadaSnapshotDTO | null;
  partidas: PartidaCotizacionDTO[];
  fechaEvaluacion: string; // ISO 8601 UTC de la evaluación
}
```

---

## 3. Reglas de Cálculo Exacto en Servidor (CW-10 a CW-15)

Todas las operaciones aritméticas deben realizarse exclusivamente en el backend usando la librería `decimal.js` con precisión decimal fija y modo de redondeo `Decimal.ROUND_HALF_UP` a 2 decimales. El frontend jamás calcula importes finales por cuenta propia.

### 3.1 Vigencia y Estado Operativo (Criterio CW-10)
1. **Promoción Permanente:**
   - No tiene `fecha_inicio` ni `fecha_fin`. Es elegible mientras su estado sea `ACTIVA`.
2. **Promoción Temporal:**
   - Exige `fecha_inicio` y `fecha_fin`.
   - Se evalúa contra la hora actual del servidor en UTC (`T`):
     $$\text{fecha\_inicio} \le T < \text{fecha\_fin}$$
   - **Inicio inclusivo:** A las `12:00:00.000Z`, una promoción con inicio `12:00:00.000Z` es válida.
   - **Fin exclusivo:** A las `14:00:00.000Z`, una promoción con fin `14:00:00.000Z` ya no aplica (vence exactamente a las 14:00:00.000Z).
3. **Desactivación y Retiro:**
   - Estado `INACTIVA`: Suspendida temporalmente; no aplica en cotizaciones.
   - Estado `RETIRADA`: Dada de baja permanentemente; no aplica en cotizaciones y no se puede editar ni reactivar.

### 3.2 Porcentaje por Platillo (Criterio CW-11)
* Aplica exclusivamente sobre el subtotal de la línea del platillo participante:
  $$\text{subtotal\_bruto} = q \times \text{precio}$$
  $$\text{ahorro} = \text{round\_half\_up}\left(\text{subtotal\_bruto} \times \frac{\text{porcentaje}}{100}\right)$$
  $$\text{subtotal\_neto} = \text{subtotal\_bruto} - \text{ahorro}$$
* **Ejemplo 15 %:** 2 unidades de $100.00$ ($200.00$) con 15 % producen ahorro de $30.00$ y subtotal neto de $170.00$.
* **Ejemplo 100 %:** Descuento del 100 % produce ahorro total igual al subtotal y subtotal neto de $0.00$. El total de la orden puede ser $0.00$ (método `SIN_COBRO`), manteniendo intacto el consumo de existencias de inventario.

### 3.3 NxM por Platillo (Criterio CW-12)
* Aplica para $q$ unidades de un mismo platillo con parámetros enteros $N > M \ge 1$:
  $$\text{grupos} = \lfloor q / N \rfloor$$
  $$\text{sobrantes} = q \pmod N$$
  $$\text{unidades\_cobradas} = \text{grupos} \times M + \text{sobrantes}$$
  $$\text{unidades\_bonificadas} = q - \text{unidades\_cobradas} = \text{grupos} \times (N - M)$$
  $$\text{ahorro} = \text{unidades\_bonificadas} \times \text{precio}$$
  $$\text{subtotal\_neto} = \text{unidades\_cobradas} \times \text{precio}$$
* **Ejemplo 2x1 con 5 unidades de \$100.00:**
  - $N=2, M=1, q=5$. Grupos $= 2$, sobrantes $= 1$.
  - Unidades cobradas $= 2 \times 1 + 1 = 3$.
  - Unidades bonificadas $= 2 \times (2 - 1) = 2$.
  - Ahorro $= 2 \times 100.00 = 200.00$. Costo $= 3 \times 100.00 = 300.00$.
* **Ejemplo 3x1 con 4 unidades de \$100.00:**
  - $N=3, M=1, q=4$. Grupos $= 1$, sobrantes $= 1$.
  - Unidades cobradas $= 1 \times 1 + 1 = 2$.
  - Unidades bonificadas $= 1 \times (3 - 1) = 2$.
  - Ahorro $= 2 \times 100.00 = 200.00$. Costo $= 2 \times 100.00 = 200.00$.
* **Garantía física:** Las $q$ unidades se entregan físicamente al cliente y consumen ingredientes de la receta por las $q$ unidades completas en el módulo de inventario.

### 3.4 Regla de Selección Única por Orden y Desempate (Criterio CW-13)
* **Una sola promoción por orden:** De todas las promociones activas y vigentes aplicables a los platillos del carrito, el motor del servidor evalúa el ahorro efectivo que generaría cada una.
* **Ganadora:** Gana la promoción que produzca el **mayor ahorro monetario efectivo** sobre la orden completa.
* **Criterio de desempate:** En caso de empate en el importe de ahorro entre dos o más promociones, gana la promoción con el **menor identificador numérico (`id`)**.
* **Afectación en partidas:** El ahorro total se asigna íntegramente a la línea del platillo beneficiado; las demás partidas de la orden conservan su subtotal y ahorro cero. No hay prorrateo entre platillos no participantes.
* **Suma exacta:** La suma de los subtotales netos de todas las partidas es exactamente igual al total final de la orden.

### 3.5 Revalidación Obligatoria entre Cotización y Confirmación (Criterio CW-14)
Al confirmar la venta en Ventas (Integrante 4):
1. El servidor recibe los items y el hash/resumen de la cotización previa.
2. Vuelve a consultar precios actuales de platillos y vigencia actual de promociones en tiempo real.
3. Si el precio de algún platillo cambió, una promoción expiró, fue desactivada, retirada o se configuró una nueva que altera el total, el servidor rechaza la transacción con código `COTIZACION_DESACTUALIZADA` y devuelve el nuevo resumen calculado para que el cliente lo apruebe explícitamente. No se cobra un importe distinto de forma silenciosa.

### 3.6 Conservación Histórica Inmutable (Criterio CW-15)
Al confirmar una orden:
* La orden almacena una copia inmutable (`promocion_id`, `nombre`, `tipo`, `parametros`, `ahorro`).
* Si el administrador posteriormente modifica, desactiva o retira la promoción, **las ventas anteriores no se modifican ni se recalculan**.

---

## 4. Endpoints REST de la API (`/api/v1/promociones`)

| Método | Ruta | Rol Mínimo | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/promociones` | Autenticado | Lista todas las promociones (incluye estado efectivo y vigencia calculada) |
| `GET` | `/api/v1/promociones/:id` | Autenticado | Obtiene el detalle de una promoción por ID |
| `POST` | `/api/v1/promociones` | `ADMINISTRADOR` | Crea una nueva promoción con validación de platillo y vigencia |
| `PUT` | `/api/v1/promociones/:id` | `ADMINISTRADOR` | Actualiza una promoción existente (no permite si está RETIRADA) |
| `PATCH` | `/api/v1/promociones/:id/estado`| `ADMINISTRADOR`| Cambia estado a ACTIVA o INACTIVA |
| `DELETE`| `/api/v1/promociones/:id` | `ADMINISTRADOR` | Marca la promoción como RETIRADA (baja lógica inmutable) |
| `POST` | `/api/v1/promociones/cotizar` | Autenticado | Evalúa el carrito y calcula subtotal, mejor promoción, ahorro y total |

---

## 5. Catálogo Estándar de Errores HTTP

```json
{
  "codigo": "CODIGO_ERROR",
  "mensaje": "Descripción detallada del fallo para el usuario.",
  "detalles": null
}
```

* `PLATILLO_NO_ENCONTRADO` (404): El platillo asignado no existe en el catálogo.
* `PLATILLO_INACTIVO` (400): No se puede asociar una promoción a un platillo inactivo.
* `TIPO_PROMOCION_INVALIDO` (400): El tipo debe ser `PORCENTAJE` o `NXM`.
* `PORCENTAJE_INVALIDO` (400): El porcentaje debe ser mayor que 0 y menor o igual a 100, con máximo 2 decimales.
* `NXM_INVALIDO` (400): $N$ y $M$ deben ser enteros con $N > M \ge 1$.
* `VIGENCIA_INVALIDA` (400): La fecha de inicio debe ser anterior a la fecha de fin.
* `DURACION_INVALIDA` (400): La duración debe ser `TEMPORAL` o `PERMANENTE`.
* `PROMOCION_RETIRADA` (409): No se puede editar ni reactivar una promoción en estado `RETIRADA`.
* `ORDEN_VACIA` (400): La cotización requiere al menos un platillo con cantidad positiva.
* `COTIZACION_DESACTUALIZADA` (409): Los precios o promociones cambiaron; se requiere revalidación.
