# Cambios de alcance de la versión 2

La petición del 22 de septiembre de 2026 reduce el MVP y lo convierte en web móvil. Los documentos activos se reemplazan de forma coherente. La versión 1.3 se conserva como archivo histórico separado.

## Sustituciones

Las 45 tareas anteriores, incluidas las cuatro de escritorio, se sustituyen por 24 tareas web con IDs W. Los 35 criterios CA y criterios PC se sustituyen por 20 criterios CW. El número de tareas organiza entregables y no equivale a una estimación de horas o porcentaje de esfuerzo.

| Antes | Ahora |
| --- | --- |
| E1-01 y E1-02 como base nativa | W1-01 y W1-02 como base web |
| Roles, permisos y gestión de cuentas en BackOffice | Dos perfiles fijos y mantenimiento técnico de cuentas |
| Cliente Dart/Flutter y fase Windows | Cliente TypeScript/React en navegador móvil y PC |
| Push, eventos, lectura y preferencias | Avisos del estado actual de stock |
| Porcentaje, monto fijo y NxM combinables | Porcentaje o NxM de un solo platillo por promoción |
| Anulación con reintegros y clasificación por preparación | Anulación total sin reintegro automático |
| Reportes e impresión | Historial, total por periodo y comprobante en pantalla |

La revisión 2.1 del 28 de septiembre de 2026 fija explícitamente TypeScript para Angular y Express. Sustituye React/Vite, NestJS y TypeORM; PostgreSQL se alojará en Supabase Free y Express lo consultará mediante `pg`. Supabase no aloja automáticamente la web ni la API. Se añadió [función de Codex como orquestador](rol-orquestador.md).

Se preservan receta, consumo de unidades gratuitas, umbral individual, duración temporal/permanente, acceso interno, cálculo exacto, historial e idempotencia. Todas las tareas nuevas están pendientes. Los prompts y AGENTS actuales se refieren a estos planes y no autorizan reintroducir alcance retirado.
