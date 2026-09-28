# Reglas universales del MVP web móvil

## Alcance y prioridad documental

Estas reglas rigen los cuatro módulos. Leer spec.md versión 2.1, README.md, plan.md y AGENTS.md del módulo, docs/arquitectura-tecnica.md y docs/decisiones/0002-web-movil.md. La petición de recortar el MVP y migrar a web sustituye las instrucciones anteriores sobre aplicaciones nativas, roles configurables y notificaciones externas. No desarrollar las funciones excluidas para satisfacer un plan antiguo.

## Estructura común

**TypeScript es el lenguaje de programación del frontend Angular y del backend Express sobre Node.js.** PostgreSQL se aloja externamente en Supabase Free; el backend lo consulta mediante `pg`. decimal.js realiza cálculos exactos. Cada integrante desarrolla frontend, backend, migraciones y verificaciones de su módulo. El integrante 1 coordina app/ y compartido/; para tocarlos consultar además modulos/plataforma-accesos/AGENTS.md.

```text
app/frontend/              Angular, componentes, rutas y build con Angular CLI
app/backend/               Express, routers y composición de la API
compartido/frontend/       estilos, componentes y cliente HTTP
compartido/backend/        transacción, errores y precisión
modulos/<modulo>/frontend/src/  pantallas, estado y acceso a API
modulos/<modulo>/backend/src/   reglas, casos de uso, persistencia y controladores
base-datos/migraciones/    migraciones SQL coordinadas por sus propietarios
docs/contratos/            contratos públicos antes de consumirlos
docs/auditorias/           evidencia por tarea W
```

Crear capas solo cuando tengan uso. Separar lógica, persistencia y presentación. No importar archivos internos de otro módulo ni escribir sus tablas directamente. Los paquetes se integran en un workspace npm; no hay cuatro aplicaciones ni cuatro servidores. No incorporar secretos, credenciales de Supabase ni código de servidor al bundle del navegador. Angular usa solo la API de Express; no activar acceso directo a las tablas desde el navegador. Las pruebas transaccionales usan PostgreSQL aislado y un conjunto de verificaciones confirma la conexión externa de la API con Supabase.

## Acceso y datos

Dos perfiles fijos ADMINISTRADOR y TRABAJADOR, conforme a spec.md; sin editor de roles ni catálogo editable de permisos. Validar cuenta activa, perfil y alcance en servidor. Sesiones revocables, cookies HttpOnly/Secure en HTTPS y protección CSRF. No guardar sesión en localStorage ni exponer credenciales en auditorías.

Ventas controla la transacción que comparte con inventario. Precios, promociones, receta y cantidades se revalidan de forma consistente antes de confirmar. Stock nunca negativo; bloqueos en orden estable. Idempotencia para confirmación y anulación, importes/cantidades exactos y copias históricas. La recuperación de una respuesta incierta reutiliza la misma operación. Una anulación no reintegra automáticamente inventario ni duplica consumos.

No modificar migraciones aplicadas; crear nuevas. Usar `pg` con consultas parametrizadas; en flujos atómicos compartir un cliente obtenido de `pg.Pool`, BEGIN/COMMIT/ROLLBACK y liberar el cliente al finalizar. No ejecutar una transacción repartida entre conexiones del pool. Usar `pg` con consultas parametrizadas; en flujos atómicos compartir un cliente obtenido de `pg.Pool`, BEGIN/COMMIT/ROLLBACK y liberar el cliente al finalizar. No ejecutar una transacción repartida entre conexiones del pool. Catálogo e historial se conservan por baja lógica. Los ajustes requieren motivo. Usar contratos con tipos, errores, autoría, garantías transaccionales y ejemplos; DTO monetarios y cantidades como cadenas decimales.

## Función de Codex como orquestador

Consultar [rol-orquestador.md](docs/rol-orquestador.md). Codex ayuda a detectar dependencias, inconsistencias, bloqueos y evidencias faltantes, y puede ejecutar verificaciones o cambios concretos cuando se le asignen. La persona responsable de cada tarea conserva su entrega; el revisor humano indicado aprueba o rechaza. Codex registra estado observado y resultados reales, sin inventar aprobaciones ni marcar una tarea terminada por el solo hecho de haber generado código o documentos. La coordinación de Codex no añade un quinto módulo ni modifica las prioridades.

## Función de Codex como orquestador

Consultar [rol-orquestador.md](docs/rol-orquestador.md). Codex ayuda a detectar dependencias, inconsistencias, bloqueos y evidencias faltantes, y puede ejecutar verificaciones o cambios concretos cuando se le asignen. La persona responsable de cada tarea conserva su entrega; el revisor humano indicado aprueba o rechaza. Codex registra estado observado y resultados reales, sin inventar aprobaciones ni marcar una tarea terminada por el solo hecho de haber generado código o documentos. La coordinación de Codex no añade un quinto módulo ni modifica las prioridades.

## Flujo por tarea y auditoría

Los IDs vigentes empiezan por W y no equivalen a los antiguos E. Estados: pendiente, en curso, bloqueada, en revisión y terminada. P0 desbloquea la base o el flujo central; P1 completa funciones y verificación de esta entrega. Ambos son obligatorios. Las dependencias mandan sobre prioridad: terminar un P1 puede desbloquear un P0.

Antes de cada tarea abrir docs/auditorias/<ID>.md desde la plantilla. Registrar alcance, responsable, revisión, dependencias y resultado esperado. Después comprobar estructura, funcionalidad, datos, acceso y diseño según el cambio; adjuntar comandos o pasos reales y resultados. Documentación requiere revisión documental, sin pruebas artificiales.

No marcar terminada una tarea sin evidencia y revisión independiente real. No inventar aprobaciones de compañeros. Si falta revisión, dejar en revisión y continuar trabajo independiente. Simulaciones permiten avanzar, pero no cierran criterios integrados. No sobrescribir cambios ajenos; trabajar en cambios pequeños por ID.

| Autor | Revisor principal | Revisión adicional |
| --- | --- | --- |
| 1 | 4 | 2 para transacción común |
| 2 | 1 | 4 para consumo |
| 3 | 2 | 4 para cotización |
| 4 | 3 | 2 para stock y 1 para acceso |

Auditar concurrencia, atomicidad y rollback con PostgreSQL real. No repetir toda la batería sin cambios o fallos que lo justifiquen. Para las pantallas registrar navegador y versión, tamaño, capturas y resultados en Chrome Android, Safari iPhone y Chrome/Edge PC según alcance; no atribuir validación a un entorno no probado.

## Composición gráfica obligatoria

Interfaz y navegación web inspiradas en Cupertino: jerarquía clara, listas agrupadas, selectores y modales sencillos. Usar HTML semántico y CSS adaptable, con Roboto 400/500/700 y Material Symbols Rounded alojados con sus licencias. Compartir componentes y conservar el botón Atrás y la navegación del navegador.

| Token | Valor | Uso |
| --- | --- | --- |
| primaria y éxito | #166534 | Guardar y confirmar, texto blanco |
| acento | #6D28D9 | Selección y promociones, texto blanco en sólido |
| error | #B91C1C | Errores, agotado y anular, texto blanco en sólido |
| advertencia | #FACC15 | Bajo stock con texto #713F12 |
| fondo y superficie | #F7F8FA y #FFFFFF | Fondo y contenido |
| texto principal y secundario | #1F2937 y #4B5563 | Sobre fondos claros |
| superficies suaves | #DCFCE7, #EDE9FE, #FEE2E2, #FEF9C3 | Verde, morado, rojo y amarillo |
| borde de control | #6B7280 | Controles sobre fondo claro |

Usar tokens compartidos. Texto informativo con contraste mínimo 4.5:1, controles relevantes 3:1. No depender solo del color. Desde 360 px, objetivos táctiles de al menos 44 por 44 px, foco visible, etiquetas, errores asociados a campos, navegación por teclado y texto al 200 %. Seguir docs/diseno-interfaz.md y registrar el seguimiento por pantalla.

## Avisos y alcance reducido

Avisos es una vista del stock actual con una fila por ingrediente; no genera push ni conserva lectura. Los módulos consultan la misma condición; no añadir colas, servicios de notificación ni tablas para reproducir el alcance retirado. No crear una tarea nativa Windows: PC utiliza la misma web adaptable.
