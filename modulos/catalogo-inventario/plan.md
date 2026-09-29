# Plan del integrante 2

## Catálogo e inventario

Versión 2.1. Estado: pendiente. Responsable personal: por asignar. Revisor principal: integrante 1.

Ingredientes, platillos, recetas, existencias, movimientos, consumo y alertas dentro de la web.

Leer [spec](../../spec.md), [reglas generales](../../AGENTS.md), [reglas locales](AGENTS.md), [arquitectura](../../docs/arquitectura-tecnica.md) y [matriz](../../docs/matriz-aceptacion.md). Usar [frontend](frontend/README.md) y [backend](backend/README.md). P0 y P1 son obligatorios; ejecutar por dependencias.

| ID | Prioridad | Tarea | Dependencias |
| --- | --- | --- | --- |
| W2-01 | P0 | Definir datos y contrato de inventario | Sin prerrequisito; coordinar contratos |
| W2-02 | P0 | Implementar catálogo y recetas | W1-02, W1-03, W2-01 |
| W2-03 | P0 | Implementar movimientos y consumo | W2-02 |
| W2-04 | P1 | Crear pantallas de gestión | W2-03, W1-04 |
| W2-05 | P1 | Implementar mínimos y Avisos | W2-03, W1-04 |
| W2-06 | P1 | Verificar inventario integrado | W2-04, W2-05, W4-03 |

## W2-01 Definir datos y contrato de inventario

Prioridad: P0. Estado: en revisión.

Dependencias: ninguna; coordinar los contratos iniciales en paralelo.

Resultado: Modelo de receta y contrato de consumo acordados con ventas.

- [x] Definir ingredientes, recetas, unidades, movimientos y umbral obligatorio individual.
- [x] Documentar consultas de catálogo/precios y consumo con demanda agregada, errores y mismo contexto transaccional de ventas.
- [x] Coordinar tipos con W1-01, catálogo con el integrante 3 y bloqueos/consumo con el 4.
- [x] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [x] Completar `docs/auditorias/W2-01.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W2-02 Implementar catálogo y recetas

Prioridad: P0. Estado: pendiente.

Dependencias: W1-02, W1-03, W2-01.

Resultado: API de ingredientes y platillos con recetas válidas.

- [ ] Crear migraciones, API y validaciones de ingredientes, precio, receta y activación.
- [ ] Impedir cambios de unidad con referencias, recetas vacías y uso de ingredientes inactivos.
- [ ] Comprobar que guardar recetas no modifica existencias y preservar referencias históricas.
- [ ] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [ ] Completar `docs/auditorias/W2-02.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W2-03 Implementar movimientos y consumo

Prioridad: P0. Estado: pendiente.

Dependencias: W2-02.

Resultado: Entradas, ajustes y ventas mantienen el saldo sin negativos.

- [ ] Registrar stock inicial, entradas y ajustes con autor, fecha, cantidad y motivo.
- [ ] Entregar consumo de toda la orden en la transacción de ventas, con bloqueo estable de ingredientes.
- [ ] Probar PostgreSQL real: demanda compartida, rollback, unidades gratuitas y rechazo por insuficiencia.
- [ ] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [ ] Completar `docs/auditorias/W2-03.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W2-04 Crear pantallas de gestión

Prioridad: P1. Estado: pendiente.

Dependencias: W2-03, W1-04.

Resultado: Administrador gestiona ingredientes, recetas y movimientos desde el móvil.

- [ ] Crear listas y formularios de ingredientes, platillos, recetas y movimientos.
- [ ] Mostrar unidad y cantidades sin conversiones automáticas, con errores de validación claros.
- [ ] Conectar API real y comprobar campos decimales, teclado, contenido largo y navegación.
- [ ] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [ ] Completar `docs/auditorias/W2-04.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W2-05 Implementar mínimos y Avisos

Prioridad: P1. Estado: pendiente.

Dependencias: W2-03, W1-04.

Resultado: Una condición de bajo stock por ingrediente, visible dentro de la web.

- [ ] Permitir al administrador editar un mínimo no negativo para cada ingrediente.
- [ ] Mostrar bajo stock con existencia menor o igual al mínimo y agotado a cero, priorizando este último.
- [ ] Reutilizar la consulta de condiciones actuales en inventario y Avisos; actualizar al abrir, volver a la pestaña y tras operaciones.
- [ ] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [ ] Completar `docs/auditorias/W2-05.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.

## W2-06 Verificar inventario integrado

Prioridad: P1. Estado: pendiente.

Dependencias: W2-04, W2-05, W4-03.

Resultado: Ventas y movimientos coinciden con existencias y alertas reales.

- [ ] Contrastar saldos y movimientos para recetas compartidas, promociones y reintentos de cobro.
- [ ] Verificar dos mínimos diferentes, igualdad exacta, cero, reposición y cambios de mínimo.
- [ ] Entregar evidencias web móvil y contrato definitivo al integrante 1.
- [ ] Verificar estructura y comportamiento pertinente con evidencia real; documentar entornos no disponibles.
- [ ] Completar `docs/auditorias/W2-06.md` desde la [plantilla](../../docs/auditorias/plantilla.md) y obtener revisión independiente antes de cerrar.
