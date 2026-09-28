# Arquitectura de la web móvil

## Componentes y alojamiento

Navegador móvil o PC → Angular (TypeScript, HTML y CSS) → API Express/Node.js (TypeScript) → PostgreSQL externo en Supabase Free. Angular usa Angular CLI para desarrollo y compilación. Express usa `pg` para consultas SQL parametrizadas y decimal.js para importes. La base de datos nunca se conecta directamente con el navegador.

La web compilada y Express necesitan alojamiento propio; el proyecto Supabase aloja la base de datos. En despliegue se sirve la web y `/api/v1` bajo un mismo origen HTTPS mediante alojamiento o proxy, para conservar cookies seguras y simplificar CSRF. En desarrollo Angular CLI usa un proxy a la API. El lugar concreto donde se alojarán web y Express se registra en W1-01/W1-05; este documento no presupone un proveedor adicional.

El integrante 1 mantiene `app/frontend`, `app/backend` y `compartido`. Los cuatro módulos aportan componentes Angular, routers Express y reglas propias, ensamblados en un workspace npm. No crear cuatro aplicaciones o servidores. Los paquetes de navegador no importan `pg`, credenciales ni código de Express.

## Contratos entre integrantes

| Productor | Consumidor | Contrato |
| --- | --- | --- |
| 1 | 2, 3 y 4 | Sesión, perfiles fijos, errores, cliente `pg` compartido por transacción, cliente HTTP y componentes Angular. |
| 2 | 3 y 4 | Platillos activos, precios, recetas y existencias; a 4, consumo agregado. |
| 3 | 4 | Evaluación de promoción elegible, totales y copia histórica. |
| 4 | Interfaz e historial | Confirmación, recuperación por clave, consulta y anulación. |

Documentar entradas, salidas, errores, tipos, versiones, autoría y garantías en `docs/contratos/` antes de implementar consumidores. IDs, dinero y cantidades viajan como cadenas cuando su precisión importa; fechas de API expresan UTC. El navegador solo conoce DTO públicos.

## Transacciones y exactitud

Ventas obtiene un cliente de `pg.Pool`, ejecuta BEGIN y lo pasa a inventario y a los repositorios que participan. Confirmación de orden, movimientos y cambios relacionados usan ese mismo cliente hasta COMMIT o ROLLBACK; después se libera. No usar `pool.query` dentro de la transacción. La lectura consistente de precios, recetas y promociones forma parte de la confirmación; bloquear ingredientes en orden estable y validar la versión del resumen aceptado. Una restricción única de clave idempotente por usuario y hash de solicitud evita duplicados.

PostgreSQL `numeric` y decimal.js conservan importes y cantidades exactas; mitad hacia arriba a dos decimales para dinero. La anulación cambia estado una vez y no revierte inventario; una corrección física exige ajuste explícito. Las migraciones SQL versionadas se aplican desde el backend/CLI al proyecto Supabase. Los tests de rollback y concurrencia corren primero sobre PostgreSQL aislado y se comprueba por separado la integración con el alojamiento externo.

## Configuración y operación de Supabase

Solo el backend recibe `DATABASE_URL` y parámetros TLS por variables de entorno o gestor de secretos. W1-01 documenta si Express usará conexión directa o pooler según su alojamiento; W1-02 fija un pool acorde al plan y verifica que migraciones y transacciones funcionan con esa modalidad. No incrustar claves ni contraseñas en Angular, el repositorio o registros. El cliente `pg` usa una conexión cifrada validada.

Migraciones, `pg_dump` y restauración usan la conexión directa recomendada por Supabase. W1-01 comprueba desde qué entorno hay conectividad a ese endpoint, incluido IPv6 cuando aplique. Separar credenciales de la aplicación con privilegios limitados de las usadas para administración del esquema.

El plan Free puede pausar el proyecto por inactividad y no proporciona copias administradas descargables para este uso. W1-05 define un `pg_dump` propio y W1-06 restaura ese archivo en otra base para contrastar datos. Antes de usar datos operativos el equipo verifica límites y disponibilidad actuales; una demo gratuita no acredita continuidad de servicio.

## Web, sesiones y validación

Sesión revocable en servidor con cookie HttpOnly, Secure en HTTPS y SameSite; validar origen y token CSRF para escrituras. No guardar secretos de sesión en localStorage. La clave de operación pendiente puede persistirse por usuario para recuperar una respuesta perdida, sin confirmar ventas sin conexión.

Avisos consulta condición actual del inventario, sin worker ni servicio externo. Se refresca al entrar, al recuperar foco y tras operaciones relevantes; mostrar error si la consulta falla. Verificar contratos, reglas exactas y transacciones; registrar navegador/versiones reales para Chrome Android, Safari iPhone y Chrome/Edge PC. Las 24 tareas W y los 20 criterios CW cubren el MVP. Codex sigue [su función de orquestación](rol-orquestador.md); W1-06 cierra después de evidencias de los cuatro módulos y restauración aislada.
