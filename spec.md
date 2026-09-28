# Especificación del MVP web móvil

- Versión: 2.1. Fecha: 28 de septiembre de 2026.
- Esta versión sustituye la planificación de aplicaciones nativas y roles configurables.
- Estado: documentación de alcance y trabajo pendiente; no acredita una implementación.

## Objetivo

Construir una web para empleados de una sola sucursal de alimentos. Desde el navegador del teléfono se podrán vender platillos y gestionar ingredientes, recetas, existencias y promociones. Punto de Venta y BackOffice compartirán una API y una base de datos. La misma web se adaptará al navegador de PC, sin otra aplicación o fase nativa.

Se requiere conexión para operar. No hay registro público, pedidos de clientes, aplicación de tienda ni sincronización de ventas sin conexión.

## Alcance reducido de esta versión

| Área | Alcance de la versión 2 |
| --- | --- |
| Accesos | Dos perfiles fijos; se retiran el editor de roles, permisos configurables y pantalla de gestión de usuarios. |
| Plataformas | Web adaptable a móvil y PC; se retiran compilaciones, publicación y adaptadores nativos. |
| Alertas | Mínimo por ingrediente y lista de condiciones actuales dentro de la web. |
| Notificaciones | Push y centro con historial, lectura y preferencias quedan fuera de esta entrega. |
| Promociones | Porcentaje y NxM sobre un único platillo por promoción; se retiran monto fijo y mezcla de platillos. |
| Ventas | Carrito, confirmación, comprobante en pantalla e historial con total por periodo. |
| Anulación | Total, con motivo, sin reintegro automático ni clasificación de preparados y mermas. |
| Reportes | Historial y su total; se retiran paneles e informes adicionales e impresión integrada. |

Estas exclusiones reemplazan los requisitos anteriores del mismo apartado. Se conservan exactitud de importes, stock no negativo, seguridad de acceso y consistencia de las ventas.

## Tecnología

**Lenguaje de programación del proyecto: TypeScript para frontend y backend.** Angular y Angular CLI construyen la web con plantillas HTML y CSS adaptable. Node.js con Express implementa la API REST; `pg` conecta el servidor con PostgreSQL. La base de datos PostgreSQL estará alojada externamente en un proyecto Supabase del plan gratuito (Free). Supabase se usa como alojamiento de la base: la web no consulta PostgreSQL directamente ni recibe credenciales. La web y Express requieren alojamiento propio, separado de Supabase. decimal.js realiza cálculos exactos en el servidor. Ver [decisión técnica](docs/decisiones/0002-web-movil.md) y [arquitectura](docs/arquitectura-tecnica.md).

## Acceso sin roles configurables

Hay cuentas nominales y dos perfiles definidos en código: ADMINISTRADOR y TRABAJADOR. No existen tablas de roles, catálogo editable de permisos ni pantalla para asignarlos. Una utilidad de instalación y mantenimiento permite crear, desactivar o restablecer cuentas; no hay registro público. Se conserva al menos un administrador activo.

| Operación | Administrador | Trabajador |
| --- | --- | --- |
| Vender y consultar platillos disponibles | Sí | Sí |
| Ver inventario y Avisos actuales | Sí | Sí |
| Modificar ingredientes, recetas, stock, mínimos y promociones | Sí | No |
| Consultar historial | Todas las ventas | Sus propias ventas |
| Anular una venta | Sí | No |

El servidor verifica sesión, cuenta activa, perfil fijo y alcance en cada operación. Las contraseñas usan hash seguro. Las sesiones son revocables en servidor, con cookie HttpOnly, Secure en HTTPS y SameSite; las escrituras validan protección CSRF y origen permitido. No guardar credenciales ni tokens de sesión en localStorage. Cerrar sesión invalida la sesión y borra la información privada del cliente.

## Ingredientes y recetas

Cada ingrediente tiene nombre, unidad base (g, ml o pieza), estado activo y mínimo individual no negativo. No hay conversión automática de unidades. La unidad no cambia si existen recetas o movimientos. Cantidades de g/ml admiten hasta tres decimales; piezas y cantidades vendidas son enteras. Rechazar exceso de precisión en vez de redondear consumos silenciosamente.

Cada platillo tiene nombre, precio positivo de dos decimales, estado activo y receta con al menos un ingrediente. Las cantidades de receta son positivas y no se repite ingrediente en la misma receta. Un platillo con receta inválida o ingrediente inactivo no se vende. Para desactivar un ingrediente usado se actualizan o desactivan previamente los platillos afectados.

Crear o editar recetas no cambia stock. Ejemplo: una hamburguesa usa un pan, 150 g de carne y una pieza de queso; vender dos consume dos panes, 300 g y dos quesos. Los cambios solo afectan ventas futuras.

## Inventario y Avisos

La existencia se obtiene del historial de movimientos: stock inicial, entrada, ajuste positivo o negativo y consumo por venta. Cada movimiento conserva ingrediente, cantidad con signo, fecha, usuario, tipo y venta de origen cuando aplica. Los ajustes requieren motivo; no se borran movimientos confirmados. No se permite stock negativo. Una merma se registra como ajuste negativo justificado, sin formulario adicional.

La validación de venta suma la demanda de todos los platillos de la orden para cada ingrediente. El carrito no reserva ni consume. Un aviso de bajo stock no impide vender si la cantidad necesaria sigue disponible.

El administrador fija un mínimo por ingrediente. Con existencia mayor que cero y menor o igual al mínimo se muestra bajo stock; a cero se muestra agotado con prioridad. Todos los ingredientes tienen un mínimo, incluido cero. Se elimina el interruptor de activación de alertas para simplificar la configuración.

Inventario y el apartado Avisos muestran la misma condición actual, con una fila por ingrediente, existencia, unidad y mínimo. No hay tabla de notificaciones, lectura por usuario ni envío externo. Al abrir la vista, volver a la pestaña, recargar o completar una operación se consulta el estado vigente. No se promete actualización instantánea en otras pantallas que permanezcan abiertas.

## Descuentos y promociones

Cada promoción contiene nombre, un platillo participante, tipo PORCENTAJE o NXM, parámetros, duración TEMPORAL o PERMANENTE y estado ACTIVA, INACTIVA o RETIRADA. Se permite crear, editar, activar, desactivar y retirar; una retirada conserva historial y no se reactiva.

Temporal exige inicio y fin válidos: inicio <= hora de servidor < fin. Permanente no tiene fechas ni vencimiento. Desactivar o retirar impide aplicaciones posteriores. La instalación define una zona horaria y las fechas se guardan como instantes UTC.

Porcentaje: mayor que cero y hasta 100. El descuento se calcula sobre el subtotal completo de la línea del platillo elegible y se redondea a dos decimales con mitad hacia arriba. Por ejemplo, 200 al 15 % produce ahorro 30 y total 170.

NxM: N y M son enteros con N > M >= 1. Para q unidades del mismo platillo se cobran floor(q/N) * M + q mod N; el resto se bonifica. Cinco unidades de 100 en 2x1 cuestan 300. Cuatro de 100 en 3x1 cuestan 200. No se mezclan platillos ni se agregan unidades automáticamente.

Solo se aplica una promoción por orden: la elegible con mayor ahorro efectivo; empate por menor identificador. Puede haber varias configuradas para el mismo platillo y se evalúan todas. El ahorro queda en la línea del platillo participante; las demás líneas conservan su precio. No hay reparto de un descuento general entre productos ni descuento manual adicional.

Las unidades gratuitas consumen ingredientes igual que las cobradas. Se conserva copia del nombre, tipo, parámetros, vigencia y ahorro de la promoción aplicada. Los cambios no alteran ventas anteriores.

## Venta y recuperación

1. Iniciar sesión y elegir platillos y cantidades enteras positivas.
2. Consultar al servidor subtotal, promoción, descuento y total.
3. Registrar un solo método: EFECTIVO o EXTERNO; no se procesa un pago bancario. Total cero válido usa SIN_COBRO.
4. Confirmar el resumen aceptado. Si cambiaron precio, receta, vigencia o condiciones, recalcular y solicitar aceptación del resumen vigente.
5. Verificar nuevamente los datos y existencias y guardar orden, detalle y consumos en una única transacción.
6. Mostrar folio y comprobante en pantalla y actualizar las vistas de stock afectadas.

El borrador es el carrito del navegador, sin persistencia obligatoria en servidor. No se puede confirmar vacío. Solo se persisten órdenes CONFIRMADAS y ANULADAS. La orden conserva usuario, fecha, moneda, método, importes, promoción y copias de nombres, precios y cantidades; los movimientos conservan el consumo efectivo de la receta.

La confirmación usa una clave idempotente estable, creada y conservada antes de enviar. Mismo usuario, clave y solicitud recuperan el resultado original; otra solicitud con esa clave se rechaza. Una respuesta incierta muestra pendiente de verificación y se consulta o reintenta la misma operación, sin crear una nueva. La identidad mínima de la operación pendiente puede guardarse localmente; no habilita una venta sin conexión y se separa por usuario.

El servidor usa datos consistentes y bloquea ingredientes en orden estable. Dos cajas no pueden consumir juntas más stock del disponible. Dinero y cantidades se transmiten como cadenas decimales y se almacenan en PostgreSQL numeric; los importes de partidas suman el total sin aritmética flotante aproximada.

## Anulación e historial

Solo administrador puede anular una venta completa, con motivo, autor y fecha. La operación conserva el original, es idempotente y no ejecuta un reembolso bancario. No se editarán partidas ni se harán devoluciones parciales.

La anulación no modifica inventario: los ingredientes ya salieron al confirmar. Si físicamente se recuperaron o no se utilizaron, administrador registra un ajuste positivo justificado con referencia al folio y las cantidades realmente recuperables; es una corrección manual, sin garantía automática de reintegro por receta. No añadir otro consumo por merma a lo ya consumido.

Historial permite filtrar fechas, consultar detalle y sumar ventas CONFIRMADAS del periodo; ANULADAS se distinguen y quedan fuera del total vigente. El periodo usa fecha de confirmación y zona del negocio. No es un cierre fiscal ni un informe de flujo de efectivo. No se incluye impresión ni exportación en este MVP.

## Pantallas y diseño

Inicio de sesión; Punto de Venta; historial y detalle; ingredientes e inventario; platillos y recetas; promociones; Avisos de stock. La gestión se limita al perfil fijo y se comprueba también en API.

Diseño web inspirado en Cupertino, con Roboto, Material Symbols Rounded y paleta verde, morado, rojo y amarillo con neutros suaves. Controles HTML accesibles y CSS común, sin depender de widgets nativos. Desde 360 px se evitan tablas anchas; en PC se adapta la distribución de la misma web. Navegación: Venta, Gestión, Historial y Avisos, con Gestión solo para administrador; inventario de lectura se puede abrir desde Avisos.

Ver [guía visual](docs/diseno-interfaz.md). Validar Chrome en Android, Safari en iPhone y Chrome/Edge en PC, registrando versiones. Simular un tamaño móvil no sustituye probar el navegador real del teléfono. La compatibilidad no exige instalar una aplicación nativa.

## Modelo mínimo de datos

| Tabla | Finalidad |
| --- | --- |
| usuarios | Cuenta nominal, hash, perfil fijo, estado y fechas. |
| sesiones | Sesión revocable y expiración; no almacenar el identificador secreto en claro. |
| ingredientes | Unidad, estado y mínimo individual. |
| platillos | Nombre, precio y estado. |
| receta_detalle | Relación platillo e ingrediente con cantidad positiva. |
| movimientos_inventario | Historial de entradas, ajustes y consumo con autor y origen. |
| promociones | Un platillo, tipo, parámetros, vigencia, estado y autoría. |
| ordenes | Folio, usuario, clave idempotente, estado, importes y datos de anulación. |
| orden_detalle | Copias históricas, cantidades entregadas y bonificadas e importes. |

Relaciones normalizadas para recetas y partidas; no almacenarlas como texto libre. Los registros con historial se desactivan o retiran sin borrar referencias. Precio/receta/promoción y movimientos conservan autoría y fechas; no se añade un módulo genérico de bitácora administrativa. Las migraciones SQL se versionan y un respaldo debe poder restaurarse antes del uso operativo. El integrante 1 define cómo exportar con `pg_dump` y probar la restauración en una base aislada; no se presupone que el plan gratuito incluya copias descargables administradas. La pausa por inactividad y los límites vigentes del plan Free se revisan antes de utilizar datos operativos.

## Fuera de alcance

Roles y permisos editables; panel de usuarios; aplicaciones nativas; tiendas; instalación PWA; operación sin conexión; push; historial y preferencias de notificaciones; monto fijo; mezcla de platillos; cupones; impresión e informes avanzados; reintegro automático por anulación; varias sucursales; mesas; comandas; reparto; clientes; proveedores; conversiones de unidades; facturación; pasarela de pago; crédito; cierre de caja y costeo.

## Criterios de aceptación

| ID | Resultado verificable |
| --- | --- |
| CW-01 | Una cuenta activa inicia y cierra sesión; una desactivada pierde acceso en la siguiente operación. |
| CW-02 | Un trabajador no puede modificar catálogo, stock, mínimos o promociones ni anular ventas; el servidor rechaza también la solicitud directa. |
| CW-03 | Crear una hamburguesa con pan, 150 g de carne y queso no consume inventario; una receta inválida no permite vender. |
| CW-04 | Iniciales, entradas y ajustes conservan autor y motivo cuando corresponde; el saldo coincide con movimientos y nunca es negativo. |
| CW-05 | Vender dos hamburguesas consume dos panes, 300 g de carne y dos quesos; incluye todas las unidades gratuitas. |
| CW-06 | Una demanda conjunta insuficiente, un fallo intermedio o dos cajas compitiendo por stock no dejan escrituras parciales ni negativos. |
| CW-07 | Doble envío, reintento y recarga tras respuesta perdida recuperan la misma venta; una clave con otro contenido se rechaza. |
| CW-08 | Pan con mínimo 20 y carne con mínimo 2000 se evalúan por separado; igualdad activa bajo stock, cero muestra agotado y reposición superior resuelve. |
| CW-09 | Avisos muestra una sola fila por ingrediente con su condición actual; volver a la pestaña o recargar consulta datos vigentes. |
| CW-10 | Una temporal aplica desde inicio inclusivo hasta fin exclusivo; una permanente no vence y desactivar o retirar impide aplicaciones futuras. |
| CW-11 | Una línea elegible de 200 con 15 % descuenta 30 y cobra 170; 100 % permite total cero sin evitar consumos. |
| CW-12 | Cinco unidades de 100 en 2x1 cuestan 300; cuatro en 3x1 cuestan 200. Se entregan y consumen cinco y cuatro respectivamente. |
| CW-13 | No se mezclan platillos ni acumulan promociones; gana el mayor ahorro con desempate estable y los importes de partidas suman el total. |
| CW-14 | Cambiar precio, receta o promoción antes de confirmar obliga a revalidar y aceptar el nuevo resumen; no se cobra silenciosamente un importe distinto. |
| CW-15 | Ventas conservan nombres, precios, descuentos y consumo originales aun después de cambios administrativos. |
| CW-16 | Anulación total con motivo conserva original, no reintegra stock automáticamente y no se duplica; el historial la separa del total vigente. |
| CW-17 | El flujo funciona desde 360 px sin desbordamiento horizontal; Chrome Android, Safari iPhone y Chrome/Edge PC tienen evidencia con versión registrada. |
| CW-18 | Diseño común aplica Roboto, Material Symbols Rounded, paleta acordada, contraste, foco y texto ampliado; teclado y errores son accesibles. |
| CW-19 | Con pérdida de conexión no se declara éxito ni se crea una segunda operación; al recuperar conexión se verifica la operación pendiente. |
| CW-20 | Un respaldo se restaura en una base aislada y conserva cuentas, catálogo, stock, promociones y órdenes coherentes. |

## Definición de terminado

Los 20 criterios CW se verifican sobre módulos integrados; cada tarea tiene evidencia y revisión de otro integrante. La web permite configurar receta y stock, aplicar promociones, vender sin duplicados, consultar mínimos e historial y anular conservando trazabilidad. Se ha verificado acceso fijo, navegadores previstos y restauración. Redactar estos documentos no completa ninguna tarea de implementación.
