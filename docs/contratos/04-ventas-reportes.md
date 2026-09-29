# Contrato de Punto de Venta e Historial (Integrante 4)
**Versión:** 2.1  
**Fecha:** 29 de septiembre de 2026  
**Autor:** Integrante 4 (Punto de Venta e Historial)  
**Revisor Principal:** Integrante 3 (Descuentos y Promociones)  
**Revisores Adicionales:** Integrante 2 (Catálogo e Inventario) e Integrante 1 (Base Web y Acceso)

Este documento establece la especificación formal del modelo de datos, tipos TypeScript (DTOs), esquemas relacionales, reglas de consistencia e idempotencia, contratos de API REST y protocolos de integración transaccional entre el módulo de Punto de Venta e Historial y los módulos de Plataforma (Integrante 1), Catálogo e Inventario (Integrante 2) y Descuentos y Promociones (Integrante 3), en estricto cumplimiento con `spec.md` v2.1 y las reglas de `AGENTS.md`.

---

## 1. Esquema de Datos y Persistencia

El módulo de Ventas e Historial es propietario exclusivo de las tablas `ordenes` y `orden_detalle` en PostgreSQL (Supabase Free):

### 1.1 Tabla `ordenes`
Almacena el encabezado y estado de cada transacción de venta completada o anulada.
* `id` (`SERIAL PRIMARY KEY`): Identificador interno autonumérico secuencial.
* `folio` (`VARCHAR(50) NOT NULL UNIQUE`): Folio legible para comprobante (ej. `"ORD-00001"`).
* `clave_idempotencia` (`VARCHAR(100) NOT NULL UNIQUE`): Clave única generada por el cliente antes del envío (UUID) para garantizar procesamiento exacto una sola vez y recuperación ante respuestas inciertas.
* `usuario_id` (`INTEGER NOT NULL REFERENCES usuarios(id)`): Identificador del usuario cajero/trabajador que registró la venta.
* `estado` (`VARCHAR(20) NOT NULL CHECK (estado IN ('CONFIRMADA', 'ANULADA'))`): Estado de la orden. Solo se persisten órdenes en estos dos estados finales.
* `metodo_pago` (`VARCHAR(20) NOT NULL CHECK (metodo_pago IN ('EFECTIVO', 'EXTERNO', 'SIN_COBRO'))`): Método de pago registrado. Si el total es 0.00 (ej. promoción 100%), se utiliza obligatoriamente `'SIN_COBRO'`.
* `subtotal_bruto` (`NUMERIC(10, 2) NOT NULL CHECK (subtotal_bruto >= 0)`): Suma de importes brutos de las partidas.
* `descuento_total` (`NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (descuento_total >= 0)`): Ahorro total otorgado por la promoción aplicada.
* `total` (`NUMERIC(10, 2) NOT NULL CHECK (total >= 0)`): Importe final cobrado (`subtotal_bruto - descuento_total`).
* `promocion_id` (`INTEGER NULL REFERENCES promociones(id)`): Referencia a la promoción aplicada (si hubo).
* `promocion_nombre` (`VARCHAR(100) NULL`): Copia histórica del nombre de la promoción al momento de la venta.
* `promocion_tipo` (`VARCHAR(20) NULL`): Copia histórica del tipo de promoción (`'PORCENTAJE'` o `'NXM'`).
* `promocion_ahorro` (`NUMERIC(10, 2) NULL`): Copia histórica del importe exacto descontado.
* `motivo_anulacion` (`TEXT NULL`): Justificación obligatoria en caso de anulación.
* `usuario_anulacion_id` (`INTEGER NULL REFERENCES usuarios(id)`): Administrador que autorizó la anulación.
* `anulado_en` (`TIMESTAMP WITH TIME ZONE NULL`): Fecha y hora UTC en que se procesó la anulación.
* `creado_en` (`TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')`): Fecha y hora UTC de confirmación.
* `actualizado_en` (`TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')`): Fecha y hora UTC de última actualización.

### 1.2 Tabla `orden_detalle`
Almacena las partidas físicas entregadas e importes desglosados con copias históricas inmutables.
* `id` (`SERIAL PRIMARY KEY`): Identificador numérico de la partida.
* `orden_id` (`INTEGER NOT NULL REFERENCES ordenes(id) ON DELETE RESTRICT`): Orden a la que pertenece la partida.
* `platillo_id` (`INTEGER NOT NULL REFERENCES platillos(id) ON DELETE RESTRICT`): Platillo vendido.
* `nombre_platillo` (`VARCHAR(100) NOT NULL`): Snapshot inmutable del nombre del platillo al momento de la venta.
* `precio_unitario` (`NUMERIC(10, 2) NOT NULL CHECK (precio_unitario > 0)`): Snapshot del precio del platillo al momento de la venta.
* `cantidad` (`INTEGER NOT NULL CHECK (cantidad > 0)`): Cantidad física total entregada al cliente (consume ingredientes por este total en inventario).
* `unidades_cobradas` (`INTEGER NOT NULL CHECK (unidades_cobradas >= 0)`): Unidades facturadas.
* `unidades_bonificadas` (`INTEGER NOT NULL DEFAULT 0 CHECK (unidades_bonificadas >= 0)`): Unidades bonificadas por promoción (ej. en 2x1 con 2 unidades: 1 cobrada, 1 bonificada).
* `subtotal_bruto` (`NUMERIC(10, 2) NOT NULL CHECK (subtotal_bruto >= 0)`): `cantidad * precio_unitario`.
* `descuento` (`NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (descuento >= 0)`): Descuento asignado a esta partida.
* `subtotal_neto` (`NUMERIC(10, 2) NOT NULL CHECK (subtotal_neto >= 0)`): `subtotal_bruto - descuento`.
* `promocion_id` (`INTEGER NULL REFERENCES promociones(id)`): Referencia a la promoción si aplicó a este platillo.
* `creado_en` (`TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')`): Fecha y hora UTC de la partida.

---

## 2. Tipos e Interfaces DTO (TypeScript)

Conforme a `01-plataforma-accesos.md` y `AGENTS.md`, todos los montos e importes monetarios viajan como cadenas de texto (`string`) en las respuestas JSON con 2 decimales exactos.

```ts
export type EstadoOrden = 'CONFIRMADA' | 'ANULADA';
export type MetodoPago = 'EFECTIVO' | 'EXTERNO' | 'SIN_COBRO';

export interface PartidaOrdenDTO {
  id: number;
  platilloId: number;
  nombrePlatillo: string;
  precioUnitario: string;
  cantidad: number;
  unidadesCobradas: number;
  unidadesBonificadas: number;
  subtotalBruto: string;
  descuento: string;
  subtotalNeto: string;
  promocionId: number | null;
}

export interface PromocionSnapshotDTO {
  id: number | null;
  nombre: string | null;
  tipo: string | null;
  ahorro: string | null;
}

export interface OrdenDTO {
  id: number;
  folio: string;
  claveIdempotencia: string;
  usuarioId: number;
  nombreCajero: string;
  estado: EstadoOrden;
  metodoPago: MetodoPago;
  subtotalBruto: string;
  descuentoTotal: string;
  total: string;
  promocion: PromocionSnapshotDTO | null;
  partidas: PartidaOrdenDTO[];
  motivoAnulacion: string | null;
  usuarioAnulacionId: number | null;
  nombreUsuarioAnulacion: string | null;
  anuladoEn: string | null; // ISO 8601 UTC
  creadoEn: string; // ISO 8601 UTC
}

export interface ItemVentaInput {
  platilloId: number;
  cantidad: number;
}

export interface ConfirmarVentaInput {
  claveIdempotencia: string;
  metodoPago: MetodoPago;
  items: ItemVentaInput[];
  cotizacionAceptada: {
    subtotalBruto: string;
    descuentoTotal: string;
    total: string;
    promocionAplicada: {
      id: number;
      nombre: string;
      tipo: string;
      ahorroTotal: string;
    } | null;
    partidas: Array<{
      platilloId: number;
      cantidad: number;
      precioUnitario: string;
      subtotalBruto: string;
      descuento: string;
      subtotalNeto: string;
      unidadesCobradas: number;
      unidadesBonificadas: number;
      promocionAplicadaId: number | null;
    }>;
  };
}

export interface AnularVentaInput {
  motivo: string;
}

export interface ResumenPeriodoVentasDTO {
  fechaInicio: string | null;
  fechaFin: string | null;
  cantidadConfirmadas: number;
  cantidadAnuladas: number;
  totalVentasConfirmadas: string; // Suma monetaria neta de solo CONFIRMADAS
  ordenes: OrdenDTO[];
}
```

---

## 3. Protocolo Transaccional y Consistencia

### 3.1 Flujo Atómico de Confirmación (`POST /api/v1/ventas/confirmar`)
1. **Revisión de Autenticación y Perfil:**
   - Tanto `TRABAJADOR` como `ADMINISTRADOR` pueden confirmar ventas.
2. **Validación de Idempotencia:**
   - Se consulta si `claveIdempotencia` ya fue registrada:
     - Si ya existe y el `usuario_id`, items y monto total coinciden con la orden registrada: se devuelve inmediatamente la orden existente (`200 OK`), previniendo doble cobro o duplicación por reintento de red (Criterio CW-07).
     - Si ya existe pero el contenido o usuario difieren: se rechaza con HTTP 409 `IDEMPOTENCIA_CONFLICTO`.
3. **Revalidación Económica (Criterio CW-14):**
   - Se invoca `PromocionesService.validarConsistenciaCotizacion(input.cotizacionAceptada)`.
   - Si cambiaron precios, recetas o promociones activas en el intermedio, se arroja `COTIZACION_DESACTUALIZADA` (409) con el nuevo cálculo para requerir aprobación explícita.
4. **Validación de Método de Pago:**
   - Si `total == '0.00'`, el método debe ser `'SIN_COBRO'`.
   - Si `total > '0.00'`, el método debe ser `'EFECTIVO'` o `'EXTERNO'`.
5. **Transacción Única con PostgreSQL (`pg.PoolClient`):**
   ```sql
   BEGIN;
   -- 1. Insertar orden con folio calculado (ej. 'ORD-' || LPAD(nextval('ordenes_id_seq'), 5, '0'))
   -- 2. Insertar orden_detalle con snapshots de precios y desgloses
   -- 3. Invocación de InventarioService.descontarInventarioPorVenta(client, ordenId, usuarioId, itemsConsumo)
   --    - Bloqueo estable SELECT ... FOR UPDATE en ingredientes (evita deadlocks)
   --    - Verificación de existencia suficiente (si falta -> STOCK_INSUFICIENTE 409)
   --    - Inserción de movimientos tipo 'CONSUMO_VENTA' con referencia a la orden
   COMMIT;
   ```
6. **Manejo de Errores y Rollback:**
   - Cualquier excepción (saldo insuficiente, platillo inactivo, receta rota) ejecuta `ROLLBACK` y libera el cliente en `finally`.
   - No se crean órdenes huérfanas ni se descuenta stock de forma parcial (Criterio CW-06).

### 3.2 Protocolo de Recuperación ante Pérdida de Respuesta (CW-19)
- El cliente frontend genera un UUID `claveIdempotencia` al comenzar a procesar el cobro y lo almacena temporalmente en el estado del navegador.
- Si la conexión se interrumpe antes de recibir la confirmación:
  - La interfaz pasa al estado *"Verificando transacción pendiente..."*.
  - El cliente ejecuta `GET /api/v1/ventas/recuperar/:claveIdempotencia`.
  - Si la orden existe, la muestra como completada; si no existe, permite reintentar con la misma clave idempotente sin duplicar transacciones.

### 3.3 Protocolo de Anulación Sencilla (CW-16)
- Endpoint: `POST /api/v1/ventas/:id/anular`.
- **Acceso:** Exclusivo para `ADMINISTRADOR`. Solicitudes de `TRABAJADOR` retornan HTTP 403 `ACCESO_DENEGADO`.
- **Parámetro Obligatorio:** `motivo` con texto no vacío.
- **Idempotencia:** Si la orden ya se encuentra en estado `ANULADA`, la llamada es segura y retorna la orden ya anulada (`200 OK`).
- **Garantía Física y de Inventario:**
  - La anulación **no reintegra automáticamente inventario** en `movimientos_inventario` (los ingredientes salieron del almacén físicamente).
  - Si los productos no fueron elaborados o se recuperaron físicamente, el administrador debe registrar un ajuste de entrada justificado en el módulo de Inventario con referencia al folio de venta.
  - La anulación no ejecuta reembolso bancario automático (fuera de alcance).
  - La orden se conserva permanentemente en la base de datos para trazabilidad y auditoría.

### 3.4 Historial y Reporte por Periodo
- Endpoint: `GET /api/v1/ventas/historial`.
- Filtros opcionales por query params: `fechaInicio` (ISO) y `fechaFin` (ISO).
- **Control de Acceso por Perfil:**
  - `TRABAJADOR`: Solo puede consultar las órdenes donde `usuario_id = req.usuario.id`.
  - `ADMINISTRADOR`: Puede consultar las órdenes de todos los trabajadores de la sucursal.
- **Totalización Contable:**
  - `totalVentasConfirmadas` suma únicamente las órdenes con `estado = 'CONFIRMADA'`.
  - Las órdenes con `estado = 'ANULADA'` se desglosan en la lista pero **se excluyen estrictamente del total monetario**.

---

## 4. Endpoints REST de la API (`/api/v1/ventas`)

| Método | Ruta | Rol Mínimo | Descripción |
|---|---|---|---|
| `POST` | `/api/v1/ventas/confirmar` | Autenticado | Confirma la venta de forma atómica y descuenta inventario |
| `GET` | `/api/v1/ventas/recuperar/:claveIdempotencia` | Autenticado | Consulta si una venta pendiente fue confirmada |
| `GET` | `/api/v1/ventas/historial` | Autenticado | Lista ventas del periodo y totaliza ingresos netos |
| `GET` | `/api/v1/ventas/:id` | Autenticado | Consulta el detalle histórico y comprobante de una orden |
| `POST` | `/api/v1/ventas/:id/anular` | `ADMINISTRADOR` | Anula una venta completa con motivo justificado |

---

## 5. Catálogo Estándar de Errores HTTP

```json
{
  "codigo": "CODIGO_ERROR",
  "mensaje": "Descripción del problema para el operador.",
  "detalles": null
}
```

* `IDEMPOTENCIA_CONFLICTO` (409): La clave de idempotencia ya fue utilizada para otra orden distinta.
* `COTIZACION_DESACTUALIZADA` (409): Precios o promociones cambiaron; se requiere aceptar nuevo resumen.
* `STOCK_INSUFICIENTE` (409): Uno o más ingredientes no cuentan con existencias suficientes.
* `ORDEN_VACIA` (400): No se puede procesar una orden sin partidas.
* `METODO_PAGO_INVALIDO` (400): Método no reconocido o método incorrecto para total $0.00.
* `MOTIVO_REQUERIDO` (400): El motivo de la anulación no puede estar vacío.
* `ORDEN_NO_ENCONTRADA` (404): La orden con el identificador solicitado no existe.
* `ACCESO_DENEGADO` (403): El perfil no tiene permisos (ej. trabajador intentando anular venta o ver historial ajeno).

---
*Fin del contrato de la tarea W4-01.*
