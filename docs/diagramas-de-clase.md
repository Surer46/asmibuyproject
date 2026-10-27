# Diagramas de clase por módulo

- Versión: 1.0. Fecha: 27 de octubre de 2026.
- Elaboró: orquestador (Claude Code), por encargo del equipo. Estado: **en revisión documental** por los cuatro integrantes.
- Fuentes: código de `main` (`fea32d6`): migraciones SQL, servicios y rutas de `app/backend/src`, servicios, guardas y componentes de `app/frontend/src/app`. Complementa los [casos de uso](casos-de-uso.md).

## Cuántos diagramas genera cada módulo

Cada módulo genera **dos diagramas de clase**, y uno adicional muestra cómo se integran. En total, **nueve**.

| Módulo | Integrante | Diagramas | Contenido |
| --- | --- | --- | --- |
| General | Coordinación | 1 · [D0](#d0-integración-entre-módulos) | Dependencias entre los cuatro módulos y la infraestructura común. |
| Plataforma y accesos | 1 | 2 · [D1.1](#d11-modelo-de-dominio) y [D1.2](#d12-diseño-por-capas) | Usuarios y sesiones; autenticación, límite de intentos, CSRF y transacción compartida. |
| Catálogo e inventario | 2 | 2 · [D2.1](#d21-modelo-de-dominio) y [D2.2](#d22-diseño-por-capas) | Ingredientes, platillos, recetas y movimientos; catálogo, inventario y Avisos. |
| Descuentos y promociones | 3 | 2 · [D3.1](#d31-modelo-de-dominio) y [D3.2](#d32-diseño-por-capas) | Promoción y su copia aplicada; administración y motor de cotización. |
| Punto de venta e historial | 4 | 2 · [D4.1](#d41-modelo-de-dominio) y [D4.2](#d42-diseño-por-capas) | Orden, partidas y copias históricas; confirmación, recuperación, historial y anulación. |

- **Modelo de dominio (Dx.1):** entidades persistentes con sus atributos, enumeraciones y asociaciones con multiplicidad, tal como las definen las migraciones. Las entidades de otro módulo aparecen solo con su identificador y la etiqueta del módulo propietario.
- **Diseño por capas (Dx.2):** clases que implementan los casos de uso: componente Angular → servicio API del navegador → router Express → servicio de dominio, con sus DTO, su clase de error y las dependencias hacia otros módulos.

## Convenciones

- Notación UML en Mermaid. Los métodos marcados con `$` son **estáticos**: los servicios del backend no se instancian.
- Estereotipos: `«entity»` (tabla), `«enumeration»`, `«dto»`, `«service»`, `«router»` (`Router` de Express), `«component»` y `«api»` (componente y servicio Angular), `«guard»` y `«function»`.
- Relaciones: `*--` composición, `-->` asociación, `..>` dependencia de uso, `<|--` herencia.
- Tipos: `decimal` es PostgreSQL `numeric`, que viaja como cadena en la API; `instante` es `timestamptz` en UTC.
- Se omiten los métodos privados de mapeo y el almacén en memoria `almacenMemoria`, que solo existe para pruebas sin base de datos.

## D0 Integración entre módulos

```mermaid
classDiagram
  direction LR
  class PlataformaAccesos {
    <<module 1>>
    AuthService
    LoginRateLimiter
    authMiddleware
    pool / ejecutarTransaccion
  }
  class CatalogoInventario {
    <<module 2>>
    CatalogoService
    InventarioService
  }
  class Promociones {
    <<module 3>>
    PromocionesService
  }
  class PuntoVenta {
    <<module 4>>
    VentasService
  }
  class PostgreSQL {
    <<external>>
    Supabase Free
  }
  CatalogoInventario ..> PlataformaAccesos : sesión, perfil, transacción
  Promociones ..> PlataformaAccesos : sesión, perfil
  PuntoVenta ..> PlataformaAccesos : sesión, perfil, pool
  Promociones ..> CatalogoInventario : platillo, precio, huella de receta
  PuntoVenta ..> Promociones : cotizar y revalidar
  PuntoVenta ..> CatalogoInventario : descontar inventario
  PlataformaAccesos ..> PostgreSQL : pg.Pool (TLS, UTC)
```

La dependencia es en un solo sentido: Ventas consume a Promociones y a Inventario, Promociones consume a Catálogo, y todos usan la plataforma. No hay ciclos entre módulos. La transacción de una venta la abre Ventas y la comparten Promociones e Inventario (ver D4.2).

## Módulo 1 · Plataforma y accesos

### D1.1 Modelo de dominio

```mermaid
classDiagram
  class Usuario {
    <<entity>>
    +int id
    +string nombre
    +string correo  «único»
    +string passwordHash
    +PerfilUsuario perfil
    +boolean activo
    +instante creadoEn
  }
  class Sesion {
    <<entity>>
    +string id  «SHA-256 del token»
    +int usuarioId
    +instante expiraEn
    +boolean revocada
    +string ipCreacion
    +instante creadoEn
  }
  class PerfilUsuario {
    <<enumeration>>
    ADMINISTRADOR
    TRABAJADOR
  }
  class SchemaMigracion {
    <<entity>>
    +string version
    +instante aplicadoEn
  }
  Usuario "1" --> "0..*" Sesion : abre
  Usuario --> PerfilUsuario
```

Reglas del modelo: el perfil es fijo, sin tabla de roles; siempre queda al menos un administrador activo; la sesión guarda solo el hash del identificador y expira a las 8 h. `Usuario` es referenciado como autor por los otros tres módulos.

### D1.2 Diseño por capas

```mermaid
classDiagram
  direction TB
  class LoginComponent {
    <<component>>
    +onSubmit() void
  }
  class NavbarComponent {
    <<component>>
    +logout() void
  }
  class AuthServiceWeb {
    <<api>>
    +usuarioActual signal~Usuario~
    +verificarSesionInicial() void
    +asegurarCsrfToken() Observable~string~
    +login(correo, password) Observable
    +logout() void
  }
  class Guardas {
    <<guard>>
    +authGuard()
    +adminGuard()
    +guestGuard()
  }
  class authRouter {
    <<router>>
    POST /auth/login
    POST /auth/logout
    GET /auth/me
    GET /auth/csrf
  }
  class authMiddleware {
    <<function>>
    +verificarSesion(req, res, next)
    +exigirAutenticacion(req, res, next)
    +exigirAdmin(req, res, next)
    +validarCSRF(req, res, next)
    +esOrigenPermitido(origin) boolean
  }
  class AuthService {
    <<service>>
    +buscarPorCorreo(correo)$ Usuario
    +crearSesion(usuarioId, ip)$ token
    +validarSesion(token)$ valida, usuario
    +revocarSesion(token)$ void
    +crearCuentaNominal(nombre, correo, clave, perfil)$ Usuario
    +desactivarUsuario(id)$ Usuario
    +activarUsuario(id)$ Usuario
    +restablecerPassword(id, clave)$ void
    +verificarPassword(clave, hash)$ boolean
    +verificarPasswordFalsa(clave)$ boolean
  }
  class LoginRateLimiter {
    <<service>>
    +MAX_INTENTOS_SIN_BLOQUEO = 5$
    +verificarBloqueo(ip, correo)$ ResultadoVerificacionRateLimit
    +registrarFallo(ip, correo)$ ResultadoVerificacionRateLimit
    +limpiarExito(ip, correo)$ void
  }
  class EstadoIntento {
    <<dto>>
    +int intentosFallidos
    +number primerFallo
    +number ultimoFallo
    +number bloqueadoHasta
  }
  class MantenimientoCuentas {
    <<function>>
    crear / listar / desactivar / activar / password
  }
  class BaseDatos {
    <<service>>
    +pool pg.Pool  max 10, TLS, UTC
    +ejecutarTransaccion(fn) T
    +probarConexionBD() estado
  }
  LoginComponent ..> AuthServiceWeb
  NavbarComponent ..> AuthServiceWeb
  Guardas ..> AuthServiceWeb
  AuthServiceWeb ..> authRouter : HTTP /api/v1/auth
  authRouter ..> AuthService
  authRouter ..> LoginRateLimiter
  LoginRateLimiter "1" *-- "0..*" EstadoIntento : por IP y por IP+correo
  authMiddleware ..> AuthService : validarSesion
  MantenimientoCuentas ..> AuthService
  AuthService ..> BaseDatos
```

`authMiddleware` y `BaseDatos` (`config/database.ts` y `db.service.ts`) son infraestructura común: todos los routers pasan por `verificarSesion` y `validarCSRF`, y los servicios transaccionales usan `ejecutarTransaccion` o un `PoolClient` compartido.

## Módulo 2 · Catálogo e inventario

### D2.1 Modelo de dominio

```mermaid
classDiagram
  class Ingrediente {
    <<entity>>
    +int id
    +string nombre  «único»
    +UnidadIngrediente unidad  «inmutable con referencias»
    +decimal minimo  ≥ 0
    +boolean activo
    +instante creadoEn
    +instante actualizadoEn
    +existencia() decimal  «suma de movimientos»
    +estadoStock() EstadoStock
  }
  class Platillo {
    <<entity>>
    +int id
    +string nombre  «único»
    +decimal precio  > 0, 2 decimales
    +boolean activo
    +instante creadoEn
    +instante actualizadoEn
    +recetaValida() boolean
  }
  class RecetaDetalle {
    <<entity>>
    +int id
    +int platilloId
    +int ingredienteId
    +decimal cantidad  > 0
  }
  class MovimientoInventario {
    <<entity>>
    +int id
    +int ingredienteId
    +TipoMovimiento tipo
    +decimal cantidad  «con signo»
    +string motivo
    +int usuarioId
    +int ordenId  «opcional»
    +instante creadoEn
  }
  class UnidadIngrediente {
    <<enumeration>>
    g
    ml
    pieza
  }
  class TipoMovimiento {
    <<enumeration>>
    ENTRADA
    AJUSTE
    CONSUMO_VENTA
  }
  class EstadoStock {
    <<enumeration>>
    NORMAL
    BAJO_STOCK
    AGOTADO
  }
  class Usuario {
    <<entity · módulo 1>>
    +int id
  }
  class Orden {
    <<entity · módulo 4>>
    +int id
  }
  Platillo "1" *-- "1..*" RecetaDetalle : receta
  RecetaDetalle "0..*" --> "1" Ingrediente : usa
  Ingrediente "1" --> "0..*" MovimientoInventario : historial
  MovimientoInventario "0..*" --> "1" Usuario : autor
  MovimientoInventario "0..*" --> "0..1" Orden : origen
  Ingrediente --> UnidadIngrediente
  Ingrediente --> EstadoStock
  MovimientoInventario --> TipoMovimiento
```

Reglas del modelo: un ingrediente aparece una sola vez por receta; la existencia nunca es negativa; los movimientos confirmados no se borran; un platillo activo necesita al menos un ingrediente activo. `estadoStock` es AGOTADO si la existencia es 0 y BAJO_STOCK si es mayor que 0 y menor o igual al mínimo.

### D2.2 Diseño por capas

```mermaid
classDiagram
  direction TB
  class GestionComponent {
    <<component · compartido 2 y 3>>
    +cargarDatos() void
    +guardarIngrediente() void
    +guardarPlatillo() void
    +agregarFilaReceta() void
    +guardarEntrada() void
    +guardarAjuste() void
  }
  class AvisosComponent {
    <<component>>
    +ngOnInit() void
    +recargarAvisos() void
    +ngOnDestroy() void
  }
  class InventarioApiService {
    <<api>>
    +listarIngredientes() Observable
    +crearIngrediente(data) Observable
    +actualizarIngrediente(id, data) Observable
    +listarPlatillosAdmin() Observable
    +listarPlatillosPublicos() Observable
    +crearPlatillo(data) Observable
    +actualizarPlatillo(id, data) Observable
    +listarMovimientos(ingredienteId) Observable
    +registrarEntrada(data) Observable
    +registrarAjuste(data) Observable
    +obtenerAvisos() Observable~AvisoStockDTO[]~
  }
  class catalogoRouter {
    <<router>>
    GET /catalogo/platillos
    GET|POST|PUT /admin/ingredientes
    GET|POST|PUT /admin/platillos
  }
  class inventarioRouter {
    <<router>>
    POST /admin/movimientos/entrada
    POST /admin/movimientos/ajuste
    GET /admin/movimientos
    GET /inventario/existencias
    GET /inventario/avisos
  }
  class CatalogoService {
    <<service>>
    +listarIngredientes()$ IngredienteDTO[]
    +obtenerIngredientePorId(id, client)$ IngredienteDTO
    +crearIngrediente(input)$ IngredienteDTO
    +actualizarIngrediente(id, input)$ IngredienteDTO
    +listarPlatillosPublicos()$ PlatilloDTO[]
    +listarPlatillosAdmin()$ PlatilloDTO[]
    +obtenerPlatilloPorId(id, client)$ PlatilloDTO
    +crearPlatillo(input)$ PlatilloDTO
    +actualizarPlatillo(id, input)$ PlatilloDTO
    +validarCantidadPorUnidad(valor, unidad)$ Decimal
  }
  class InventarioService {
    <<service>>
    +registrarEntrada(input)$ MovimientoInventarioDTO
    +registrarAjuste(input)$ MovimientoInventarioDTO
    +listarMovimientos(ingredienteId)$ MovimientoInventarioDTO[]
    +descontarInventarioPorVenta(client, ordenId, usuarioId, items)$ void
  }
  class ErrorCatalogo {
    +string codigo
    +int statusCode
    +any detalles
  }
  class IngredienteDTO {
    <<dto>>
    +int id
    +string nombre
    +UnidadIngrediente unidad
    +string minimo
    +string existencia
    +EstadoStock estadoStock
    +boolean activo
  }
  class PlatilloDTO {
    <<dto>>
    +int id
    +string nombre
    +string precio
    +boolean activo
    +boolean recetaValida
    +IngredienteRecetaDTO[] ingredientes
  }
  class MovimientoInventarioDTO {
    <<dto>>
    +int id
    +int ingredienteId
    +TipoMovimiento tipo
    +string cantidad
    +string motivo
    +int usuarioId
    +int ordenId
    +string creadoEn
  }
  class ItemConsumoDTO {
    <<dto>>
    +int platilloId
    +int cantidadPlatillos
  }
  Error <|-- ErrorCatalogo
  GestionComponent ..> InventarioApiService
  AvisosComponent ..> InventarioApiService
  InventarioApiService ..> catalogoRouter : HTTP
  InventarioApiService ..> inventarioRouter : HTTP
  catalogoRouter ..> CatalogoService
  inventarioRouter ..> InventarioService
  inventarioRouter ..> CatalogoService : existencias y avisos
  InventarioService ..> CatalogoService : valida ingrediente y receta
  CatalogoService ..> ErrorCatalogo : lanza
  InventarioService ..> ErrorCatalogo : lanza
  CatalogoService ..> IngredienteDTO
  CatalogoService ..> PlatilloDTO
  InventarioService ..> MovimientoInventarioDTO
  InventarioService ..> ItemConsumoDTO
```

`descontarInventarioPorVenta` es el contrato que consume Ventas: recibe el `PoolClient` de la transacción de venta, bloquea los ingredientes en orden ascendente, suma la demanda de toda la orden y lanza `STOCK_INSUFICIENTE` para revertir todo.

## Módulo 3 · Descuentos y promociones

### D3.1 Modelo de dominio

```mermaid
classDiagram
  class Promocion {
    <<entity>>
    +int id
    +string nombre
    +int platilloId
    +TipoPromocion tipo
    +decimal porcentaje  «solo PORCENTAJE: 0 < p ≤ 100»
    +int n  «solo NXM: n > m»
    +int m  «solo NXM: m ≥ 1»
    +DuracionPromocion duracion
    +instante fechaInicio  «solo TEMPORAL»
    +instante fechaFin  «solo TEMPORAL, > inicio»
    +EstadoPromocion estado
    +int usuarioId
    +instante creadoEn
    +instante actualizadoEn
    +estaVigente(ahora) boolean
  }
  class TipoPromocion {
    <<enumeration>>
    PORCENTAJE
    NXM
  }
  class DuracionPromocion {
    <<enumeration>>
    TEMPORAL
    PERMANENTE
  }
  class EstadoPromocion {
    <<enumeration>>
    ACTIVA
    INACTIVA
    RETIRADA  «final»
  }
  class Platillo {
    <<entity · módulo 2>>
    +int id
  }
  class Usuario {
    <<entity · módulo 1>>
    +int id
  }
  Promocion "0..*" --> "1" Platillo : participa
  Promocion "0..*" --> "1" Usuario : autor
  Promocion --> TipoPromocion
  Promocion --> DuracionPromocion
  Promocion --> EstadoPromocion
```

Reglas del modelo: una promoción afecta a un solo platillo; un platillo puede tener varias; `estaVigente` exige estado ACTIVA y, si es temporal, `inicio ≤ ahora < fin`; una promoción RETIRADA no se edita ni se reactiva. Las restricciones `CHECK` de la migración 003 impiden combinaciones inválidas de tipo, parámetros y fechas.

### D3.2 Diseño por capas

```mermaid
classDiagram
  direction TB
  class GestionComponent {
    <<component · compartido 2 y 3>>
    +guardarPromocion() void
    +conmutarEstadoPromocion() void
    +confirmarRetiroPromocion() void
  }
  class PromocionesApiService {
    <<api>>
    +listarPromociones() Observable
    +crearPromocion(data) Observable
    +actualizarPromocion(id, data) Observable
    +cambiarEstado(id, estado) Observable
    +retirarPromocion(id) Observable
    +cotizarOrden(items) Observable~ResultadoCotizacionDTO~
    +validarCotizacion(previa) Observable
  }
  class promocionesRouter {
    <<router>>
    GET /promociones y /promociones/:id
    POST /promociones/cotizar
    POST /promociones/validar-cotizacion
    POST|PUT /promociones
    PATCH /promociones/:id/estado
    DELETE /promociones/:id  «retirar»
  }
  class PromocionesService {
    <<service>>
    +estaVigente(promo, ahora)$ boolean
    +validarParametros(input)$ void
    +crearPromocion(input, usuarioId)$ PromocionDTO
    +listarPromociones()$ PromocionDTO[]
    +obtenerPorId(id)$ PromocionDTO
    +actualizarPromocion(id, input, usuarioId)$ PromocionDTO
    +cambiarEstado(id, estado, usuarioId)$ PromocionDTO
    +retirarPromocion(id, usuarioId)$ PromocionDTO
    +calcularAhorroDePromocion(regla, precio, cantidad)$ ahorro
    +cotizarOrden(items, fecha, client, bloquear)$ ResultadoCotizacionDTO
    +validarConsistenciaCotizacion(previa, client, bloquear)$ ResultadoCotizacionDTO
  }
  class ErrorPromocion {
    +string codigo
    +int statusCode
    +any detalles
  }
  class ResultadoCotizacionDTO {
    <<dto>>
    +string subtotalBruto
    +string descuentoTotal
    +string total
    +PromocionAplicadaSnapshotDTO promocionAplicada
    +PartidaCotizacionDTO[] partidas
    +string fechaEvaluacion
  }
  class PartidaCotizacionDTO {
    <<dto>>
    +int platilloId
    +string nombrePlatillo
    +string precioUnitario
    +int cantidad
    +int unidadesCobradas
    +int unidadesBonificadas
    +string subtotalBruto
    +string descuento
    +string subtotalNeto
    +int promocionAplicadaId
    +string recetaHuella
  }
  class PromocionAplicadaSnapshotDTO {
    <<dto>>
    +int id
    +string nombre
    +TipoPromocion tipo
    +string porcentaje
    +int n
    +int m
    +DuracionPromocion duracion
    +string fechaInicio
    +string fechaFin
    +string ahorroTotal
  }
  class CatalogoService {
    <<service · módulo 2>>
    +obtenerPlatilloPorId(id, client)$ PlatilloDTO
  }
  Error <|-- ErrorPromocion
  GestionComponent ..> PromocionesApiService
  PromocionesApiService ..> promocionesRouter : HTTP
  promocionesRouter ..> PromocionesService
  PromocionesService ..> ErrorPromocion : lanza
  PromocionesService ..> CatalogoService : platillo y huella de receta
  ResultadoCotizacionDTO "1" *-- "1..*" PartidaCotizacionDTO
  ResultadoCotizacionDTO "1" *-- "0..1" PromocionAplicadaSnapshotDTO
  PromocionesService ..> ResultadoCotizacionDTO : produce
```

`cotizarOrden` y `validarConsistenciaCotizacion` forman el motor que usa Ventas. Con `bloquear = true` y el cliente de la transacción, bloquean los platillos (`FOR UPDATE`) y las promociones (`FOR SHARE`) y toman la hora de la base después de obtener los bloqueos. Si la huella de la regla, la receta, las partidas o los totales difieren de la cotización previa, lanzan `COTIZACION_DESACTUALIZADA`.

## Módulo 4 · Punto de venta e historial

### D4.1 Modelo de dominio

```mermaid
classDiagram
  class Orden {
    <<entity>>
    +int id
    +string folio  «único, ORD-00001»
    +string claveIdempotencia  «única, 1 a 100»
    +int usuarioId
    +EstadoOrden estado
    +MetodoPago metodoPago
    +decimal subtotalBruto
    +decimal descuentoTotal
    +decimal total
    +int promocionId  «opcional»
    +string promocionNombre  «copia»
    +string promocionTipo  «copia»
    +decimal promocionPorcentaje  «copia»
    +int promocionN  «copia»
    +int promocionM  «copia»
    +instante promocionVigenciaInicio  «copia»
    +instante promocionVigenciaFin  «copia»
    +decimal promocionAhorro  «copia»
    +string motivoAnulacion
    +int usuarioAnulacionId
    +instante anuladoEn
    +instante creadoEn
    +instante actualizadoEn
  }
  class OrdenDetalle {
    <<entity>>
    +int id
    +int ordenId
    +int platilloId
    +string nombrePlatillo  «copia»
    +decimal precioUnitario  «copia»
    +int cantidad
    +int unidadesCobradas
    +int unidadesBonificadas
    +decimal subtotalBruto
    +decimal descuento
    +decimal subtotalNeto
    +int promocionId
    +InsumoRecetaSnapshot[] recetaSnapshot  «JSONB»
    +instante creadoEn
  }
  class InsumoRecetaSnapshot {
    <<dto>>
    +int ingredienteId
    +string nombreIngrediente
    +string unidad
    +string cantidadPorPlatillo
    +string consumoTotal
  }
  class EstadoOrden {
    <<enumeration>>
    CONFIRMADA
    ANULADA  «final»
  }
  class MetodoPago {
    <<enumeration>>
    EFECTIVO
    EXTERNO
    SIN_COBRO  «solo total 0»
  }
  class Usuario {
    <<entity · módulo 1>>
    +int id
  }
  class Platillo {
    <<entity · módulo 2>>
    +int id
  }
  class Promocion {
    <<entity · módulo 3>>
    +int id
  }
  class MovimientoInventario {
    <<entity · módulo 2>>
    +int ordenId
  }
  Orden "1" *-- "1..*" OrdenDetalle : partidas
  OrdenDetalle "1" *-- "1..*" InsumoRecetaSnapshot : receta copiada
  Orden "0..*" --> "1" Usuario : cajero
  Orden "0..*" --> "0..1" Usuario : anuló
  Orden "0..*" --> "0..1" Promocion : aplicada
  OrdenDetalle "0..*" --> "1" Platillo
  Orden "1" <-- "0..*" MovimientoInventario : consumo
  Orden --> EstadoOrden
  Orden --> MetodoPago
```

Reglas del modelo: solo se persisten órdenes CONFIRMADAS y ANULADAS; la anulación cambia el estado una sola vez y no borra ni edita partidas; las partidas suman el total; las copias conservan nombre, precio, regla y receta aunque el catálogo cambie después.

### D4.2 Diseño por capas

```mermaid
classDiagram
  direction TB
  class VentaComponent {
    <<component>>
    +carrito signal~ItemCarrito[]~
    +cotizacion signal~ResultadoCotizacionDTO~
    +ventaPendienteClave signal~string~
    +cargarCatalogo() void
    +agregarAlCarrito(platillo) void
    +recalcularCotizacion() void
    +confirmarVenta() void
    +verificarVentaPendiente() void
    +reintentarVentaPendiente() void
    +iniciarNuevaVenta() void
  }
  class HistorialComponent {
    <<component>>
    +cargarHistorial() void
    +verDetalle(orden) void
    +abrirModalAnulacion(orden) void
    +procesarAnulacion() void
  }
  class VentasApiService {
    <<api>>
    +confirmarVenta(data) Observable~OrdenDTO~
    +recuperarVenta(clave) Observable
    +listarHistorial(filtro) Observable~ResumenPeriodoVentasDTO~
    +obtenerOrdenPorId(id) Observable~OrdenDTO~
    +anularVenta(id, motivo) Observable~OrdenDTO~
  }
  class AlmacenPendiente {
    <<function>>
    localStorage asmibuy_venta_pendiente:usuarioId
    guarda clave y solicitud aceptada
  }
  class ventasRouter {
    <<router>>
    POST /ventas/confirmar
    GET /ventas/recuperar/:clave
    GET /ventas/historial
    GET /ventas/:id
    POST /ventas/:id/anular  «admin»
    -usuarioDeSesion(req) usuarioId, perfil
  }
  class VentasService {
    <<service>>
    +normalizarClaveIdempotencia(clave)$ string
    +confirmarVenta(input, usuarioId)$ OrdenDTO
    +buscarPorClaveIdempotencia(clave, client)$ OrdenDTO
    +obtenerPorId(id, usuarioId, perfil)$ OrdenDTO
    +listarHistorial(filtro, usuarioId, perfil)$ ResumenPeriodoVentasDTO
    +anularVenta(id, motivo, usuarioId, perfil)$ OrdenDTO
    -validarCorrespondenciaCarritoCotizacion()$
    -verificarReintentoIdempotente()$
  }
  class normalizarPeriodo {
    <<function>>
    +normalizarPeriodo(filtro) inicio, fin exclusivo
  }
  class ErrorVenta {
    +string codigo
    +int statusCode
    +any detalles
  }
  class ConfirmarVentaInput {
    <<dto>>
    +string claveIdempotencia
    +MetodoPago metodoPago
    +ItemVentaInput[] items
    +ResultadoCotizacionDTO cotizacionAceptada
  }
  class OrdenDTO {
    <<dto>>
    +int id
    +string folio
    +string claveIdempotencia
    +int usuarioId
    +string nombreCajero
    +EstadoOrden estado
    +MetodoPago metodoPago
    +string subtotalBruto
    +string descuentoTotal
    +string total
    +PromocionSnapshotDTO promocion
    +PartidaOrdenDTO[] partidas
    +string motivoAnulacion
    +string anuladoEn
    +string creadoEn
  }
  class ResumenPeriodoVentasDTO {
    <<dto>>
    +string fechaInicio
    +string fechaFin
    +int cantidadConfirmadas
    +int cantidadAnuladas
    +string totalVentasConfirmadas
    +OrdenDTO[] ordenes
  }
  class PromocionesService {
    <<service · módulo 3>>
    +cotizarOrden()$
    +validarConsistenciaCotizacion(previa, client, true)$
  }
  class InventarioService {
    <<service · módulo 2>>
    +descontarInventarioPorVenta(client, ordenId, usuarioId, items)$
  }
  class BaseDatos {
    <<service · módulo 1>>
    +pool pg.Pool
  }
  Error <|-- ErrorVenta
  VentaComponent ..> VentasApiService
  VentaComponent ..> PromocionesApiService : cotizar
  VentaComponent ..> AlmacenPendiente
  HistorialComponent ..> VentasApiService
  VentasApiService ..> ventasRouter : HTTP + CSRF
  ventasRouter ..> VentasService
  VentasService ..> PromocionesService : revalida en la transacción
  VentasService ..> InventarioService : consume en la transacción
  VentasService ..> BaseDatos : PoolClient BEGIN / COMMIT
  VentasService ..> normalizarPeriodo
  VentasService ..> ErrorVenta : lanza
  ConfirmarVentaInput ..> VentasService : entrada
  VentasService ..> OrdenDTO : produce
  ResumenPeriodoVentasDTO "1" *-- "0..*" OrdenDTO
```

`confirmarVenta` obtiene un `PoolClient`, abre la transacción y serializa la clave con `pg_advisory_xact_lock`. Después pasa ese mismo cliente a `PromocionesService` (revalidación con bloqueos) y a `InventarioService` (consumo), inserta orden y partidas, y hace COMMIT; el cliente se libera siempre en `finally`. En el navegador, `VentaComponent` guarda la solicitud pendiente por usuario antes de enviarla y solo la libera ante una respuesta definitiva.

## Observaciones de diseño

Surgieron al construir los diagramas. No son hallazgos de auditoría; se entregan a cada propietario para que decida.

| ID | Módulo | Observación |
| --- | --- | --- |
| ODC-01 | 2 y 3 | `GestionComponent` (1 666 líneas) contiene a la vez la gestión de catálogo, inventario y promociones, lo que mezcla la autoría de dos módulos en un solo archivo de `app/frontend`. Separarlo en componentes por módulo haría más clara la propiedad. |
| ODC-02 | 2 | La condición de Avisos se calcula dentro de `inventarioRouter` (`GET /inventario/avisos`) en lugar de en un método de servicio, a diferencia del resto de reglas de negocio. |
| ODC-03 | 4 | `VentasService.confirmarVenta` lee con SQL directo `receta_detalle`, `promociones` y `usuarios` dentro de la transacción para construir las copias históricas. No escribe en esas tablas, pero no pasa por el contrato de sus módulos. Además, `ventas.service.ts` importa `CatalogoService` sin usarlo. |
| ODC-04 | 1 y 2 | Los tipos `UnidadIngrediente`, `TipoMovimiento` y `EstadoStock` se declaran dos veces (`catalogo.service.ts`/`inventario.service.ts` y `almacen-memoria.ts`), y el frontend los vuelve a declarar. Un archivo de tipos compartido evitaría que diverjan. |

## Revisión

| Diagramas | Revisor documental | Decisión |
| --- | --- | --- |
| D0 | Integrante 1 (coordinación de `app/` y `compartido/`) | Pendiente |
| D1.1, D1.2 | Integrante 1 | Pendiente |
| D2.1, D2.2 | Integrante 2 | Pendiente |
| D3.1, D3.2 | Integrante 3 | Pendiente |
| D4.1, D4.2 | Integrante 3 (revisor del 4) | Pendiente |

Si el código cambia, el autor del cambio actualiza el diagrama de su módulo en el mismo commit.
