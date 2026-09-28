# Contrato de Plataforma y Acceso (Integrante 1)
**Versión:** 2.1  
**Fecha:** 28 de septiembre de 2026  
**Autor:** Integrante 1 (Base Web y Acceso)  
**Revisor:** Integrante 4  

Este documento establece las convenciones de datos, formatos, versiones y contratos públicos proporcionados por el Integrante 1 para los Integrantes 2 (Catálogo e Inventario), 3 (Promociones) y 4 (Ventas e Historial).

---

## 1. Versiones Compatibles y Entorno

| Tecnología | Versión Fijada | Rol |
|---|---|---|
| **Node.js** | `>= 20.0.0` (Probado en `v24.12.0`) | Entorno de ejecución en servidor |
| **TypeScript** | `^5.7.0` | Lenguaje común en Frontend y Backend |
| **Express** | `^4.21.0` | Servidor API REST (`/api/v1`) |
| **Angular** | `^21.0.0` | Framework web cliente (Standalone components) |
| **pg (node-postgres)** | `^8.13.0` | Driver cliente nativo para PostgreSQL |
| **decimal.js** | `^10.4.3` | Biblioteca de aritmética decimal exacta |
| **PostgreSQL** | `15+` | Base de datos externa en Supabase Free |

### Modalidad y Límites de Supabase Free
* **Conexión Directa:** Usada exclusivamente por Express y migraciones vía `DATABASE_URL` con `ssl: { rejectUnauthorized: false }`.
* **Pool de Conexiones:** Limitado a máximo 5-10 conexiones concurrentes en `pg.Pool` para evitar agotar las cuotas del plan gratuito.
* **Seguridad:** Ni credenciales ni cadenas de conexión llegan al navegador del cliente.

---

## 2. Convenciones de Datos y Formatos

### 2.1 Moneda y Precisión Financiera
* Los importes monetarios se calculan en servidor con `decimal.js` utilizando redondeo **mitad hacia arriba** (*round half-up*) a **2 decimales**.
* En las respuestas de la API (`JSON`), todo monto financiero **debe viajar como cadena de texto** (ejemplo: `"180.50"`) para evitar las pérdidas de precisión por punto flotante de JavaScript.

### 2.2 Cantidades e Inventario
* Las unidades de ingredientes admiten:
  * `g` (gramos): Hasta 3 decimales como cadena (ej. `"150.250"`).
  * `ml` (mililitros): Hasta 3 decimales como cadena (ej. `"250.000"`).
  * `pieza`: Número entero no negativo (ej. `2`).
* Las cantidades de platillos vendidos en el carrito son **enteros positivos**.

### 2.3 Zona Horaria
* Todo registro de fecha en base de datos y en las respuestas de la API se formatea como **instante UTC en estándar ISO 8601** (ej. `"2026-09-28T19:30:00.000Z"`).
* El frontend se encarga de formatear la visualización a la hora local del usuario.

### 2.4 Formato Estándar de Respuestas de Error (HTTP 4xx / 5xx)
Cualquier endpoint que falle retornará un objeto estructurado:
```json
{
  "codigo": "NOMBRE_DEL_ERROR",
  "mensaje": "Descripción clara del motivo del fallo para el usuario.",
  "detalles": null
}
```

Códigos estándar definidos:
* `NO_AUTENTICADO` (401): Sesión ausente, inválida o expirada.
* `ACCESO_DENEGADO` (403): El perfil no tiene permisos para esta acción (ej. trabajador intentando anular venta o cambiar stock).
* `DATOS_INVALIDOS` (400): Los parámetros enviados no cumplen con los tipos o formatos requeridos.
* `RECURSO_NO_ENCONTRADO` (404): ID no existente.
* `STOCK_INSUFICIENTE` (409): No se puede procesar la venta por falta de existencias.
* `ERROR_INTERNO` (500): Excepción no controlada en el servidor.

---

## 3. Contratos de Autenticación y Sesión

### 3.1 Perfiles Fijos
* `ADMINISTRADOR`: Acceso a punto de venta, configuración de ingredientes, recetas, stock, promociones, historial general y anulación.
* `TRABAJADOR`: Acceso a punto de venta, consulta de inventario/avisos y consulta exclusiva de sus propias ventas.

### 3.2 Endpoint de Sesión Actual (`GET /api/v1/auth/me`)
Permite a cualquier módulo frontend conocer quién está operando la aplicación:
```ts
export interface UsuarioSesionDTO {
  id: number;
  nombre: string;
  correo: string;
  perfil: 'ADMINISTRADOR' | 'TRABAJADOR';
  activo: boolean;
}
```

### 3.3 Mecanismo de Sesión
* La sesión se maneja en el servidor con identificación por cookie segura (`HttpOnly`, `SameSite=Lax`, `Secure` en producción).
* Las peticiones mutables (`POST`, `PUT`, `DELETE`) validan encabezado anti-CSRF `X-CSRF-Token`.

---

## 4. Contrato de Transacciones Compartidas (`pg.PoolClient`)

Para operaciones multi-módulo atómicas (como la confirmación de una venta que afecta inventario, promociones y venta simultáneamente):
1. El módulo de Ventas (Integrante 4) solicita un cliente al pool: `const client = await pool.connect();`.
2. Ejecuta `await client.query('BEGIN');`.
3. Pasa la misma instancia de `client` a los repositorios de Inventario (Integrante 2) y Ventas (Integrante 4).
4. Tras validar que todo sea correcto, ejecuta `await client.query('COMMIT');`.
5. Si ocurre cualquier error, ejecuta `await client.query('ROLLBACK');`.
6. En el bloque `finally`, libera obligatoriamente el cliente: `client.release();`.

---
*Fin del contrato de la tarea W1-01.*
