# Decisión técnica de la web móvil

Actualizada el 28 de septiembre de 2026. Sustituye la elección React/NestJS/TypeORM del 22 de septiembre, sin cambiar el alcance funcional ni los IDs W.

## Lenguaje y componentes elegidos

| Componente | Elección | Responsabilidad |
| --- | --- | --- |
| Lenguaje | TypeScript estricto en frontend y backend | Código de Angular y Express, tipos y contratos. Las plantillas usan HTML y los estilos CSS. |
| Frontend | Angular con Angular CLI | Web adaptable a navegador móvil y PC, rutas, formularios y cliente HTTP. |
| Backend | Node.js con Express | API REST `/api/v1`, sesiones, validación, permisos fijos y reglas de negocio. |
| Acceso a datos | `pg` (node-postgres) | Pool de conexiones, consultas SQL parametrizadas y transacciones sobre un mismo cliente. |
| Base de datos | PostgreSQL alojado en Supabase, plan Free | Tablas, índices, restricciones, movimientos y migraciones SQL versionadas. |
| Cálculo exacto | decimal.js en el backend y PostgreSQL `numeric` | Dinero y cantidades desde cadenas decimales; redondeo explícito. |

Supabase aporta el alojamiento externo de PostgreSQL. El frontend llama a Express y no recibe la URL de conexión ni claves de administración de Supabase. Express y los archivos compilados de Angular requieren alojamiento adicional: crear un proyecto Free no aloja automáticamente la web ni este servidor. El proyecto no adopta Supabase Auth, Storage, Realtime ni Edge Functions como parte de este MVP.

## Conexión y límites de la experiencia gratuita

W1-01 verifica la modalidad de conexión PostgreSQL apropiada para el lugar donde correrá Express y las versiones compatibles; W1-02 configura `DATABASE_URL` solo en el servidor, TLS y un pool pequeño conforme a los límites efectivos del proyecto. Las migraciones y pruebas de concurrencia comparten un cliente cuando forman una transacción; no usan consultas sueltas del pool entre BEGIN y COMMIT. No registrar credenciales en repositorio, frontend, capturas ni auditorías.

Supabase recomienda conexión directa para migraciones, `pg_dump` y restauración; el equipo verificará que el entorno elegido pueda alcanzarla, incluida la conectividad IPv6 cuando aplique. Para un backend persistente sin IPv6, Supabase documenta el pooler en modo sesión. Se usarán credenciales de aplicación con privilegios limitados y credenciales administrativas separadas para tareas de mantenimiento.

El plan gratuito puede pausar proyectos por inactividad y tiene recursos y conexiones limitados. Las copias descargables administradas no están incluidas en Free: el equipo prepara exportación propia con `pg_dump` y comprueba restauración aislada. Antes de usarlo para operación real, el integrante 1 registra los límites vigentes y confirma que la disponibilidad, el respaldo y la capacidad satisfacen al negocio. No se fijan cuotas numéricas en esta decisión porque el proveedor puede cambiarlas.

El código debe poder conectarse también a PostgreSQL local o de prueba mediante configuración; Supabase no reemplaza las pruebas aisladas. Angular CLI compila TypeScript para navegador. Express conserva la separación por rutas, casos de uso y repositorios sin introducir otro framework de servidor.

## Referencias oficiales

- [Angular y su CLI](https://angular.dev/tools/cli).
- [Compilación Angular](https://angular.dev/tools/cli/build).
- [Express y middleware](https://expressjs.com/en/guide/using-middleware/).
- [Supabase y conexión PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres).
- [Transacciones con `pg`](https://node-postgres.com/features/transactions).
- [Conexiones y límites](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits).
- [Pausa de proyectos gratuitos](https://supabase.com/docs/guides/platform/free-project-pausing).
- [Lista de producción y respaldos del plan Free](https://supabase.com/docs/guides/deployment/going-into-prod).
- [decimal.js](https://mikemcl.github.io/decimal.js/).
