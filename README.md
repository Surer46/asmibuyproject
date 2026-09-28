# Organización del MVP web móvil

Versión 2.1 del 28 de septiembre de 2026. Web para empleados desde navegador móvil y PC. **Lenguaje de programación: TypeScript en frontend y backend.** Frontend Angular con Angular CLI; API Node.js con Express; PostgreSQL alojado externamente en un proyecto Supabase del plan Free. Express y la web necesitan alojamiento propio separado de la base de datos. La especificación y los planes anteriores quedan sustituidos; ver [cambios](docs/cambios-v2.md).

## Documentos de entrada

- [Resumen en Word](docs/resumen-mvp-web.docx), con prioridades y una página por integrante.
- [Especificación](spec.md) y [reglas generales](AGENTS.md).
- [Resumen y prioridades](docs/resumen-y-prioridades.md).
- [Orquestación con Codex](docs/rol-orquestador.md).
- [Orquestación con Codex](docs/rol-orquestador.md).
- [Decisión técnica](docs/decisiones/0002-web-movil.md) y [arquitectura](docs/arquitectura-tecnica.md).
- [Diseño](docs/diseno-interfaz.md), [criterios de aceptación](docs/matriz-aceptacion.md) y [plantilla de auditoría](docs/auditorias/plantilla.md).

## Reparto

| Integrante | Responsabilidad | Plan | Reglas | Prompt |
| --- | --- | --- | --- | --- |
| 1 | Base web y acceso | [plan](modulos/plataforma-accesos/plan.md) | [AGENTS](modulos/plataforma-accesos/AGENTS.md) | [prompt](modulos/plataforma-accesos/prompt.md) |
| 2 | Catálogo e inventario | [plan](modulos/catalogo-inventario/plan.md) | [AGENTS](modulos/catalogo-inventario/AGENTS.md) | [prompt](modulos/catalogo-inventario/prompt.md) |
| 3 | Descuentos y promociones | [plan](modulos/promociones/plan.md) | [AGENTS](modulos/promociones/AGENTS.md) | [prompt](modulos/promociones/prompt.md) |
| 4 | Punto de Venta e historial | [plan](modulos/ventas-reportes/plan.md) | [AGENTS](modulos/ventas-reportes/AGENTS.md) | [prompt](modulos/ventas-reportes/prompt.md) |

## Prioridades y orden

Hay 24 tareas, seis por integrante. Codex coordina el seguimiento documental y la revisión de evidencias cuando el equipo lo invoque; los cuatro integrantes mantienen la autoría y revisión asignadas. Codex coordina el seguimiento documental y la revisión de evidencias cuando el equipo lo invoque; los cuatro integrantes mantienen la autoría y revisión asignadas. P0 desbloquea base o venta central. P1 completa el MVP y su validación; también es obligatorio. Las dependencias prevalecen sobre la prioridad. Las funciones excluidas no tienen tareas de esta entrega.

1. Los cuatro comienzan con W1-01, W2-01, W3-01 y W4-01 para acordar datos y contratos.
2. W1-02 crea la base; W1-03 y W1-04 entregan acceso y diseño. Inventario y promociones avanzan sobre ella.
3. W4-03 une carrito, consumo y promociones; necesita W2-03 y W3-05.
4. Se completan gestión, Avisos, historial y anulación; cada integrante verifica su área.
5. W1-06 verifica todos los criterios y la restauración tras los cierres de módulos.

La tarea que da una base ejecutable al equipo es W1-02, precedida por W1-01. Cada tarea tiene lista, resultado, dependencias y auditoría. Revisión: 1 por 4, 2 por 1, 3 por 2 y 4 por 3, con revisiones adicionales de integración. No marcar terminada sin evidencia y aprobación independiente.

Los archivos describen trabajo pendiente. No hay aplicación implementada ni pruebas de funcionamiento ejecutadas por crear esta documentación.
