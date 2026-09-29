# Contrato de Catálogo e Inventario (Integrante 2)
**Versión:** 2.1  
**Fecha:** 28 de septiembre de 2026  
**Autor:** Integrante 2 (Catálogo e Inventario)  
**Revisor Principal:** Integrante 1 (Base Web y Acceso)  
**Revisores Adicionales:** Integrante 4 (Consumo y Transacciones) e Integrante 3 (Cotización y Catálogo)

Este documento establece la especificación formal de esquemas, tipos DTO, contratos de API públicos y el protocolo de consumo transaccional proporcionados por el Integrante 2 para el uso de los Integrantes 1 (Plataforma), 3 (Promociones) y 4 (Ventas e Historial).

---

## 1. Esquema de Datos y Persistencia

El módulo de Catálogo e Inventario es propietario exclusivo de las siguientes cuatro tablas en PostgreSQL:

### 1.1 `ingredientes`
Almacena los insumos base utilizados en la elaboración de platillos.
* `id` (`SERIAL PRIMARY KEY`): Identificador único.
* `nombre` (`VARCHAR(100) NOT NULL UNIQUE`): Nombre del ingrediente.
* `unidad` (`VARCHAR(10) NOT NULL`): Unidad base (`'g'`, `'ml'` o `'pieza'`). No se permite la conversión automática ni la alteración de la unidad si el ingrediente está referenciado en recetas o movimientos.
* `minimo` (`NUMERIC(10, 3) NOT NULL DEFAULT 0.000`): Umbral mínimo obligatorio de stock para alertas (no negativo).
* `activo` (`BOOLEAN NOT NULL DEFAULT TRUE`): Estado del ingrediente.
* `creado_en` (`TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`)
* `actualizado_en` (`TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`)

### 1.2 `platillos`
Almacena el catálogo de productos a la venta.
* `id` (`SERIAL PRIMARY KEY`): Identificador único.
* `nombre` (`VARCHAR(100) NOT NULL UNIQUE`): Nombre del platillo.
* `precio` (`NUMERIC(10, 2) NOT NULL`): Precio público (positivo, 2 decimales).
* `activo` (`BOOLEAN NOT NULL DEFAULT TRUE`): Estado del platillo.
* `creado_en` (`TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`)
* `actualizado_en` (`TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`)

### 1.3 `receta_detalle`
Almacena la relación normalizada entre platillos e ingredientes (receta).
* `id` (`SERIAL PRIMARY KEY`): Identificador único.
* `platillo_id` (`INTEGER NOT NULL REFERENCES platillos(id) ON DELETE RESTRICT`): Identificador del platillo.
* `ingrediente_id` (`INTEGER NOT NULL REFERENCES ingredientes(id) ON DELETE RESTRICT`): Identificador del ingrediente.
* `cantidad` (`NUMERIC(10, 3) NOT NULL`): Cantidad requerida de ingrediente por cada unidad de platillo (positiva).
* `creado_en` (`TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`)
* **Restricción:** `UNIQUE (platillo_id, ingrediente_id)`.

### 1.4 `movimientos_inventario`
Almacena el historial inmutable de variaciones en la existencia de ingredientes.
* `id` (`SERIAL PRIMARY KEY`): Identificador único.
* `ingrediente_id` (`INTEGER NOT NULL REFERENCES ingredientes(id) ON DELETE RESTRICT`)
* `tipo` (`VARCHAR(20) NOT NULL`): Tipo de movimiento (`'ENTRADA'`, `'AJUSTE'`, `'CONSUMO_VENTA'`).
* `cantidad` (`NUMERIC(10, 3) NOT NULL`): Cantidad con signo (positiva para entradas/ajustes positivos; negativa para mermas/ajustes negativos y consumo por venta).
* `motivo` (`TEXT NOT NULL`): Justificación del movimiento.
* `usuario_id` (`INTEGER NOT NULL REFERENCES usuarios(id)`): Autor del movimiento.
* `orden_id` (`INTEGER NULL`): Referencia opcional al folio de venta (para `CONSUMO_VENTA`).
* `creado_en` (`TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`)

---

## 2. Tipos e Interfaces DTO (TypeScript)

Conforme a las reglas globales de `AGENTS.md` y `01-plataforma-accesos.md`, todas las cantidades numéricas e importes monetarios viajan como cadenas en las respuestas JSON.

```ts
export type UnidadIngrediente = 'g' | 'ml' | 'pieza';
export type TipoMovimiento = 'ENTRADA' | 'AJUSTE' | 'CONSUMO_VENTA';
export type EstadoStock = 'NORMAL' | 'BAJO_STOCK' | 'AGOTADO';

export interface IngredienteDTO {
  id: number;
  nombre: string;
  unidad: UnidadIngrediente;
  minimo: string; // Ejemplo: "20.000" o "2"
  existencia: string; // Existencia calculada: SUM(movimientos.cantidad)
  estadoStock: EstadoStock;
  activo: boolean;
}

export interface IngredienteRecetaDTO {
  ingredienteId: number;
  nombreIngrediente: string;
  unidad: UnidadIngrediente;
  cantidad: string; // Cantidad por unidad de platillo
}

export interface PlatilloDTO {
  id: number;
  nombre: string;
  precio: string; // Ejemplo: "120.00"
  activo: boolean;
  recetaValida: boolean; // Indica si tiene al menos 1 ingrediente y todos están activos
  ingredientes?: IngredienteRecetaDTO[];
}

export interface MovimientoInventarioDTO {
  id: number;
  ingredienteId: number;
  nombreIngrediente: string;
  unidad: UnidadIngrediente;
  tipo: TipoMovimiento;
  cantidad: string; // Con signo (ejemplo: "-300.000" o "10")
  motivo: string;
  usuarioId: number;
  nombreUsuario: string;
  ordenId?: number | null;
  creadoEn: string; // ISO 8601 UTC
}

export interface AvisoStockDTO {
  ingredienteId: number;
  nombre: string;
  unidad: UnidadIngrediente;
  existencia: string;
  minimo: string;
  estadoStock: EstadoStock;
}
```

---

## 3. Endpoints Públicos de la API (`/api/v1`)

### 3.1 Consulta de Catálogo para Ventas y Promociones (`GET /api/v1/catalogo/platillos`)
* **Acceso:** `ADMINISTRADOR` y `TRABAJADOR`.
* **Propósito:** Permite a Punto de Venta (Integrante 4) y Promociones (Integrante 3) obtener la lista de platillos disponibles.
* **Respuesta (200 OK):**
```json
[
  {
    "id": 1,
    "nombre": "Hamburguesa Clásica",
    "precio": "120.00",
    "activo": true,
    "recetaValida": true,
    "ingredientes": [
      { "ingredienteId": 1, "nombreIngrediente": "Pan de Hamburguesa", "unidad": "pieza", "cantidad": "1" },
      { "ingredienteId": 2, "nombreIngrediente": "Carne de Res", "unidad": "g", "cantidad": "150.000" },
      { "ingredienteId": 3, "nombreIngrediente": "Queso Amarillo", "unidad": "pieza", "cantidad": "1" }
    ]
  }
]
```

### 3.2 Consulta de Avisos de Inventario (`GET /api/v1/inventario/avisos`)
* **Acceso:** `ADMINISTRADOR` y `TRABAJADOR`.
* **Propósito:** Retorna el estado actual del inventario para la vista común de Avisos/Alertas.
* **Regla de Estado de Stock:**
  1. `existencia <= 0`: `AGOTADO` (Prioridad 1).
  2. `existencia > 0 AND existencia <= minimo`: `BAJO_STOCK` (Prioridad 2).
  3. `existencia > minimo`: `NORMAL`.
* **Respuesta (200 OK):**
```json
[
  {
    "ingredienteId": 2,
    "nombre": "Carne de Res",
    "unidad": "g",
    "existencia": "150.000",
    "minimo": "2000.000",
    "estadoStock": "BAJO_STOCK"
  },
  {
    "ingredienteId": 1,
    "nombre": "Pan de Hamburguesa",
    "unidad": "pieza",
    "existencia": "0",
    "minimo": "20",
    "estadoStock": "AGOTADO"
  }
]
```

---

## 4. Contrato de Consumo Transaccional para Ventas (`descontarInventarioPorVenta`)

El módulo de Ventas (Integrante 4) invoca el servicio de consumo de inventario durante el proceso de confirmación de venta, compartiendo la misma transacción PostgreSQL (`pg.PoolClient`).

### 4.1 Firma de la Función de Consumo
```ts
export interface ItemConsumoDTO {
  platilloId: number;
  cantidadPlatillos: number; // Cantidad total vendida (incluye entregadas + bonificadas por promoción)
}

export async function descontarInventarioPorVenta(
  client: pg.PoolClient,
  ordenId: number,
  usuarioId: number,
  items: ItemConsumoDTO[]
): Promise<void>;
```

### 4.2 Algoritmo y Garantías Transaccionales

1. **Cálculo de Demanda Agregada:**
   * Para cada `platilloId` en `items`, se consulta su receta vigente (`receta_detalle`).
   * Se multiplica `cantidadPlatillos * cantidad_ingrediente_receta`.
   * Se agrupa la demanda total por `ingrediente_id` sumando los requerimientos de platillos repetidos o combinados en la misma orden.

2. **Bloqueo Estable de Filas (Prevención de Deadlocks):**
   * Se obtienen los IDs únicos de ingredientes requeridos ordenados ascendentemente: `const idsOrdenados = [...ingredienteIds].sort((a, b) => a - b);`.
   * Se ejecuta el bloqueo FOR UPDATE en dicho orden estable:
     ```sql
     SELECT id, minimo, activo FROM ingredientes WHERE id = ANY($1) ORDER BY id FOR UPDATE;
     ```

3. **Verificación de Insumos Activos y Recetas Válidas:**
   * Si cualquier ingrediente requerido está inactivo (`activo = FALSE`), se lanza error `INGREDIENTE_INACTIVO`.

4. **Verificación de Stock Disponible:**
   * Se calcula la existencia actual para cada ingrediente involucrado mediante:
     ```sql
     SELECT COALESCE(SUM(cantidad), 0) AS existencia 
     FROM movimientos_inventario 
     WHERE ingrediente_id = $1;
     ```
   * Si `existencia < demanda_agregada`, se cancela la operación lanzando la excepción `STOCK_INSUFICIENTE`:
     ```json
     {
       "codigo": "STOCK_INSUFICIENTE",
       "mensaje": "Stock insuficiente para el ingrediente: Carne de Res. Solicitado: 300.000 g, Disponible: 150.000 g",
       "detalles": {
         "ingredienteId": 2,
         "nombreIngrediente": "Carne de Res",
         "demandado": "300.000",
         "disponible": "150.000"
       }
     }
     ```

5. **Registro de Movimiento de Consumo:**
   * Por cada ingrediente en la demanda agregada, se inserta una fila en `movimientos_inventario`:
     ```sql
     INSERT INTO movimientos_inventario (ingrediente_id, tipo, cantidad, motivo, usuario_id, orden_id)
     VALUES ($1, 'CONSUMO_VENTA', -$2, $3, $4, $5);
     ```
   * Motivo registrado: `'Consumo por venta confirmada (Folio #' || ordenId || ')'`.

6. **Manejo de Rollback:**
   * Si `descontarInventarioPorVenta` arroja una excepción, el Módulo de Ventas ejecuta `ROLLBACK` en `client`, garantizando que ni la orden ni los movimientos de inventario se persistan.

---

## 5. Códigos de Error Específicos del Módulo

| Código de Error | HTTP | Descripción |
|---|---|---|
| `RECETA_INVALIDA` | 400 | El platillo no cuenta con ingredientes asignados o contiene ingredientes inactivos. |
| `UNIDAD_INMUTABLE` | 400 | No es posible cambiar la unidad de un ingrediente con historial o recetas vinculadas. |
| `INGREDIENTE_INACTIVO` | 400 | Intento de operar o vender con un ingrediente en estado inactivo. |
| `MINIMO_INVALIDO` | 400 | El valor especificado para el mínimo obligatorio es menor a cero. |
| `STOCK_INSUFICIENTE` | 409 | La existencia actual es menor a la demanda agregada requerida por la venta. |

---
*Fin del contrato de la tarea W2-01.*
